import { Injectable, Logger } from '@nestjs/common';
import { CosmosService } from '../database/cosmos.service';
import { BlobServiceClient } from '@azure/storage-blob';
import { KeyVaultService } from '../azure/keyvault.service';

export interface KnowledgeDocument {
  id: string;
  merchantId: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'txt' | 'url';
  fileSize: number;
  uploadedAt: Date;
  processedAt?: Date;
  status: 'uploaded' | 'processing' | 'processed' | 'failed';
  contentSummary?: string;
  blobUrl: string;
  searchIndexed: boolean;
  extractedText?: string;
  metadata?: {
    title?: string;
    author?: string;
    pageCount?: number;
    wordCount?: number;
    language?: string;
  };
}

export interface SearchResult {
  documentId: string;
  fileName: string;
  relevanceScore: number;
  snippet: string;
  highlightedText: string;
}

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);
  private blobServiceClient?: BlobServiceClient;

  constructor(
    private cosmosService: CosmosService,
    private keyVaultService: KeyVaultService
  ) {
    this.initializeBlobClient();
  }

  /**
   * Initialize Azure Blob Storage client
   */
  private async initializeBlobClient(): Promise<void> {
    try {
      const connectionString = await this.keyVaultService.getSecret('STORAGE-CONNECTION-STRING');
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      this.logger.log('Azure Blob Storage client initialized');
    } catch (error) {
      this.logger.error('Failed to initialize blob client:', error);
    }
  }

  /**
   * Upload file to knowledge base
   */
  async uploadDocument(
    merchantId: string,
    fileName: string,
    fileBuffer: Buffer,
    fileType: KnowledgeDocument['fileType']
  ): Promise<KnowledgeDocument> {
    try {
      if (!this.blobServiceClient) {
        await this.initializeBlobClient();
      }

      const documentId = this.generateDocumentId();
      const containerName = 'knowledge-base';
      const blobName = `${merchantId}/${documentId}/${fileName}`;

      // Upload to blob storage
      const containerClient = this.blobServiceClient!.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
        blobHTTPHeaders: {
          blobContentType: this.getContentType(fileType)
        }
      });

      // Create document record
      const document: KnowledgeDocument = {
        id: documentId,
        merchantId,
        fileName,
        fileType,
        fileSize: fileBuffer.length,
        uploadedAt: new Date(),
        status: 'uploaded',
        blobUrl: blockBlobClient.url,
        searchIndexed: false
      };

      // Save to database
      const container = this.cosmosService.getContainer('knowledge_documents');
      const { resource: createdDocument } = await container.items.create(document);

      // Trigger processing
      await this.processDocument(documentId);

      this.logger.log(`Document uploaded: ${fileName} for merchant ${merchantId}`);
      return createdDocument;
    } catch (error) {
      this.logger.error('Error uploading document:', error);
      throw error;
    }
  }

  /**
   * Add URL to knowledge base
   */
  async addUrlDocument(
    merchantId: string,
    url: string,
    title?: string
  ): Promise<KnowledgeDocument> {
    try {
      const documentId = this.generateDocumentId();

      // Fetch content from URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }

      const content = await response.text();
      const fileName = title || new URL(url).hostname;

      // Store as text file in blob storage
      const textBuffer = Buffer.from(content, 'utf-8');
      const containerName = 'knowledge-base';
      const blobName = `${merchantId}/${documentId}/${fileName}.txt`;

      if (!this.blobServiceClient) {
        await this.initializeBlobClient();
      }

      const containerClient = this.blobServiceClient!.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      await blockBlobClient.upload(textBuffer, textBuffer.length, {
        blobHTTPHeaders: {
          blobContentType: 'text/plain'
        }
      });

      // Create document record
      const document: KnowledgeDocument = {
        id: documentId,
        merchantId,
        fileName,
        fileType: 'url',
        fileSize: textBuffer.length,
        uploadedAt: new Date(),
        status: 'uploaded',
        blobUrl: blockBlobClient.url,
        searchIndexed: false,
        extractedText: content,
        metadata: {
          title: fileName,
          wordCount: content.split(/\s+/).length
        }
      };

      // Save to database
      const container = this.cosmosService.getContainer('knowledge_documents');
      const { resource: createdDocument } = await container.items.create(document);

      // Trigger processing
      await this.processDocument(documentId);

      this.logger.log(`URL document added: ${url} for merchant ${merchantId}`);
      return createdDocument;
    } catch (error) {
      this.logger.error('Error adding URL document:', error);
      throw error;
    }
  }

  /**
   * Process document (extract text, index for search)
   */
  private async processDocument(documentId: string): Promise<void> {
    try {
      const container = this.cosmosService.getContainer('knowledge_documents');
      const { resource: document } = await container.item(documentId).read();

      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Update status to processing
      document.status = 'processing';
      await container.item(documentId).replace(document);

      let extractedText = document.extractedText || '';

      // Extract text based on file type
      if (!extractedText) {
        switch (document.fileType) {
          case 'txt':
            extractedText = await this.extractTextFromBlob(document.blobUrl);
            break;
          case 'pdf':
            extractedText = await this.extractTextFromPDF(document.blobUrl);
            break;
          case 'docx':
            extractedText = await this.extractTextFromDocx(document.blobUrl);
            break;
          default:
            extractedText = await this.extractTextFromBlob(document.blobUrl);
        }
      }

      // Generate content summary
      const contentSummary = await this.generateContentSummary(extractedText);

      // Update document with extracted content
      document.extractedText = extractedText;
      document.contentSummary = contentSummary;
      document.processedAt = new Date();
      document.status = 'processed';
      document.metadata = {
        ...document.metadata,
        wordCount: extractedText.split(/\s+/).length,
        language: this.detectLanguage(extractedText)
      };

      await container.item(documentId).replace(document);

      // Index for search (would integrate with Azure Cognitive Search here)
      await this.indexDocumentForSearch(document);

      this.logger.log(`Document processed: ${documentId}`);
    } catch (error) {
      this.logger.error('Error processing document:', error);
      
      // Update status to failed
      const container = this.cosmosService.getContainer('knowledge_documents');
      try {
        const { resource: document } = await container.item(documentId).read();
        if (document) {
          document.status = 'failed';
          await container.item(documentId).replace(document);
        }
      } catch (updateError) {
        this.logger.error('Error updating failed status:', updateError);
      }
    }
  }

  /**
   * Search knowledge base using Azure Cognitive Search or fallback to local search
   */
  async searchKnowledgeBase(
    merchantId: string,
    query: string,
    limit: number = 5
  ): Promise<SearchResult[]> {
    try {
      const searchEndpoint = process.env.COGNITIVE_SEARCH_ENDPOINT;
      const searchKey = process.env.COGNITIVE_SEARCH_KEY;
      
      if (searchEndpoint && searchKey) {
        // Use Azure Cognitive Search
        return await this.searchWithAzureCognitiveSearch(merchantId, query, limit, searchEndpoint, searchKey);
      } else {
        // Fallback to local search
        this.logger.warn('Azure Cognitive Search not configured, using local search');
        return await this.searchWithLocalSearch(merchantId, query, limit);
      }
    } catch (error) {
      this.logger.error('Error searching knowledge base:', error);
      return [];
    }
  }

  /**
   * Search using Azure Cognitive Search
   */
  private async searchWithAzureCognitiveSearch(
    merchantId: string,
    query: string,
    limit: number,
    searchEndpoint: string,
    searchKey: string
  ): Promise<SearchResult[]> {
    try {
      const searchUrl = `${searchEndpoint}/indexes/knowledge-base/docs/search?api-version=2023-11-01`;
      
      const searchRequest = {
        search: query,
        filter: `merchantId eq '${merchantId}'`,
        select: 'id,fileName,fileType,content,contentSummary',
        top: limit,
        highlight: 'content,contentSummary',
        scoringProfile: 'relevanceProfile',
        queryType: 'full',
        searchMode: 'any',
      };

      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': searchKey,
        },
        body: JSON.stringify(searchRequest),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Azure Cognitive Search error: ${error}`);
        return await this.searchWithLocalSearch(merchantId, query, limit);
      }

      const searchResults = await response.json();
      const results: SearchResult[] = [];

      for (const item of searchResults.value) {
        // Use highlighted text if available, otherwise generate snippet
        let snippet = '';
        let highlightedText = '';
        
        if (item['@search.highlights'] && item['@search.highlights'].content) {
          highlightedText = item['@search.highlights'].content[0];
          snippet = this.cleanHighlightedText(highlightedText);
        } else if (item['@search.highlights'] && item['@search.highlights'].contentSummary) {
          highlightedText = item['@search.highlights'].contentSummary[0];
          snippet = this.cleanHighlightedText(highlightedText);
        } else {
          snippet = this.generateSnippet(query, item.content || item.contentSummary || '');
          highlightedText = this.highlightText(query, snippet);
        }

        results.push({
          documentId: item.id,
          fileName: item.fileName,
          relevanceScore: item['@search.score'] || 1.0,
          snippet,
          highlightedText,
        });
      }

      this.logger.log(`Azure Cognitive Search returned ${results.length} results for query: ${query}`);
      return results;
    } catch (error) {
      this.logger.error('Error with Azure Cognitive Search, falling back to local search:', error);
      return await this.searchWithLocalSearch(merchantId, query, limit);
    }
  }

  /**
   * Local search implementation (fallback)
   */
  private async searchWithLocalSearch(
    merchantId: string,
    query: string,
    limit: number
  ): Promise<SearchResult[]> {
    try {
      // Get processed documents for merchant
      const container = this.cosmosService.getContainer('knowledge_documents');
      
      const documentsQuery = `
        SELECT * FROM c 
        WHERE c.merchantId = @merchantId 
        AND c.status = 'processed'
        AND c.searchIndexed = true
      `;
      
      const { resources: documents } = await container.items
        .query({
          query: documentsQuery,
          parameters: [{ name: '@merchantId', value: merchantId }]
        })
        .fetchAll();

      if (documents.length === 0) {
        return [];
      }

      // Simple text search implementation
      const results: SearchResult[] = [];

      for (const doc of documents) {
        if (doc.extractedText) {
          const relevanceScore = this.calculateRelevanceScore(query, doc.extractedText);
          
          if (relevanceScore > 0.1) {
            const snippet = this.generateSnippet(query, doc.extractedText);
            
            results.push({
              documentId: doc.id,
              fileName: doc.fileName,
              relevanceScore,
              snippet,
              highlightedText: this.highlightText(query, snippet)
            });
          }
        }
      }

      // Sort by relevance and limit results
      return results
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);
    } catch (error) {
      this.logger.error('Error with local search:', error);
      return [];
    }
  }

  /**
   * Clean highlighted text from Azure Cognitive Search
   */
  private cleanHighlightedText(highlightedText: string): string {
    return highlightedText.replace(/<em>/g, '').replace(/<\/em>/g, '');
  }

  /**
   * Get merchant's documents
   */
  async getMerchantDocuments(merchantId: string): Promise<KnowledgeDocument[]> {
    try {
      const container = this.cosmosService.getContainer('knowledge_documents');
      
      const query = `
        SELECT * FROM c 
        WHERE c.merchantId = @merchantId 
        ORDER BY c.uploadedAt DESC
      `;
      
      const { resources: documents } = await container.items
        .query({
          query,
          parameters: [{ name: '@merchantId', value: merchantId }]
        })
        .fetchAll();

      return documents;
    } catch (error) {
      this.logger.error('Error fetching merchant documents:', error);
      throw error;
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string, merchantId: string): Promise<void> {
    try {
      const container = this.cosmosService.getContainer('knowledge_documents');
      const { resource: document } = await container.item(documentId).read();

      if (!document || document.merchantId !== merchantId) {
        throw new Error('Document not found or unauthorized');
      }

      // Delete from blob storage
      if (this.blobServiceClient) {
        try {
          const url = new URL(document.blobUrl);
          const pathParts = url.pathname.split('/');
          const containerName = pathParts[1];
          const blobName = pathParts.slice(2).join('/');
          
          const containerClient = this.blobServiceClient.getContainerClient(containerName);
          await containerClient.deleteBlob(blobName);
        } catch (blobError) {
          this.logger.warn('Error deleting blob:', blobError);
        }
      }

      // Delete from database
      await container.item(documentId).delete();

      this.logger.log(`Document deleted: ${documentId}`);
    } catch (error) {
      this.logger.error('Error deleting document:', error);
      throw error;
    }
  }

  /**
   * Extract text from blob (simple text files)
   */
  private async extractTextFromBlob(blobUrl: string): Promise<string> {
    try {
      const response = await fetch(blobUrl);
      return await response.text();
    } catch (error) {
      this.logger.error('Error extracting text from blob:', error);
      return '';
    }
  }

  /**
   * Extract text from PDF using Azure Form Recognizer
   */
  private async extractTextFromPDF(blobUrl: string): Promise<string> {
    try {
      // Use Azure Form Recognizer for PDF text extraction
      const response = await fetch(blobUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // For production deployment, integrate with Azure Form Recognizer
      // For now, implement basic PDF text extraction
      try {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        return data.text;
      } catch (pdfError) {
        this.logger.warn('PDF parsing library not available, using Azure Form Recognizer');
        
        // Fallback to Azure Form Recognizer API
        const formRecognizerEndpoint = process.env.FORM_RECOGNIZER_ENDPOINT;
        const formRecognizerKey = process.env.FORM_RECOGNIZER_KEY;
        
        if (formRecognizerEndpoint && formRecognizerKey) {
          const formData = new FormData();
          formData.append('file', new Blob([buffer]), 'document.pdf');
          
          const extractResponse = await fetch(`${formRecognizerEndpoint}/formrecognizer/documentModels/prebuilt-read:analyze?api-version=2023-07-31`, {
            method: 'POST',
            headers: {
              'Ocp-Apim-Subscription-Key': formRecognizerKey,
            },
            body: formData,
          });
          
          if (extractResponse.ok) {
            const operationLocation = extractResponse.headers.get('Operation-Location');
            // Poll for results (simplified implementation)
            return await this.pollFormRecognizerResults(operationLocation, formRecognizerKey);
          }
        }
        
        this.logger.warn('PDF text extraction failed, returning empty string');
        return '';
      }
    } catch (error) {
      this.logger.error('Error extracting text from PDF:', error);
      return '';
    }
  }

  /**
   * Extract text from DOCX using mammoth library
   */
  private async extractTextFromDocx(blobUrl: string): Promise<string> {
    try {
      const response = await fetch(blobUrl);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      } catch (mammothError) {
        this.logger.warn('Mammoth library not available, using alternative extraction');
        
        // Fallback to Azure Form Recognizer for DOCX
        const formRecognizerEndpoint = process.env.FORM_RECOGNIZER_ENDPOINT;
        const formRecognizerKey = process.env.FORM_RECOGNIZER_KEY;
        
        if (formRecognizerEndpoint && formRecognizerKey) {
          const formData = new FormData();
          formData.append('file', new Blob([buffer]), 'document.docx');
          
          const extractResponse = await fetch(`${formRecognizerEndpoint}/formrecognizer/documentModels/prebuilt-read:analyze?api-version=2023-07-31`, {
            method: 'POST',
            headers: {
              'Ocp-Apim-Subscription-Key': formRecognizerKey,
            },
            body: formData,
          });
          
          if (extractResponse.ok) {
            const operationLocation = extractResponse.headers.get('Operation-Location');
            return await this.pollFormRecognizerResults(operationLocation, formRecognizerKey);
          }
        }
        
        this.logger.warn('DOCX text extraction failed, returning empty string');
        return '';
      }
    } catch (error) {
      this.logger.error('Error extracting text from DOCX:', error);
      return '';
    }
  }

  /**
   * Poll Azure Form Recognizer for results
   */
  private async pollFormRecognizerResults(operationLocation: string, apiKey: string): Promise<string> {
    try {
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        const response = await fetch(operationLocation, {
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey,
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          
          if (result.status === 'succeeded') {
            // Extract text from Form Recognizer result
            let extractedText = '';
            if (result.analyzeResult && result.analyzeResult.content) {
              extractedText = result.analyzeResult.content;
            }
            return extractedText;
          } else if (result.status === 'failed') {
            this.logger.error('Form Recognizer analysis failed');
            return '';
          }
          
          // Wait before polling again
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        attempts++;
      }
      
      this.logger.warn('Form Recognizer polling timed out');
      return '';
    } catch (error) {
      this.logger.error('Error polling Form Recognizer results:', error);
      return '';
    }
  }

  /**
   * Generate content summary using AI
   */
  private async generateContentSummary(text: string): Promise<string> {
    if (text.length < 200) {
      return text.substring(0, 150) + '...';
    }

    // In production, use OpenAI to generate summary
    return text.substring(0, 200) + '...';
  }

  /**
   * Index document for search using Azure Cognitive Search
   */
  private async indexDocumentForSearch(document: KnowledgeDocument): Promise<void> {
    try {
      const searchEndpoint = process.env.COGNITIVE_SEARCH_ENDPOINT;
      const searchKey = process.env.COGNITIVE_SEARCH_KEY;
      
      if (!searchEndpoint || !searchKey) {
        this.logger.warn('Azure Cognitive Search not configured, using local search');
        document.searchIndexed = true;
        return;
      }

      // Create index if it doesn't exist
      await this.ensureSearchIndexExists(searchEndpoint, searchKey);

      // Prepare document for indexing
      const searchDocument = {
        '@search.action': 'upload',
        id: document.id,
        merchantId: document.merchantId,
        fileName: document.fileName,
        fileType: document.fileType,
        content: document.extractedText || '',
        contentSummary: document.contentSummary || '',
        uploadedAt: document.uploadedAt.toISOString(),
        metadata: JSON.stringify(document.metadata || {}),
      };

      // Index the document
      const indexUrl = `${searchEndpoint}/indexes/knowledge-base/docs/index?api-version=2023-11-01`;
      
      const response = await fetch(indexUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': searchKey,
        },
        body: JSON.stringify({
          value: [searchDocument],
        }),
      });

      if (response.ok) {
        document.searchIndexed = true;
        this.logger.log(`Document indexed in Azure Cognitive Search: ${document.id}`);
      } else {
        const error = await response.text();
        this.logger.error(`Failed to index document in Azure Cognitive Search: ${error}`);
        document.searchIndexed = false;
      }
    } catch (error) {
      this.logger.error('Error indexing document for search:', error);
      document.searchIndexed = false;
    }
  }

  /**
   * Ensure Azure Cognitive Search index exists
   */
  private async ensureSearchIndexExists(searchEndpoint: string, searchKey: string): Promise<void> {
    try {
      const indexUrl = `${searchEndpoint}/indexes/knowledge-base?api-version=2023-11-01`;
      
      // Check if index exists
      const checkResponse = await fetch(indexUrl, {
        method: 'GET',
        headers: {
          'api-key': searchKey,
        },
      });

      if (checkResponse.status === 404) {
        // Create index
        const indexDefinition = {
          name: 'knowledge-base',
          fields: [
            { name: 'id', type: 'Edm.String', key: true, searchable: false, filterable: true },
            { name: 'merchantId', type: 'Edm.String', searchable: false, filterable: true },
            { name: 'fileName', type: 'Edm.String', searchable: true, filterable: true },
            { name: 'fileType', type: 'Edm.String', searchable: false, filterable: true },
            { name: 'content', type: 'Edm.String', searchable: true, analyzer: 'standard.lucene' },
            { name: 'contentSummary', type: 'Edm.String', searchable: true },
            { name: 'uploadedAt', type: 'Edm.DateTimeOffset', searchable: false, filterable: true, sortable: true },
            { name: 'metadata', type: 'Edm.String', searchable: false },
          ],
          scoringProfiles: [
            {
              name: 'relevanceProfile',
              text: {
                weights: {
                  content: 2.0,
                  contentSummary: 1.5,
                  fileName: 1.0,
                },
              },
            },
          ],
          defaultScoringProfile: 'relevanceProfile',
        };

        const createResponse = await fetch(`${searchEndpoint}/indexes?api-version=2023-11-01`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': searchKey,
          },
          body: JSON.stringify(indexDefinition),
        });

        if (createResponse.ok) {
          this.logger.log('Azure Cognitive Search index created: knowledge-base');
        } else {
          const error = await createResponse.text();
          this.logger.error(`Failed to create search index: ${error}`);
        }
      }
    } catch (error) {
      this.logger.error('Error ensuring search index exists:', error);
    }
  }

  /**
   * Calculate relevance score (simple implementation)
   */
  private calculateRelevanceScore(query: string, text: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const textWords = text.toLowerCase().split(/\s+/);
    
    let matches = 0;
    for (const word of queryWords) {
      if (textWords.includes(word)) {
        matches++;
      }
    }
    
    return matches / queryWords.length;
  }

  /**
   * Generate snippet around relevant text
   */
  private generateSnippet(query: string, text: string, maxLength: number = 200): string {
    const queryWords = query.toLowerCase().split(/\s+/);
    const textLower = text.toLowerCase();
    
    let bestPosition = 0;
    let maxMatches = 0;
    
    for (let i = 0; i < text.length - maxLength; i += 50) {
      const snippet = textLower.substring(i, i + maxLength);
      const matches = queryWords.filter(word => snippet.includes(word)).length;
      
      if (matches > maxMatches) {
        maxMatches = matches;
        bestPosition = i;
      }
    }
    
    return text.substring(bestPosition, bestPosition + maxLength).trim() + '...';
  }

  /**
   * Highlight search terms in text
   */
  private highlightText(query: string, text: string): string {
    const queryWords = query.split(/\s+/);
    let highlightedText = text;
    
    for (const word of queryWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      highlightedText = highlightedText.replace(regex, `<mark>$&</mark>`);
    }
    
    return highlightedText;
  }

  /**
   * Detect text language (simple implementation)
   */
  private detectLanguage(text: string): string {
    // Simple detection - in production use proper language detection
    const arabicPattern = /[\u0600-\u06FF]/;
    return arabicPattern.test(text) ? 'Arabic' : 'English';
  }

  /**
   * Get content type for file type
   */
  private getContentType(fileType: string): string {
    const types = {
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'url': 'text/plain'
    };
    return types[fileType] || 'application/octet-stream';
  }

  /**
   * Generate unique document ID
   */
  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }
} 
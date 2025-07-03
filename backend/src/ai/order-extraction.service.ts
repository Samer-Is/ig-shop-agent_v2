import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeyVaultService } from '../azure';
import { CosmosService } from '../database';
import { 
  OrderExtraction, 
  ExtractedProduct, 
  ExtractedCustomerData, 
  ExtractedShippingData,
  OrderValidationResult,
  OrderValidationError
} from '../database/orders.schema';
import { MerchantContext } from './ai.service';

export interface OrderExtractionRequest {
  messageText: string;
  merchantId: string;
  pageId: string;
  customerId: string;
  conversationId: string;
  productCatalog: any[];
  businessInfo: any;
  previousMessages?: string[];
}

export interface OrderExtractionResponse {
  extraction: OrderExtraction;
  validation: OrderValidationResult;
  clarificationQuestions: string[];
  shouldCreateOrder: boolean;
  confidenceScore: number;
}

@Injectable()
export class OrderExtractionService {
  private readonly logger = new Logger(OrderExtractionService.name);
  private readonly openAIKey: string;
  private readonly openAIEndpoint: string;

  constructor(
    private configService: ConfigService,
    private keyVaultService: KeyVaultService,
    private cosmosService: CosmosService,
  ) {
    this.openAIKey = this.configService.get<string>('azure.openai.apiKey');
    this.openAIEndpoint = this.configService.get<string>('azure.openai.endpoint');
  }

  /**
   * Extract order information from customer message using AI
   */
  async extractOrderFromMessage(request: OrderExtractionRequest): Promise<OrderExtractionResponse> {
    try {
      this.logger.log(`Starting order extraction for merchant ${request.merchantId}`);

      // Build enhanced extraction prompt
      const extractionPrompt = this.buildOrderExtractionPrompt(request);
      
      // Call GPT-4o for order extraction
      const extractionResult = await this.callOpenAIForExtraction(extractionPrompt);
      
      // Parse and validate the extraction
      const parsedExtraction = this.parseExtractionResult(extractionResult, request);
      
      // Validate extracted order data
      const validation = await this.validateExtractedOrder(parsedExtraction, request);
      
      // Generate clarification questions if needed
      const clarificationQuestions = this.generateClarificationQuestions(parsedExtraction, validation);
      
      // Determine if order should be created
      const shouldCreateOrder = this.shouldCreateOrder(parsedExtraction, validation);
      
      const response: OrderExtractionResponse = {
        extraction: parsedExtraction,
        validation,
        clarificationQuestions,
        shouldCreateOrder,
        confidenceScore: parsedExtraction.confidence
      };

      this.logger.log(`Order extraction completed`, {
        merchantId: request.merchantId,
        confidence: parsedExtraction.confidence,
        shouldCreateOrder,
        missingFields: parsedExtraction.missingFields.length,
        clarificationCount: clarificationQuestions.length
      });

      return response;
    } catch (error) {
      this.logger.error('Error in order extraction:', error);
      throw error;
    }
  }

  /**
   * Build comprehensive prompt for order extraction
   */
  private buildOrderExtractionPrompt(request: OrderExtractionRequest): string {
    const { messageText, productCatalog, businessInfo, previousMessages } = request;

    const productCatalogText = productCatalog
      .map(product => `- ${product.name}: ${product.description} (Price: ${product.price} ${product.currency || 'JOD'})`)
      .join('\n');

    const previousContext = previousMessages?.length 
      ? `\n\nPrevious conversation context:\n${previousMessages.slice(-3).join('\n')}`
      : '';

    return `You are an AI assistant specialized in extracting order information from customer messages for an e-commerce business.

BUSINESS CONTEXT:
${businessInfo.description || 'E-commerce business'}
Business Hours: ${businessInfo.workingHours || 'Standard hours'}
Location: ${businessInfo.location || 'Jordan'}

AVAILABLE PRODUCTS:
${productCatalogText}

CUSTOMER MESSAGE TO ANALYZE:
"${messageText}"
${previousContext}

TASK: Extract order information from the customer message and return a JSON response with the following structure:

{
  "intent": "order_placement" | "order_inquiry" | "order_modification",
  "confidence": 0.0-1.0,
  "products": [
    {
      "name": "extracted product name",
      "quantity": number,
      "confidence": 0.0-1.0,
      "size": "if mentioned",
      "color": "if mentioned", 
      "variant": "if mentioned",
      "extractedFromText": "exact text where this was found",
      "contextSentence": "full sentence containing the product reference",
      "catalogMatches": [
        {
          "productId": "matching product ID from catalog",
          "productName": "matching product name",
          "similarity": 0.0-1.0
        }
      ]
    }
  ],
  "customer": {
    "name": {
      "value": "customer name if mentioned",
      "confidence": 0.0-1.0
    },
    "phone": {
      "value": "phone number if mentioned",
      "confidence": 0.0-1.0,
      "isValid": true/false
    },
    "address": {
      "value": "address if mentioned", 
      "confidence": 0.0-1.0,
      "isParseable": true/false
    }
  },
  "shipping": {
    "address": {
      "raw": "raw address text",
      "confidence": 0.0-1.0
    },
    "deliveryInstructions": {
      "value": "special delivery instructions",
      "confidence": 0.0-1.0  
    },
    "urgency": {
      "level": "standard" | "urgent" | "asap",
      "confidence": 0.0-1.0
    }
  },
  "missingFields": ["list", "of", "missing", "required", "fields"],
  "clarificationNeeded": true/false
}

EXTRACTION RULES:
1. Only extract information that is explicitly mentioned in the message
2. Match products to the catalog using fuzzy matching - look for similar names, descriptions
3. Phone numbers should be validated for Jordan format (+962 or local format)
4. Addresses should be checked if they seem complete and parseable
5. Set confidence based on how explicitly and clearly the information is stated
6. Mark clarificationNeeded=true if critical information is missing
7. For product matching, consider variations in spelling, abbreviations, and synonyms
8. If customer uses Arabic, extract the Arabic names but also try to match to English product names
9. Look for quantity indicators: "two", "2", "pair", "dozen", etc.
10. Consider context from previous messages for better understanding

REQUIRED FIELDS FOR COMPLETE ORDER:
- At least one product with quantity
- Customer contact (name and phone)
- Delivery address
- Clear intent to purchase

Return only the JSON response, no other text.`;
  }

  /**
   * Call OpenAI GPT-4o for order extraction
   */
  private async callOpenAIForExtraction(prompt: string): Promise<any> {
    try {
      const response = await fetch(`${this.openAIEndpoint}/openai/deployments/gpt-4o/chat/completions?api-version=2024-02-15-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.openAIKey,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are an expert AI assistant for e-commerce order extraction. Always respond with valid JSON only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.1, // Low temperature for consistent extraction
          response_format: { type: 'json_object' }
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      this.logger.error('Error calling OpenAI for order extraction:', error);
      throw error;
    }
  }

  /**
   * Parse and validate extraction result from AI
   */
  private parseExtractionResult(extractionResult: any, request: OrderExtractionRequest): OrderExtraction {
    const extraction: OrderExtraction = {
      orderId: '', // Will be set when order is created
      messageId: '', // Will be set from conversation service
      extractedData: {
        products: extractionResult.products || [],
        customer: extractionResult.customer || {},
        shipping: extractionResult.shipping || {},
        intent: extractionResult.intent || 'order_inquiry'
      },
      confidence: extractionResult.confidence || 0.5,
      missingFields: extractionResult.missingFields || [],
      clarificationNeeded: extractionResult.clarificationNeeded || false,
      extractionTimestamp: new Date()
    };

    // Enhance product matching with catalog
    extraction.extractedData.products = this.enhanceProductMatching(
      extraction.extractedData.products,
      request.productCatalog
    );

    return extraction;
  }

  /**
   * Enhance product matching with merchant catalog
   */
  private enhanceProductMatching(extractedProducts: ExtractedProduct[], catalog: any[]): ExtractedProduct[] {
    return extractedProducts.map(product => {
      const matches = catalog
        .map(catalogProduct => ({
          productId: catalogProduct.id,
          productName: catalogProduct.name,
          similarity: this.calculateProductSimilarity(product.name, catalogProduct.name, catalogProduct.description)
        }))
        .filter(match => match.similarity > 0.3)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3);

      return {
        ...product,
        catalogMatches: matches,
        matchedProductId: matches.length > 0 && matches[0].similarity > 0.7 ? matches[0].productId : undefined
      };
    });
  }

  /**
   * Calculate similarity between extracted product and catalog product
   */
  private calculateProductSimilarity(extractedName: string, catalogName: string, catalogDescription: string): number {
    const normalizeText = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    const extracted = normalizeText(extractedName);
    const name = normalizeText(catalogName);
    const description = normalizeText(catalogDescription);

    // Exact match
    if (extracted === name) return 1.0;
    
    // Contains match
    if (name.includes(extracted) || extracted.includes(name)) return 0.9;
    
    // Description match
    if (description.includes(extracted)) return 0.7;
    
    // Word overlap
    const extractedWords = extracted.split(/\s+/);
    const nameWords = name.split(/\s+/);
    const overlap = extractedWords.filter(word => nameWords.includes(word)).length;
    const similarity = overlap / Math.max(extractedWords.length, nameWords.length);
    
    return similarity;
  }

  /**
   * Validate extracted order data
   */
  private async validateExtractedOrder(extraction: OrderExtraction, request: OrderExtractionRequest): Promise<OrderValidationResult> {
    const errors: OrderValidationError[] = [];
    const warnings: any[] = [];
    
    // Validate products
    if (!extraction.extractedData.products.length) {
      errors.push({
        field: 'products',
        message: 'No products identified in the message',
        severity: 'critical',
        canAutoFix: false
      });
    }

    // Validate customer information
    const customer = extraction.extractedData.customer;
    if (!customer.name?.value) {
      errors.push({
        field: 'customer.name',
        message: 'Customer name not provided',
        severity: 'high',
        canAutoFix: false
      });
    }

    if (!customer.phone?.value) {
      errors.push({
        field: 'customer.phone',
        message: 'Customer phone number not provided',
        severity: 'high',
        canAutoFix: false
      });
    } else if (!customer.phone.isValid) {
      warnings.push({
        field: 'customer.phone',
        message: 'Phone number format may be incorrect',
        recommendation: 'Ask customer to confirm phone number format'
      });
    }

    // Validate shipping address
    if (!extraction.extractedData.shipping.address?.raw) {
      errors.push({
        field: 'shipping.address',
        message: 'Delivery address not provided',
        severity: 'high',
        canAutoFix: false
      });
    }

    // Calculate completeness
    const totalFields = 4; // products, name, phone, address
    const completedFields = [
      extraction.extractedData.products.length > 0,
      !!customer.name?.value,
      !!customer.phone?.value,
      !!extraction.extractedData.shipping.address?.raw
    ].filter(Boolean).length;
    
    const completeness = (completedFields / totalFields) * 100;

    return {
      isValid: errors.filter(e => e.severity === 'critical').length === 0,
      errors,
      warnings,
      completeness
    };
  }

  /**
   * Generate clarification questions for missing information
   */
  private generateClarificationQuestions(extraction: OrderExtraction, validation: OrderValidationResult): string[] {
    const questions: string[] = [];
    
    validation.errors.forEach(error => {
      switch (error.field) {
        case 'products':
          questions.push('Could you please tell me which products you would like to order?');
          break;
        case 'customer.name':
          questions.push('May I have your full name for the order?');
          break;
        case 'customer.phone':
          questions.push('What\'s your phone number so we can contact you about the order?');
          break;
        case 'shipping.address':
          questions.push('Where would you like us to deliver your order? Please provide your full address.');
          break;
      }
    });

    // Product-specific clarifications
    extraction.extractedData.products.forEach((product, index) => {
      if (product.confidence < 0.7) {
        questions.push(`Just to confirm, did you mean "${product.catalogMatches[0]?.productName || product.name}"?`);
      }
      if (!product.quantity || product.quantity === 0) {
        questions.push(`How many ${product.name} would you like?`);
      }
    });

    return questions.slice(0, 3); // Limit to 3 questions at a time
  }

  /**
   * Determine if an order should be automatically created
   */
  private shouldCreateOrder(extraction: OrderExtraction, validation: OrderValidationResult): boolean {
    return (
      extraction.extractedData.intent === 'order_placement' &&
      extraction.confidence > 0.7 &&
      validation.completeness > 80 &&
      validation.errors.filter(e => e.severity === 'critical').length === 0
    );
  }

  /**
   * Check if extracted data needs clarification
   */
  needsClarification(extraction: OrderExtraction, validation: OrderValidationResult): boolean {
    return (
      extraction.clarificationNeeded ||
      validation.completeness < 60 ||
      validation.errors.filter(e => e.severity === 'critical' || e.severity === 'high').length > 0
    );
  }

  /**
   * Generate order number
   */
  generateOrderNumber(merchantId: string): string {
    const timestamp = Date.now().toString().slice(-6);
    const merchantPrefix = merchantId.slice(-3).toUpperCase();
    return `${merchantPrefix}-${timestamp}`;
  }

  async extractOrder(messageText: string): Promise<any> {
    this.logger.log('Extracting order from message');
    // Implementation will be added here
    return {};
  }
} 
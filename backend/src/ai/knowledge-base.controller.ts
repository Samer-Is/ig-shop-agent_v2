import { 
  Controller, 
  Get, 
  Post, 
  Delete, 
  Body, 
  Param, 
  UseGuards, 
  Req,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  NotFoundException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KnowledgeBaseService, KnowledgeDocument } from './knowledge-base.service';

@Controller('api/knowledge-base')
@UseGuards(JwtAuthGuard)
export class KnowledgeBaseController {
  constructor(private knowledgeBaseService: KnowledgeBaseService) {}

  /**
   * Upload a document file
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any
  ) {
    try {
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      const merchantId = req.user.merchantId;
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      
      if (!allowedTypes.includes(file.mimetype)) {
        throw new BadRequestException('Unsupported file type. Please upload PDF, DOCX, or TXT files.');
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        throw new BadRequestException('File size exceeds 10MB limit');
      }

      let fileType: KnowledgeDocument['fileType'];
      switch (file.mimetype) {
        case 'application/pdf':
          fileType = 'pdf';
          break;
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          fileType = 'docx';
          break;
        case 'text/plain':
          fileType = 'txt';
          break;
        default:
          throw new BadRequestException('Unsupported file type');
      }

      const document = await this.knowledgeBaseService.uploadDocument(
        merchantId,
        file.originalname,
        file.buffer,
        fileType
      );

      return {
        success: true,
        data: document,
        message: 'Document uploaded successfully'
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Failed to upload document',
        error: error.message
      });
    }
  }

  /**
   * Add a URL document
   */
  @Post('url')
  async addUrlDocument(
    @Body() body: { url: string; title?: string },
    @Req() req: any
  ) {
    try {
      const { url, title } = body;
      
      if (!url || !url.trim()) {
        throw new BadRequestException('URL is required');
      }

      // Basic URL validation
      try {
        new URL(url);
      } catch {
        throw new BadRequestException('Invalid URL format');
      }

      const merchantId = req.user.merchantId;
      const document = await this.knowledgeBaseService.addUrlDocument(
        merchantId,
        url.trim(),
        title?.trim()
      );

      return {
        success: true,
        data: document,
        message: 'URL document added successfully'
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Failed to add URL document',
        error: error.message
      });
    }
  }

  /**
   * Get merchant's documents
   */
  @Get('documents')
  async getMerchantDocuments(@Req() req: any) {
    try {
      const merchantId = req.user.merchantId;
      const documents = await this.knowledgeBaseService.getMerchantDocuments(merchantId);

      return {
        success: true,
        data: documents,
        message: 'Documents retrieved successfully'
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Failed to retrieve documents',
        error: error.message
      });
    }
  }

  /**
   * Delete a document
   */
  @Delete('documents/:documentId')
  async deleteDocument(
    @Param('documentId') documentId: string,
    @Req() req: any
  ) {
    try {
      const merchantId = req.user.merchantId;
      await this.knowledgeBaseService.deleteDocument(documentId, merchantId);

      return {
        success: true,
        message: 'Document deleted successfully'
      };
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('Unauthorized')) {
        throw new NotFoundException({
          success: false,
          message: 'Document not found or unauthorized',
          error: error.message
        });
      }
      
      throw new BadRequestException({
        success: false,
        message: 'Failed to delete document',
        error: error.message
      });
    }
  }

  /**
   * Search knowledge base
   */
  @Post('search')
  async searchKnowledgeBase(
    @Body() body: { query: string; limit?: number },
    @Req() req: any
  ) {
    try {
      const { query, limit = 5 } = body;
      
      if (!query || !query.trim()) {
        throw new BadRequestException('Search query is required');
      }

      const merchantId = req.user.merchantId;
      const results = await this.knowledgeBaseService.searchKnowledgeBase(
        merchantId,
        query.trim(),
        limit
      );

      return {
        success: true,
        data: results,
        message: 'Search completed successfully'
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Search failed',
        error: error.message
      });
    }
  }

  /**
   * Get document processing status
   */
  @Get('documents/:documentId/status')
  async getDocumentStatus(
    @Param('documentId') documentId: string,
    @Req() req: any
  ) {
    try {
      const merchantId = req.user.merchantId;
      const documents = await this.knowledgeBaseService.getMerchantDocuments(merchantId);
      const document = documents.find(d => d.id === documentId);

      if (!document) {
        throw new NotFoundException('Document not found');
      }

      return {
        success: true,
        data: {
          id: document.id,
          status: document.status,
          processedAt: document.processedAt,
          contentSummary: document.contentSummary
        },
        message: 'Document status retrieved successfully'
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException({
        success: false,
        message: 'Failed to get document status',
        error: error.message
      });
    }
  }
} 
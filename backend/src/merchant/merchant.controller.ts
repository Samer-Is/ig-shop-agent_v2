import { Controller, Get, Put, Post, Body, UseGuards, Req, Param, Res } from '@nestjs/common';
import { MerchantService } from './merchant.service';
import { JwtAuthGuard, extractMerchantIdFromRequest } from '../auth/jwt-auth.guard';
import { ProductCatalogItem, BusinessInfo, AISettings } from '../database/merchants.schema';
import { AIService } from '../ai/ai.service';
import { Request, Response } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('api/merchant')
export class MerchantController {
  constructor(
    private readonly merchantService: MerchantService,
    private readonly aiService: AIService,
  ) {}

  @Get('me')
  async getMe(@Req() req: Request) {
    const merchantId = extractMerchantIdFromRequest(req);
    return this.merchantService.getMerchantById(merchantId);
  }

  @Put('product-catalog')
  async updateProductCatalog(@Req() req: Request, @Body() catalog: ProductCatalogItem[]) {
    const merchantId = extractMerchantIdFromRequest(req);
    return this.merchantService.updateProductCatalog(merchantId, catalog);
  }

  @Put('business-info')
  async updateBusinessInfo(@Req() req: Request, @Body() businessInfo: BusinessInfo) {
    const merchantId = extractMerchantIdFromRequest(req);
    return this.merchantService.updateBusinessInfo(merchantId, businessInfo);
  }

  @Put('ai-settings')
  async updateAISettings(@Req() req: Request, @Body() aiSettings: AISettings) {
    const merchantId = extractMerchantIdFromRequest(req);
    return this.merchantService.updateAISettings(merchantId, aiSettings);
  }

  @Post('test-ai')
  async testAIResponse(@Req() req: Request, @Body() body: { message: string }) {
    const merchantId = extractMerchantIdFromRequest(req);
    try {
      const response = await this.aiService.generateResponse(body.message, merchantId);
      return { 
        response: response.reply, 
        confidence: response.confidence || 0.9 
      };
    } catch (error) {
      return { 
        response: 'Sorry, I encountered an error while processing your message.', 
        confidence: 0.0 
      };
    }
  }

  @Get('export/:dataType')
  async exportData(@Req() req: Request, @Param('dataType') dataType: string, @Res() res: Response) {
    const merchantId = extractMerchantIdFromRequest(req);
    
    try {
      const merchant = await this.merchantService.getMerchantById(merchantId);
      let csvData = '';
      let filename = '';

      switch (dataType) {
        case 'products':
          csvData = this.generateProductsCsv(merchant.productCatalog);
          filename = 'product-catalog.csv';
          break;
        case 'business':
          csvData = this.generateBusinessCsv(merchant);
          filename = 'business-info.csv';
          break;
        case 'all':
          csvData = this.generateAllDataCsv(merchant);
          filename = 'all-data.csv';
          break;
        default:
          return res.status(400).json({ error: 'Invalid data type' });
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csvData);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to export data' });
    }
  }

  private generateProductsCsv(products: ProductCatalogItem[]): string {
    const headers = ['ID', 'Name', 'Description', 'Price', 'Currency', 'Stock', 'Category', 'Active'];
    const rows = products.map(p => [
      p.id,
      `"${p.name}"`,
      `"${p.description}"`,
      p.price,
      p.currency,
      p.stock,
      p.category,
      p.isActive
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private generateBusinessCsv(merchant: any): string {
    const data = [
      ['Field', 'Value'],
      ['Business Name', `"${merchant.businessName}"`],
      ['Working Hours', `"${merchant.businessInfo?.workingHours || ''}"`],
      ['Phone', `"${merchant.businessInfo?.phone || ''}"`],
      ['Website', `"${merchant.businessInfo?.website || ''}"`],
      ['Address', `"${merchant.businessInfo?.address || ''}"`],
      ['Description', `"${merchant.businessInfo?.description || ''}"`],
    ];
    
    return data.map(row => row.join(',')).join('\n');
  }

  private generateAllDataCsv(merchant: any): string {
    let csv = 'BUSINESS INFORMATION\n';
    csv += this.generateBusinessCsv(merchant);
    csv += '\n\nPRODUCT CATALOG\n';
    csv += this.generateProductsCsv(merchant.productCatalog);
    return csv;
  }
} 
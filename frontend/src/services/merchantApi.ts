import { apiClient } from '../lib/auth';
import { MerchantData, ProductCatalogItem, BusinessInfo, AISettings } from '../types/merchant';

export class MerchantApiService {
  /**
   * Get current merchant data
   */
  static async getMerchantData(): Promise<MerchantData> {
    const response = await apiClient.get('/api/merchant/me');
    return response.data;
  }

  /**
   * Update product catalog
   */
  static async updateProductCatalog(catalog: ProductCatalogItem[]): Promise<void> {
    await apiClient.put('/api/merchant/product-catalog', catalog);
  }

  /**
   * Update business information
   */
  static async updateBusinessInfo(businessInfo: BusinessInfo): Promise<void> {
    await apiClient.put('/api/merchant/business-info', businessInfo);
  }

  /**
   * Update AI settings
   */
  static async updateAISettings(aiSettings: AISettings): Promise<void> {
    await apiClient.put('/api/merchant/ai-settings', aiSettings);
  }

  /**
   * Test AI response with current configuration
   */
  static async testAIResponse(message: string): Promise<{ response: string; confidence: number }> {
    const response = await apiClient.post('/api/merchant/test-ai', { message });
    return response.data;
  }

  /**
   * Export data as CSV
   */
  static async exportData(dataType: 'products' | 'business' | 'all'): Promise<Blob> {
    const response = await apiClient.get(`/api/merchant/export/${dataType}`, {
      responseType: 'blob',
    });
    return response.data;
  }
} 
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CosmosService } from '../database/cosmos.service';
import { Merchant, ProductCatalogItem, BusinessInfo, AISettings } from '../database/merchants.schema';

@Injectable()
export class MerchantService {
  constructor(private readonly cosmosService: CosmosService) {}

  async getMerchantById(merchantId: string): Promise<Merchant> {
    const container = this.cosmosService.getMerchantsContainer();
    const { resource } = await container.item(merchantId, merchantId).read<Merchant>();
    if (!resource) throw new NotFoundException('Merchant not found');
    return resource;
  }

  async updateProductCatalog(merchantId: string, catalog: ProductCatalogItem[]): Promise<Merchant> {
    const merchant = await this.getMerchantById(merchantId);
    merchant.productCatalog = catalog;
    merchant.updatedAt = new Date().toISOString();
    const container = this.cosmosService.getMerchantsContainer();
    await container.items.upsert(merchant);
    return merchant;
  }

  async updateBusinessInfo(merchantId: string, businessInfo: BusinessInfo): Promise<Merchant> {
    const merchant = await this.getMerchantById(merchantId);
    merchant.businessInfo = businessInfo;
    merchant.updatedAt = new Date().toISOString();
    const container = this.cosmosService.getMerchantsContainer();
    await container.items.upsert(merchant);
    return merchant;
  }

  async updateAISettings(merchantId: string, aiSettings: AISettings): Promise<Merchant> {
    const merchant = await this.getMerchantById(merchantId);
    merchant.aiSettings = aiSettings;
    merchant.updatedAt = new Date().toISOString();
    const container = this.cosmosService.getMerchantsContainer();
    await container.items.upsert(merchant);
    return merchant;
  }
} 
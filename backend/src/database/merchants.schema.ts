import { Document } from 'mongoose';

/**
 * Merchant document schema for Cosmos DB
 */
export interface Merchant extends Document {
  id: string; // Cosmos DB document id
  pageId: string; // Instagram page id
  instagramUserId: string;
  businessName: string;
  email: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
  subscriptionTier: 'basic' | 'pro' | 'enterprise';
  instagramAccessTokenSecretUri: string; // Azure Key Vault secret URI
  productCatalog: ProductCatalogItem[];
  businessInfo: BusinessInfo;
  aiSettings: AISettings;
}

export interface ProductCatalogItem {
  id: string;
  name: string;
  description: string;
  rules?: string;
  mediaLinks?: string[];
  price?: number;
  stock?: number;
}

export interface BusinessInfo {
  workingHours: string;
  termsAndConditions: string;
  rules?: string;
}

export interface AISettings {
  customPrompt: string;
} 
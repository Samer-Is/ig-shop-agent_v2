export interface ProductCatalogItem {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  stock: number;
  category: string;
  imageUrl?: string;
  mediaLinks: string[];
  rules?: string;
  isActive: boolean;
}

export interface BusinessInfo {
  workingHours: string;
  termsAndConditions: string;
  rules?: string;
  address?: string;
  phone?: string;
  website?: string;
  description?: string;
}

export interface AISettings {
  customPrompt: string;
  responseStyle?: 'professional' | 'friendly' | 'casual';
  maxResponseLength?: number;
  enableVoiceTranscription?: boolean;
  enableIntentDetection?: boolean;
  fallbackMessage?: string;
}

export interface MerchantData {
  id: string;
  pageId: string;
  instagramUserId: string;
  businessName: string;
  email: string;
  subscriptionTier: 'basic' | 'pro' | 'enterprise';
  createdAt: string;
  updatedAt: string;
  productCatalog: ProductCatalogItem[];
  businessInfo: BusinessInfo;
  aiSettings: AISettings;
} 
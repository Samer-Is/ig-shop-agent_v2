export interface ConversationMessage {
  id: string;
  conversationId: string;
  merchantId: string;
  pageId: string;
  senderId: string;
  senderType: 'customer' | 'ai' | 'human';
  messageText: string;
  messageType: 'text' | 'audio' | 'image' | 'video';
  timestamp: Date;
  
  // AI Analysis Data
  sentiment?: SentimentAnalysis;
  intent?: IntentClassification;
  confidence?: number;
  languageDetected?: 'en' | 'ar' | 'mixed';
  
  // Audio-specific data
  audioUrl?: string;
  transcription?: string;
  transcriptionConfidence?: number;
  
  // Response data for AI messages
  responseTime?: number;
  tokensUsed?: number;
  modelUsed?: string;
  
  // Handover data
  handoverRequested?: boolean;
  handoverReason?: string;
  handoverTimestamp?: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface SentimentAnalysis {
  overall: 'positive' | 'neutral' | 'negative';
  confidence: number;
  emotions: {
    joy?: number;
    anger?: number;
    sadness?: number;
    fear?: number;
    surprise?: number;
    disgust?: number;
  };
  intensity: 'low' | 'medium' | 'high';
  requiresHumanHandover: boolean;
}

export interface IntentClassification {
  primary: IntentType;
  confidence: number;
  entities?: ExtractedEntity[];
  subIntents?: IntentType[];
}

export type IntentType = 
  | 'greeting'
  | 'product_inquiry'
  | 'price_inquiry'
  | 'stock_check'
  | 'order_placement'
  | 'order_status'
  | 'shipping_question'
  | 'return_request'
  | 'complaint'
  | 'compliment'
  | 'support_request'
  | 'business_hours'
  | 'contact_info'
  | 'goodbye'
  | 'other';

export interface ExtractedEntity {
  type: 'product_name' | 'quantity' | 'color' | 'size' | 'price' | 'phone' | 'address' | 'name';
  value: string;
  confidence: number;
  startIndex?: number;
  endIndex?: number;
}

export interface Conversation {
  id: string;
  merchantId: string;
  pageId: string;
  customerId: string;
  status: 'active' | 'resolved' | 'escalated' | 'abandoned';
  
  // Conversation metadata
  startTime: Date;
  lastActivity: Date;
  messageCount: number;
  
  // AI performance metrics
  averageResponseTime?: number;
  averageSentiment?: number;
  primaryIntents: IntentType[];
  
  // Handover tracking
  isHandedOver: boolean;
  handoverTime?: Date;
  handoverReason?: string;
  humanAgentId?: string;
  
  // Analytics data
  totalTokensUsed?: number;
  aiMessagesCount: number;
  humanMessagesCount: number;
  
  // Resolution data
  resolvedAt?: Date;
  resolutionType?: 'ai_resolved' | 'human_resolved' | 'customer_left';
  customerSatisfaction?: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Database container partition key: merchantId
export const ConversationPartitionKey = '/merchantId'; 
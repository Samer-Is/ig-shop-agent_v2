export interface Order {
  id: string;
  merchantId: string;
  pageId: string;
  customerId: string;
  conversationId: string;
  
  // Order status and workflow
  status: OrderStatus;
  orderNumber: string;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  
  // Customer information
  customer: CustomerInfo;
  
  // Product information
  items: OrderItem[];
  
  // Pricing and totals
  subtotal: number;
  tax?: number;
  shipping?: number;
  discount?: number;
  total: number;
  currency: string;
  
  // Order details
  shippingAddress?: Address;
  billingAddress?: Address;
  notes?: string;
  specialInstructions?: string;
  
  // AI extraction metadata
  extractionConfidence: number;
  extractionMethod: 'ai_automatic' | 'ai_assisted' | 'manual';
  missingFields: string[];
  clarificationAttempts: number;
  
  // Tracking and fulfillment
  trackingNumber?: string;
  estimatedDelivery?: Date;
  fulfillmentStatus?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'returned';
  
  // Analytics
  orderSource: 'instagram_dm' | 'voice_message' | 'manual';
  deviceType?: 'mobile' | 'desktop';
  sessionId?: string;
}

export type OrderStatus = 
  | 'pending_confirmation'    // AI extracted order, waiting for merchant confirmation
  | 'pending_payment'         // Confirmed but payment pending
  | 'confirmed'              // Order confirmed and payment received
  | 'processing'             // Order being prepared
  | 'shipped'                // Order shipped
  | 'delivered'              // Order delivered
  | 'cancelled'              // Order cancelled
  | 'refunded'               // Order refunded
  | 'incomplete';            // Missing required information

export interface CustomerInfo {
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  instagramId: string;
  
  // Communication preferences
  preferredLanguage?: 'en' | 'ar';
  timezone?: string;
  
  // Customer verification
  isVerified: boolean;
  verificationMethod?: 'phone' | 'email' | 'instagram';
}

export interface OrderItem {
  id: string;
  productName: string;
  productId?: string; // Reference to merchant's product catalog
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  
  // Product variants
  size?: string;
  color?: string;
  variant?: string;
  sku?: string;
  
  // Product details
  description?: string;
  imageUrl?: string;
  
  // Availability and stock
  isAvailable: boolean;
  stockLevel?: number;
  
  // AI extraction metadata
  extractionConfidence: number;
  extractedFromText: string;
  alternativeOptions?: string[]; // If exact product not found
}

export interface Address {
  street: string;
  street2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  
  // Address validation
  isValidated: boolean;
  validationMethod?: 'google_maps' | 'postal_service' | 'manual';
  
  // Delivery instructions
  deliveryInstructions?: string;
  landmarks?: string;
  buildingInfo?: string;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  status: OrderStatus;
  timestamp: Date;
  changedBy: 'system' | 'merchant' | 'customer' | 'ai';
  reason?: string;
  notes?: string;
}

export interface OrderExtraction {
  orderId: string;
  messageId: string;
  extractedData: {
    products: ExtractedProduct[];
    customer: ExtractedCustomerData;
    shipping: ExtractedShippingData;
    intent: 'order_placement' | 'order_inquiry' | 'order_modification';
  };
  confidence: number;
  missingFields: string[];
  clarificationNeeded: boolean;
  extractionTimestamp: Date;
}

export interface ExtractedProduct {
  name: string;
  quantity: number;
  confidence: number;
  
  // Optional attributes
  size?: string;
  color?: string;
  variant?: string;
  
  // Matching to catalog
  matchedProductId?: string;
  catalogMatches: Array<{
    productId: string;
    productName: string;
    similarity: number;
  }>;
  
  // Extraction context
  extractedFromText: string;
  contextSentence: string;
}

export interface ExtractedCustomerData {
  name?: {
    value: string;
    confidence: number;
  };
  phone?: {
    value: string;
    confidence: number;
    isValid: boolean;
  };
  address?: {
    value: string;
    confidence: number;
    isParseable: boolean;
  };
}

export interface ExtractedShippingData {
  address?: {
    raw: string;
    parsed?: Address;
    confidence: number;
  };
  deliveryInstructions?: {
    value: string;
    confidence: number;
  };
  urgency?: {
    level: 'standard' | 'urgent' | 'asap';
    confidence: number;
  };
}

// Order validation and business rules
export interface OrderValidationResult {
  isValid: boolean;
  errors: OrderValidationError[];
  warnings: OrderValidationWarning[];
  completeness: number; // 0-100% how complete the order is
}

export interface OrderValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  canAutoFix: boolean;
  suggestedFix?: string;
}

export interface OrderValidationWarning {
  field: string;
  message: string;
  recommendation: string;
}

// For order analytics and reporting
export interface OrderMetrics {
  merchantId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  
  // Volume metrics
  totalOrders: number;
  confirmedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  
  // Value metrics
  totalRevenue: number;
  averageOrderValue: number;
  
  // AI performance metrics
  aiExtractionAccuracy: number;
  averageExtractionConfidence: number;
  clarificationRate: number; // % of orders requiring clarification
  
  // Fulfillment metrics
  averageProcessingTime: number; // in hours
  onTimeDeliveryRate: number;
  
  // Top products and categories
  topProducts: Array<{
    productName: string;
    quantity: number;
    revenue: number;
  }>;
}

// Database container partition key: merchantId
export const OrderPartitionKey = '/merchantId'; 
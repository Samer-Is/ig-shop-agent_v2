# Technical Specifications - Instagram AI Agent SaaS Platform

## Architecture Patterns

### Modular Monolith with Service-Oriented Design
- **Separation of Concerns**: Each service handles a single business domain
- **Dependency Injection**: Use NestJS IoC container for all dependencies
- **Interface Segregation**: Define clear contracts between services
- **Domain-Driven Design**: Organize code by business domains

### Data Access Patterns
- **Repository Pattern**: Abstract data access layer for Cosmos DB
- **Unit of Work**: Ensure transactional consistency across operations
- **Query Builders**: Type-safe query construction for complex searches
- **Connection Pooling**: Optimize database connections

## Technology Stack Implementation

### Backend Framework: NestJS + TypeScript
```typescript
// Core structure
src/
├── common/           // Shared utilities, decorators, filters
├── config/          // Environment configuration
├── modules/         // Feature modules
│   ├── auth/        // Authentication & authorization
│   ├── merchants/   // Merchant management
│   ├── ai/         // AI conversation engine
│   ├── orders/     // Order management
│   ├── webhooks/   // Instagram webhook handling
│   └── billing/    // Subscription & billing
├── database/        // Database entities and repositories
├── external/        // External API integrations
└── main.ts         // Application bootstrap
```

### Key Libraries & Dependencies
```json
{
  "dependencies": {
    "@nestjs/core": "^10.0.0",
    "@nestjs/common": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/jwt": "^10.0.0",
    "@nestjs/passport": "^10.0.0",
    "@azure/cosmos": "^4.0.0",
    "@azure/keyvault-secrets": "^4.7.0",
    "@azure/storage-blob": "^12.17.0",
    "openai": "^4.0.0",
    "stripe": "^14.0.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1"
  }
}
```

## Data Models & Schemas

### Cosmos DB Container Schemas

#### Merchants Container
```typescript
interface MerchantDocument {
  id: string;                    // Unique merchant ID
  partitionKey: string;          // Tenant isolation
  instagramPageId: string;       // Instagram Business Page ID
  businessName: string;
  email: string;
  subscriptionTier: 'basic' | 'pro' | 'enterprise';
  conversationCount: number;     // Current billing cycle count
  
  // Instagram Integration
  accessToken: {
    keyVaultSecretUri: string;   // Reference to encrypted token
    expiresAt: Date;
  };
  
  // Business Configuration
  productCatalog: ProductItem[];
  businessInfo: {
    workingHours: string;
    termsAndConditions: string;
    businessRules: string;
  };
  
  // AI Configuration
  aiSettings: {
    customPrompt: string;
    responseLanguage: 'auto' | 'en' | 'ar';
    sentimentThreshold: number;
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

interface ProductItem {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  stock: number;
  mediaUrls: string[];
  rules: string;
}
```

#### Orders Container
```typescript
interface OrderDocument {
  id: string;
  partitionKey: string;          // merchantId for tenant isolation
  merchantId: string;
  instagramUserId: string;
  
  // Order Details
  products: OrderProduct[];
  totalAmount: number;
  currency: string;
  status: 'pending_confirmation' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  
  // Customer Information
  customerInfo: {
    name: string;
    phoneNumber: string;
    address: string;
    instagramHandle: string;
  };
  
  // AI Extraction Metadata
  extractionConfidence: number;
  conversationId: string;
  
  // Timestamps
  createdAt: Date;
  confirmedAt?: Date;
  shippedAt?: Date;
}

interface OrderProduct {
  productId: string;
  name: string;
  quantity: number;
  size?: string;
  color?: string;
  unitPrice: number;
}
```

#### Conversations Container
```typescript
interface ConversationDocument {
  id: string;                    // conversationId
  partitionKey: string;          // merchantId
  merchantId: string;
  instagramUserId: string;
  
  // Conversation State
  messages: ConversationMessage[];
  currentIntent: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'angry';
  requiresHumanHandover: boolean;
  
  // Analytics
  totalMessages: number;
  lastActivity: Date;
  averageResponseTime: number;
  
  // Order Tracking
  pendingOrderData?: Partial<OrderDocument>;
  
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationMessage {
  id: string;
  sender: 'customer' | 'ai' | 'human';
  content: string;
  messageType: 'text' | 'image' | 'audio' | 'sticker';
  timestamp: Date;
  
  // AI Analysis
  intent?: string;
  entities?: ExtractedEntity[];
  sentiment?: string;
  confidence?: number;
}
```

## API Design Standards

### RESTful Endpoint Conventions
```typescript
// Authentication & Onboarding
POST   /api/v1/auth/onboard              // Instagram OAuth callback
POST   /api/v1/auth/refresh              // Refresh access token
DELETE /api/v1/auth/logout               // Logout merchant

// Merchant Management
GET    /api/v1/merchants/profile         // Get merchant profile
PUT    /api/v1/merchants/profile         // Update merchant profile
GET    /api/v1/merchants/analytics       // Get merchant analytics

// Product Catalog
GET    /api/v1/merchants/products        // List products
POST   /api/v1/merchants/products        // Create product
PUT    /api/v1/merchants/products/:id    // Update product
DELETE /api/v1/merchants/products/:id    // Delete product

// Orders Management
GET    /api/v1/merchants/orders          // List orders (with pagination)
PUT    /api/v1/merchants/orders/:id      // Update order status
GET    /api/v1/merchants/orders/export   // Export orders as CSV

// AI Configuration
GET    /api/v1/merchants/ai-settings     // Get AI configuration
PUT    /api/v1/merchants/ai-settings     // Update AI configuration
POST   /api/v1/merchants/ai-test         // Test AI response

// Webhooks
POST   /api/v1/webhooks/instagram        // Instagram webhook receiver
GET    /api/v1/webhooks/instagram        // Webhook verification

// Vendor Admin (Separate auth scope)
GET    /api/v1/admin/merchants           // List all merchants
POST   /api/v1/admin/whitelist           // Manage whitelist
GET    /api/v1/admin/analytics           // Platform-wide analytics
```

### Request/Response Standards
```typescript
// Standard API Response Format
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
  };
}

// Error Handling
enum ErrorCodes {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}
```

## Security Implementation

### Authentication & Authorization
```typescript
// JWT Token Structure
interface JwtPayload {
  sub: string;                   // Merchant ID
  iat: number;                   // Issued at
  exp: number;                   // Expires at
  scope: string[];               // Permissions
  tier: string;                  // Subscription tier
}

// Authorization Decorator
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@RequireSubscription('pro')
export class AdvancedFeaturesController {
  // Pro/Enterprise only features
}
```

### Data Encryption
- **Secrets Management**: All sensitive data in Azure Key Vault
- **Transport Security**: TLS 1.3 for all communications
- **Data at Rest**: Cosmos DB encryption enabled
- **Access Tokens**: Encrypted before storage, rotated regularly

## Performance Optimization

### Caching Strategy
```typescript
// Redis Caching for Frequent Operations
@Injectable()
export class CacheService {
  // Merchant profile cache (TTL: 1 hour)
  async getMerchantProfile(merchantId: string): Promise<MerchantDocument>
  
  // AI context cache (TTL: 24 hours)
  async getAiContext(merchantId: string): Promise<AiContext>
  
  // Product catalog cache (TTL: 6 hours)
  async getProductCatalog(merchantId: string): Promise<ProductItem[]>
}
```

### Database Optimization
- **Partition Strategy**: Use merchantId as partition key for tenant isolation
- **Indexing**: Composite indices on frequently queried fields
- **Query Optimization**: Minimize cross-partition queries
- **Connection Pooling**: Optimize database connection usage

## AI Integration Patterns

### GPT-4o Integration
```typescript
interface AiPromptTemplate {
  system: string;                // System instructions
  context: {
    merchant: MerchantContext;
    conversation: ConversationContext;
    products: ProductItem[];
  };
  userMessage: string;
}

interface AiResponse {
  message: string;
  intent: string;
  entities: ExtractedEntity[];
  sentiment: string;
  confidence: number;
  requiresHandover: boolean;
  suggestedActions: string[];
}
```

### RAG Implementation
```typescript
// Knowledge Base Query
interface KnowledgeQuery {
  merchantId: string;
  query: string;
  maxResults: number;
  threshold: number;
}

// Azure Cognitive Search Integration
@Injectable()
export class KnowledgeBaseService {
  async search(query: KnowledgeQuery): Promise<SearchResult[]>
  async indexDocument(merchantId: string, document: Document): Promise<void>
}
```

## Testing Strategy

### Unit Testing
- **Coverage Target**: Minimum 80% code coverage
- **Test Structure**: AAA pattern (Arrange, Act, Assert)
- **Mocking**: Use Jest mocks for external dependencies
- **Test Data**: Factory pattern for test data generation

### Integration Testing
- **Database Testing**: Use Cosmos DB emulator for local testing
- **API Testing**: Supertest for endpoint testing
- **External API Mocking**: Mock Instagram and OpenAI APIs

### End-to-End Testing
- **User Flows**: Critical business process testing
- **Load Testing**: Performance testing with realistic data volumes
- **Security Testing**: Penetration testing and vulnerability scanning

## Deployment & DevOps

### Environment Configuration
```typescript
// Environment-specific settings
interface AppConfig {
  NODE_ENV: 'development' | 'staging' | 'production';
  PORT: number;
  
  // Database
  COSMOS_DB_ENDPOINT: string;
  COSMOS_DB_KEY: string;
  
  // External APIs
  OPENAI_API_KEY: string;
  FACEBOOK_APP_ID: string;
  FACEBOOK_APP_SECRET: string;
  
  // Azure Services
  KEY_VAULT_URL: string;
  BLOB_STORAGE_CONNECTION_STRING: string;
  COGNITIVE_SEARCH_ENDPOINT: string;
}
```

### CI/CD Pipeline Requirements
1. **Code Quality**: ESLint, Prettier, TypeScript compiler
2. **Testing**: Unit, integration, and E2E test execution
3. **Security**: Dependency vulnerability scanning
4. **Performance**: Bundle size analysis and optimization
5. **Deployment**: Blue-green deployment strategy for zero downtime

## Monitoring & Observability

### Logging Standards
```typescript
// Structured logging with correlation IDs
interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  correlationId: string;
  merchantId?: string;
  userId?: string;
  component: string;
  message: string;
  metadata?: any;
}
```

### Key Metrics
- **Business**: Conversion rates, average order value, customer satisfaction
- **Technical**: Response times, error rates, throughput
- **Infrastructure**: CPU/memory usage, database performance
- **AI**: Model accuracy, response quality, processing time

## Compliance & Data Protection

### GDPR Compliance
- **Data Minimization**: Collect only necessary customer data
- **Right to Erasure**: Implement data deletion capabilities
- **Data Portability**: Provide data export functionality
- **Consent Management**: Clear consent mechanisms for data processing

### Instagram API Compliance
- **Rate Limiting**: Respect Instagram API rate limits
- **Data Usage**: Comply with Instagram's data usage policies
- **User Privacy**: Implement proper user consent flows
- **Content Guidelines**: Ensure AI responses follow Instagram community guidelines 

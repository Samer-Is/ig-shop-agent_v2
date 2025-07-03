# AI Module

This module implements the core AI conversation engine using RAG (Retrieval-Augmented Generation) with GPT-4o to provide context-aware responses for Instagram messages.

## Overview

The AI module processes incoming Instagram messages by retrieving merchant-specific context and generating intelligent, personalized responses using OpenAI's GPT-4o model.

## Components

### AIService (`ai.service.ts`)
**Core AI processing with RAG logic**

- **Context Retrieval**: Fetches merchant data (product catalog, business info, AI settings) from Cosmos DB
- **Language Detection**: Identifies Arabic, English, or mixed language usage in customer messages  
- **System Prompt Construction**: Builds detailed prompts with merchant context for GPT-4o
- **Response Generation**: Calls OpenAI API with constructed prompts and handles responses
- **Intent Detection**: Basic classification of customer intents (greeting, inquiry, order, support)

### InstagramGraphService (`instagram-graph.service.ts`)  
**Instagram Graph API integration**

- **Message Sending**: Sends AI-generated replies to Instagram users
- **Token Validation**: Verifies access token validity before API calls
- **24-Hour Window**: Ensures compliance with Instagram's messaging policies
- **Error Handling**: Comprehensive handling of Instagram API errors and rate limits

## AI Response Flow

1. **Message Receipt**: Webhook receives Instagram message
2. **Context Retrieval**: Look up merchant by Instagram page ID
3. **Language Detection**: Analyze customer message language
4. **Prompt Construction**: Build system prompt with merchant context
5. **AI Generation**: Send to GPT-4o and receive response
6. **Reply Delivery**: Send response via Instagram Graph API

## Language Support

### Bilingual Processing
- **English**: Standard business English with professional tone
- **Arabic**: Jordanian dialect support with cultural sensitivity
- **Mixed**: Handles code-switching between Arabic and English

### Language Detection Algorithm
```typescript
// Detects based on character frequency analysis
const arabicRatio = arabicCharacters / totalCharacters;
const englishRatio = englishCharacters / totalCharacters;

if (arabicRatio > 0.3) return englishRatio > 0.2 ? 'mixed' : 'ar';
if (englishRatio > 0.3) return 'en';
return 'mixed';
```

## System Prompt Structure

The AI system prompt includes:

1. **Business Identity**: Merchant name and role definition
2. **Language Instructions**: Response language based on detection
3. **Business Information**: Hours, rules, terms & conditions
4. **Product Catalog**: Complete product listings with details
5. **Custom Instructions**: Merchant-specific AI behavior settings
6. **Response Guidelines**: Professional standards and limitations

## Merchant Context Integration

### Product Catalog
```typescript
interface ProductCatalogItem {
  name: string;
  description: string;
  price?: number;
  stock?: number;
  rules?: string;
  mediaLinks?: string[];
}
```

### Business Information
```typescript
interface BusinessInfo {
  businessName?: string;
  workingHours?: string;
  termsAndConditions?: string;
  rules?: string;
}
```

### AI Settings
```typescript
interface AISettings {
  customPrompt?: string;
  tone?: 'professional' | 'friendly' | 'casual';
  language?: 'en' | 'ar' | 'auto';
}
```

## Error Handling & Fallbacks

### AI Service Failures
- **Network Issues**: Retry logic with exponential backoff
- **API Errors**: Graceful degradation with fallback responses
- **Invalid Responses**: Validation and error recovery

### Fallback Messages
- **English**: "Sorry, I'm experiencing technical difficulties. Please try again or contact us directly."
- **Arabic**: "أعتذر، يبدو أن هناك مشكلة فنية. يرجى المحاولة مرة أخرى أو التواصل معنا مباشرة."

## Security Features

### Access Token Management
- **Key Vault Integration**: Secure storage and retrieval of Instagram access tokens
- **Token Validation**: Verify tokens before API calls
- **Automatic Cleanup**: Handle expired or invalid tokens

### API Security
- **Rate Limiting**: Respect OpenAI and Instagram API limits
- **Request Validation**: Validate all incoming data
- **Error Sanitization**: Prevent sensitive data leakage in logs

## Performance Optimizations

### Caching Strategy
- **Merchant Context**: Cache retrieved merchant data for short periods
- **Token Validation**: Cache validation results to reduce API calls
- **Response Templates**: Cache common response patterns

### Resource Management
- **Connection Pooling**: Efficient HTTP connection management
- **Timeout Handling**: Appropriate timeouts for external API calls
- **Memory Management**: Efficient handling of large product catalogs

## Integration Points

### Database Layer
- **Cosmos DB**: Merchant data retrieval with optimized queries
- **Container Access**: Direct access to merchants container

### External APIs
- **OpenAI GPT-4o**: AI response generation
- **Instagram Graph API**: Message delivery
- **Azure Key Vault**: Secure credential storage

## Monitoring & Analytics

### Logging
- **Conversation Flow**: Track complete message processing pipeline
- **AI Performance**: Response quality and generation time
- **Error Tracking**: Comprehensive error logging and categorization

### Metrics
- **Response Time**: AI generation and delivery timing
- **Success Rates**: Message delivery and processing success
- **Language Distribution**: Usage patterns by language

## Future Enhancements (Planned)

### Phase 4 Features
- **Sentiment Analysis**: Enhanced emotion detection and response adaptation
- **Advanced Intent Recognition**: More sophisticated intent classification
- **Voice Message Support**: Audio transcription and processing

### Phase 5 Features  
- **Order Entity Extraction**: Structured data extraction from conversations
- **Order Management Integration**: Direct order creation from conversations

## Testing

### Unit Tests
- **Language Detection**: Test accuracy across various text samples
- **Prompt Construction**: Validate system prompt generation
- **Error Handling**: Test failure scenarios and recovery

### Integration Tests
- **End-to-End Flow**: Complete webhook to Instagram delivery
- **API Integration**: OpenAI and Instagram API interactions
- **Database Operations**: Merchant data retrieval and caching

## Configuration

### Environment Variables
```bash
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4o

# Instagram API Configuration  
INSTAGRAM_API_VERSION=v18.0

# Azure Services
KEY_VAULT_URL=https://your-keyvault.vault.azure.net/
```

### Model Parameters
- **Model**: GPT-4o (OpenAI's most capable model)
- **Max Tokens**: 500 (optimal for Instagram message responses)
- **Temperature**: 0.7 (balanced creativity and consistency)
- **Top P**: 0.9 (focused but diverse responses) 

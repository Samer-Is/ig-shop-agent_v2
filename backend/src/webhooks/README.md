# Webhooks Module

This module handles Instagram webhook events to receive real-time messages and process them with AI.

## Overview

The webhooks module implements the Instagram Graph API webhook integration to receive real-time updates when users send messages to connected Instagram business pages.

## Components

### WebhookService (`webhook.service.ts`)
- **Signature Verification**: Validates webhook requests using HMAC SHA256
- **Event Processing**: Parses Instagram webhook payloads and extracts message content
- **Security**: Implements timing-safe signature comparison to prevent attacks

### WebhookController (`webhook.controller.ts`)
- **GET /api/webhooks/instagram**: Handles webhook verification challenge
- **POST /api/webhooks/instagram**: Receives and processes Instagram message events
- **GET /api/webhooks/instagram/health**: Health check endpoint

## Webhook Setup

### 1. Meta App Configuration
Configure your Facebook App to send webhooks to:
```
https://your-domain.com/api/webhooks/instagram
```

### 2. Verification Token
Set the webhook verify token in your environment:
```bash
WEBHOOK_VERIFY_TOKEN=instagram-webhook-verify-token-2024
```

### 3. Webhook Subscription
Subscribe to these webhook fields in your Meta App:
- `messages`
- `messaging_postbacks`
- `message_deliveries`
- `message_reads`

## Event Flow

1. **User sends message** to Instagram business page
2. **Meta sends webhook** to `POST /api/webhooks/instagram`
3. **Signature verification** ensures request authenticity
4. **Event processing** extracts message data
5. **AI processing** (Phase 2 Task 2.2) generates response
6. **Reply sent** via Instagram Graph API (Phase 2 Task 2.4)

## Webhook Event Structure

```typescript
interface InstagramWebhookEvent {
  object: 'instagram';
  entry: Array<{
    id: string; // Instagram page ID
    time: number;
    messaging: Array<{
      sender: { id: string }; // User IGSID
      recipient: { id: string }; // Page IGSID
      timestamp: number;
      message: {
        mid: string; // Message ID
        text?: string; // Message text
        attachments?: Array<{
          type: string;
          payload: {
            url?: string;
            sticker_id?: string;
          };
        }>;
      };
    }>;
  }>;
}
```

## Security Features

- **HMAC SHA256 Verification**: All webhook requests are verified using Facebook app secret
- **Timing-Safe Comparison**: Prevents timing attacks on signature verification
- **Request Validation**: Validates required headers and payload structure

## Error Handling

- **Invalid Signature**: Returns 400 Bad Request
- **Missing Parameters**: Returns 400 Bad Request with specific error message
- **Processing Errors**: Logs errors and returns appropriate HTTP status

## Logging

The module provides comprehensive logging:
- Webhook verification attempts
- Message reception events
- Processing success/failure
- Security violations

## Next Steps (Phase 2)

- **Task 2.2**: Implement AI response generation using merchant context
- **Task 2.3**: Integrate with Azure OpenAI GPT-4o
- **Task 2.4**: Send replies via Instagram Graph API

## Testing

Use the health check endpoint to verify webhook availability:
```bash
curl https://your-domain.com/api/webhooks/instagram/health
```

For webhook testing, use Meta's webhook testing tool in the App Dashboard. 

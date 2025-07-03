import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AIService, MessageContext } from '../ai';
import { InstagramGraphService } from '../ai/instagram-graph.service';
import { SpeechService, TranscriptionResult } from '../ai/speech.service';
import { KeyVaultService } from '../azure';

export interface InstagramWebhookEvent {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    messaging?: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
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

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly appSecret: string;

  constructor(
    private configService: ConfigService,
    private aiService: AIService,
    private instagramGraphService: InstagramGraphService,
    private speechService: SpeechService,
    private keyVaultService: KeyVaultService,
  ) {
    this.appSecret = this.configService.get<string>('facebook.appSecret');
  }

  /**
   * Verify webhook request signature
   * Meta requires webhook verification to ensure requests are authentic
   */
  verifySignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.appSecret)
        .update(payload)
        .digest('hex');

      const formattedSignature = `sha256=${expectedSignature}`;
      
      // Use crypto.timingSafeEqual to prevent timing attacks
      const sigBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(formattedSignature);
      
      if (sigBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch (error) {
      this.logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Handle webhook verification challenge
   * Meta sends a GET request with a challenge that must be echoed back
   */
  handleVerification(mode: string, token: string, challenge: string): string {
    const verifyToken = this.configService.get<string>('webhooks.verifyToken');
    
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verification successful');
      return challenge;
    }
    
    this.logger.error('Webhook verification failed - invalid token or mode');
    throw new BadRequestException('Webhook verification failed');
  }

  /**
   * Process incoming Instagram webhook events
   */
  async processWebhookEvent(event: InstagramWebhookEvent): Promise<void> {
    try {
      this.logger.debug('Processing webhook event:', JSON.stringify(event, null, 2));

      if (event.object !== 'instagram') {
        this.logger.warn(`Unexpected webhook object type: ${event.object}`);
        return;
      }

      for (const entry of event.entry) {
        if (!entry.messaging) {
          this.logger.debug('Entry has no messaging array, skipping');
          continue;
        }

        for (const messagingEvent of entry.messaging) {
          await this.processMessage(entry.id, messagingEvent);
        }
      }
    } catch (error) {
      this.logger.error('Error processing webhook event:', error);
      throw error;
    }
  }

  /**
   * Process individual message from webhook
   */
  private async processMessage(pageId: string, messagingEvent: any): Promise<void> {
    try {
      const { sender, recipient, message, timestamp } = messagingEvent;

      if (!message) {
        this.logger.debug('No message content, skipping');
        return;
      }

      // Extract message content
      const messageData = {
        pageId,
        senderId: sender.id,
        recipientId: recipient.id,
        messageId: message.mid,
        timestamp: new Date(timestamp),
        text: message.text || null,
        attachments: message.attachments || [],
      };

      this.logger.log(`New message received:`, {
        pageId: messageData.pageId,
        senderId: messageData.senderId,
        messagePreview: messageData.text?.substring(0, 50) + '...',
        hasAttachments: messageData.attachments.length > 0,
        attachmentTypes: messageData.attachments.map(a => a.type),
      });

      // Check for audio attachments and handle accordingly
      const audioAttachment = this.extractAudioAttachment(messageData.attachments);
      if (audioAttachment) {
        await this.processAudioMessage(messageData, audioAttachment);
      } else if (messageData.text) {
        await this.processTextMessage(messageData);
      } else {
        this.logger.debug('No text or audio content to process');
        await this.sendGenericResponse(pageId, sender.id, 'unsupported_content');
      }
    } catch (error) {
      this.logger.error('Error processing individual message:', error);
      throw error;
    }
  }

  /**
   * Extract audio attachment from message attachments
   */
  private extractAudioAttachment(attachments: any[]): any | null {
    return attachments.find(attachment => 
      attachment.type === 'audio' && attachment.payload?.url
    ) || null;
  }

  /**
   * Process audio message with transcription
   */
  private async processAudioMessage(messageData: any, audioAttachment: any): Promise<void> {
    try {
      const { pageId, senderId } = messageData;
      const audioUrl = audioAttachment.payload.url;

      this.logger.log(`Processing audio message from ${senderId} for page ${pageId}`);

      // Validate audio file
      const validation = await this.speechService.validateAudioFile(audioUrl);
      if (!validation.isValid) {
        this.logger.warn(`Invalid audio file: ${validation.reason}`);
        await this.sendGenericResponse(pageId, senderId, 'audio_validation_failed');
        return;
      }

      // Check if transcription is enabled for merchant
      const isTranscriptionEnabled = await this.speechService.isTranscriptionEnabled(pageId);
      if (!isTranscriptionEnabled) {
        this.logger.warn(`Audio transcription not enabled for page ${pageId}`);
        await this.sendGenericResponse(pageId, senderId, 'transcription_not_available');
        return;
      }

      // Transcribe audio
      this.logger.log(`Starting audio transcription for ${audioUrl}`);
      const transcription: TranscriptionResult = await this.speechService.transcribeAudio(audioUrl);

      if (transcription.confidence < 0.3) {
        this.logger.warn(`Low confidence transcription: ${transcription.confidence}`);
        await this.sendGenericResponse(pageId, senderId, 'transcription_unclear');
        return;
      }

      this.logger.log(`Audio transcribed successfully`, {
        confidence: transcription.confidence,
        language: transcription.language,
        wordCount: transcription.wordCount,
        textPreview: transcription.text.substring(0, 50) + '...'
      });

      // Process transcribed text with AI
      const messageContext: MessageContext = {
        pageId,
        senderId: messageData.senderId,
        messageText: transcription.text,
        timestamp: messageData.timestamp,
      };

      await this.processMessageWithAI(messageContext, {
        messageType: 'audio',
        audioUrl,
        transcription: transcription.text,
        transcriptionConfidence: transcription.confidence,
        duration: transcription.duration
      });

    } catch (error) {
      this.logger.error('Error processing audio message:', error);
      await this.sendGenericResponse(messageData.pageId, messageData.senderId, 'audio_processing_error');
    }
  }

  /**
   * Process text message
   */
  private async processTextMessage(messageData: any): Promise<void> {
    const messageContext: MessageContext = {
      pageId: messageData.pageId,
      senderId: messageData.senderId,
      messageText: messageData.text,
      timestamp: messageData.timestamp,
    };

    await this.processMessageWithAI(messageContext, {
      messageType: 'text'
    });
  }

  /**
   * Process message with AI and send response - Enhanced for Phase 4
   */
  private async processMessageWithAI(
    messageContext: MessageContext, 
    additionalData?: {
      messageType?: 'text' | 'audio';
      audioUrl?: string;
      transcription?: string;
      transcriptionConfidence?: number;
      duration?: number;
    }
  ): Promise<void> {
    try {
      const { pageId, senderId, messageText } = messageContext;

      if (!messageText) {
        this.logger.debug('No text content to process with AI');
        return;
      }

      this.logger.log(`Processing message with AI for page ${pageId}`, {
        messageType: additionalData?.messageType || 'text',
        isTranscribed: !!additionalData?.transcription
      });

      // Generate AI response with enhanced analytics
      const aiResponse = await this.aiService.processMessage(messageContext);
      
      if (!aiResponse) {
        this.logger.warn(`No AI response generated for page ${pageId}`);
        return;
      }

      this.logger.log(`AI response generated`, {
        pageId,
        responseLength: aiResponse.text.length,
        language: aiResponse.languageDetected,
        intent: aiResponse.intent?.primary,
        sentiment: aiResponse.sentiment?.overall,
        requiresHandover: aiResponse.requiresHandover,
        confidence: aiResponse.confidence,
      });

      // Send response back to Instagram
      await this.sendInstagramReply(pageId, senderId, aiResponse.text);

      // Log special handling for audio messages
      if (additionalData?.messageType === 'audio') {
        this.logger.log(`Audio message processed successfully`, {
          originalAudioUrl: additionalData.audioUrl,
          transcriptionConfidence: additionalData.transcriptionConfidence,
          audioDuration: additionalData.duration
        });
      }

      this.logger.log(`Complete conversation flow processed successfully for page ${pageId}`);
    } catch (error) {
      this.logger.error('Error in AI processing flow:', error);
      
      // Send fallback message if possible
      await this.sendFallbackMessage(messageContext.pageId, messageContext.senderId);
    }
  }

  /**
   * Extract page ID from webhook event
   */
  extractPageId(event: InstagramWebhookEvent): string | null {
    try {
      if (event.entry && event.entry.length > 0) {
        return event.entry[0].id;
      }
    } catch (error) {
      this.logger.error('Error extracting page ID:', error);
    }
    return null;
  }

  /**
   * Extract sender ID from messaging event
   */
  extractSenderId(messagingEvent: any): string | null {
    try {
      return messagingEvent.sender?.id || null;
    } catch (error) {
      this.logger.error('Error extracting sender ID:', error);
      return null;
    }
  }

  /**
   * Extract message text from messaging event
   */
  extractMessageText(messagingEvent: any): string | null {
    try {
      return messagingEvent.message?.text || null;
    } catch (error) {
      this.logger.error('Error extracting message text:', error);
      return null;
    }
  }

  /**
   * Send AI-generated reply via Instagram Graph API
   */
  private async sendInstagramReply(pageId: string, recipientId: string, message: string): Promise<void> {
    try {
      // Retrieve access token from Key Vault
      const accessToken = await this.keyVaultService.getAccessToken(pageId);
      
      if (!accessToken) {
        this.logger.error(`No access token found for page ${pageId}`);
        return;
      }

      // Validate access token before using it
      const isValidToken = await this.instagramGraphService.validateAccessToken(accessToken);
      if (!isValidToken) {
        this.logger.error(`Invalid access token for page ${pageId}`);
        return;
      }

      // Check if we can send a message (24-hour window rule)
      const canSendMessage = await this.instagramGraphService.canSendMessage(recipientId, accessToken);
      if (!canSendMessage) {
        this.logger.warn(`Cannot send message to ${recipientId} - outside 24-hour window`);
        return;
      }

      // Send the message
      const result = await this.instagramGraphService.sendMessage({
        recipientId,
        message,
        accessToken,
      });

      if (result.success) {
        this.logger.log(`Message sent successfully`, {
          pageId,
          recipientId,
          messageId: result.messageId,
        });
      } else {
        this.logger.error(`Failed to send message`, {
          pageId,
          recipientId,
          error: result.error,
        });
      }
    } catch (error) {
      this.logger.error('Error sending Instagram reply:', error);
    }
  }

  /**
   * Send fallback message when AI processing fails
   */
  private async sendFallbackMessage(pageId: string, recipientId: string): Promise<void> {
    try {
      const accessToken = await this.keyVaultService.getAccessToken(pageId);
      if (!accessToken) {
        this.logger.error(`No access token for fallback message to page ${pageId}`);
        return;
      }

      const fallbackMessage = 'Thank you for your message! We\'re experiencing technical difficulties but will get back to you soon. 🙏';

      const result = await this.instagramGraphService.sendMessage({
        recipientId,
        message: fallbackMessage,
        accessToken,
      });

      if (result.success) {
        this.logger.log(`Fallback message sent successfully to ${recipientId}`);
      } else {
        this.logger.error(`Failed to send fallback message: ${result.error}`);
      }
    } catch (error) {
      this.logger.error('Error sending fallback message:', error);
    }
  }

  private async sendGenericResponse(pageId: string, senderId: string, responseType: string): Promise<void> {
    try {
      const accessToken = await this.keyVaultService.getAccessToken(pageId);
      if (!accessToken) {
        this.logger.error(`No access token for generic response to page ${pageId}`);
        return;
      }

      const genericResponse = 'Sorry, we\'re unable to process this content right now. Please try again later.';

      const result = await this.instagramGraphService.sendMessage({
        recipientId: senderId,
        message: genericResponse,
        accessToken,
      });

      if (result.success) {
        this.logger.log(`Generic response sent successfully to ${senderId}`);
      } else {
        this.logger.error(`Failed to send generic response: ${result.error}`);
      }
    } catch (error) {
      this.logger.error('Error sending generic response:', error);
    }
  }
} 
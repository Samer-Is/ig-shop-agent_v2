import { Injectable, Logger } from '@nestjs/common';
import { CosmosService } from '../database/cosmos.service';
import { ConversationMessage, Conversation, SentimentAnalysis, IntentClassification } from '../database/conversations.schema';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(private cosmosService: CosmosService) {}

  /**
   * Store a message in the conversation log
   */
  async storeMessage(
    merchantId: string,
    pageId: string,
    senderId: string,
    messageText: string,
    senderType: 'customer' | 'ai' | 'human',
    messageType: 'text' | 'audio' | 'image' | 'video' = 'text',
    additionalData?: {
      sentiment?: SentimentAnalysis;
      intent?: IntentClassification;
      confidence?: number;
      languageDetected?: 'en' | 'ar' | 'mixed';
      audioUrl?: string;
      transcription?: string;
      transcriptionConfidence?: number;
      responseTime?: number;
      tokensUsed?: number;
      modelUsed?: string;
    }
  ): Promise<ConversationMessage> {
    try {
      const conversationsContainer = this.cosmosService.getContainer('conversations');
      
      // Find or create conversation
      const conversationId = await this.getOrCreateConversation(merchantId, pageId, senderId);
      
      const message: ConversationMessage = {
        id: uuidv4(),
        conversationId,
        merchantId,
        pageId,
        senderId,
        senderType,
        messageText,
        messageType,
        timestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...additionalData
      };

      // Store the message
      await conversationsContainer.items.create(message);
      
      // Update conversation metadata
      await this.updateConversationMetadata(conversationId, merchantId, message);
      
      this.logger.log(`Message stored for conversation ${conversationId}`);
      return message;
    } catch (error) {
      this.logger.error('Error storing message:', error);
      throw error;
    }
  }

  /**
   * Get or create a conversation between merchant and customer
   */
  private async getOrCreateConversation(merchantId: string, pageId: string, customerId: string): Promise<string> {
    try {
      const conversationsContainer = this.cosmosService.getContainer('conversations');
      
      // Check if active conversation exists
      const query = `
        SELECT * FROM c 
        WHERE c.merchantId = @merchantId 
        AND c.pageId = @pageId 
        AND c.customerId = @customerId 
        AND c.status = 'active'
        ORDER BY c.lastActivity DESC
      `;
      
      const { resources: conversations } = await conversationsContainer.items
        .query({
          query,
          parameters: [
            { name: '@merchantId', value: merchantId },
            { name: '@pageId', value: pageId },
            { name: '@customerId', value: customerId }
          ]
        })
        .fetchAll();

      if (conversations.length > 0) {
        return conversations[0].id;
      }

      // Create new conversation
      const conversation: Conversation = {
        id: uuidv4(),
        merchantId,
        pageId,
        customerId,
        status: 'active',
        startTime: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        primaryIntents: [],
        isHandedOver: false,
        aiMessagesCount: 0,
        humanMessagesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await conversationsContainer.items.create(conversation);
      return conversation.id;
    } catch (error) {
      this.logger.error('Error getting/creating conversation:', error);
      throw error;
    }
  }

  /**
   * Update conversation metadata after new message
   */
  private async updateConversationMetadata(
    conversationId: string, 
    merchantId: string, 
    message: ConversationMessage
  ): Promise<void> {
    try {
      const conversationsContainer = this.cosmosService.getContainer('conversations');
      
      // Get current conversation
      const { resource: conversation } = await conversationsContainer
        .item(conversationId, merchantId)
        .read();

      if (!conversation) {
        this.logger.warn(`Conversation ${conversationId} not found for update`);
        return;
      }

      // Update metadata
      conversation.lastActivity = new Date();
      conversation.messageCount = (conversation.messageCount || 0) + 1;
      conversation.updatedAt = new Date();

      if (message.senderType === 'ai') {
        conversation.aiMessagesCount = (conversation.aiMessagesCount || 0) + 1;
        if (message.tokensUsed) {
          conversation.totalTokensUsed = (conversation.totalTokensUsed || 0) + message.tokensUsed;
        }
      } else if (message.senderType === 'human') {
        conversation.humanMessagesCount = (conversation.humanMessagesCount || 0) + 1;
      }

      // Update primary intents
      if (message.intent) {
        const intents = conversation.primaryIntents || [];
        if (!intents.includes(message.intent.primary)) {
          intents.push(message.intent.primary);
          conversation.primaryIntents = intents;
        }
      }

      // Check for handover flag
      if (message.handoverRequested) {
        conversation.isHandedOver = true;
        conversation.handoverTime = new Date();
        conversation.handoverReason = message.handoverReason;
      }

      await conversationsContainer.item(conversationId, merchantId).replace(conversation);
    } catch (error) {
      this.logger.error('Error updating conversation metadata:', error);
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(
    conversationId: string, 
    merchantId: string, 
    limit: number = 50
  ): Promise<ConversationMessage[]> {
    try {
      const conversationsContainer = this.cosmosService.getContainer('conversations');
      
      const query = `
        SELECT * FROM c 
        WHERE c.conversationId = @conversationId 
        AND c.merchantId = @merchantId
        ORDER BY c.timestamp DESC
        OFFSET 0 LIMIT @limit
      `;
      
      const { resources: messages } = await conversationsContainer.items
        .query({
          query,
          parameters: [
            { name: '@conversationId', value: conversationId },
            { name: '@merchantId', value: merchantId },
            { name: '@limit', value: limit }
          ]
        })
        .fetchAll();

      return messages.reverse(); // Return in chronological order
    } catch (error) {
      this.logger.error('Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * Get sentiment analytics for merchant
   */
  async getSentimentAnalytics(
    merchantId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<{
    totalMessages: number;
    averageSentimentScore: number;
    sentimentDistribution: {
      positive: number;
      neutral: number;
      negative: number;
    };
    emotionBreakdown: {
      joy: number;
      anger: number;
      sadness: number;
      fear: number;
      surprise: number;
      disgust: number;
    };
    handoverCount: number;
  }> {
    try {
      const conversationsContainer = this.cosmosService.getContainer('conversations');
      
      let query = `
        SELECT c.sentiment, c.handoverRequested 
        FROM c 
        WHERE c.merchantId = @merchantId 
        AND c.senderType = 'customer'
        AND c.sentiment != null
      `;
      
      const parameters: any[] = [{ name: '@merchantId', value: merchantId }];
      
      if (startDate) {
        query += ' AND c.timestamp >= @startDate';
        parameters.push({ name: '@startDate', value: startDate.toISOString() });
      }
      
      if (endDate) {
        query += ' AND c.timestamp <= @endDate';
        parameters.push({ name: '@endDate', value: endDate.toISOString() });
      }
      
      const { resources: messages } = await conversationsContainer.items
        .query({ query, parameters })
        .fetchAll();

      const totalMessages = messages.length;
      if (totalMessages === 0) {
        return {
          totalMessages: 0,
          averageSentimentScore: 50,
          sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
          emotionBreakdown: { joy: 0, anger: 0, sadness: 0, fear: 0, surprise: 0, disgust: 0 },
          handoverCount: 0
        };
      }

      const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
      const emotionSums = { joy: 0, anger: 0, sadness: 0, fear: 0, surprise: 0, disgust: 0 };
      let handoverCount = 0;
      let sentimentScoreSum = 0;

      messages.forEach(message => {
        const sentiment = message.sentiment;
        if (sentiment) {
          sentimentCounts[sentiment.overall]++;
          
          Object.keys(emotionSums).forEach(emotion => {
            emotionSums[emotion] += sentiment.emotions[emotion] || 0;
          });

          // Calculate sentiment score (0-100)
          const score = sentiment.overall === 'positive' ? 75 : 
                       sentiment.overall === 'neutral' ? 50 : 25;
          sentimentScoreSum += score;
        }

        if (message.handoverRequested) {
          handoverCount++;
        }
      });

      return {
        totalMessages,
        averageSentimentScore: Math.round(sentimentScoreSum / totalMessages),
        sentimentDistribution: {
          positive: Math.round((sentimentCounts.positive / totalMessages) * 100),
          neutral: Math.round((sentimentCounts.neutral / totalMessages) * 100),
          negative: Math.round((sentimentCounts.negative / totalMessages) * 100)
        },
        emotionBreakdown: {
          joy: Math.round((emotionSums.joy / totalMessages) * 100),
          anger: Math.round((emotionSums.anger / totalMessages) * 100),
          sadness: Math.round((emotionSums.sadness / totalMessages) * 100),
          fear: Math.round((emotionSums.fear / totalMessages) * 100),
          surprise: Math.round((emotionSums.surprise / totalMessages) * 100),
          disgust: Math.round((emotionSums.disgust / totalMessages) * 100)
        },
        handoverCount
      };
    } catch (error) {
      this.logger.error('Error getting sentiment analytics:', error);
      throw error;
    }
  }

  /**
   * Get intent analytics for merchant
   */
  async getIntentAnalytics(
    merchantId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<{
    totalMessages: number;
    intentDistribution: Record<string, number>;
    topIntents: Array<{ intent: string; count: number; percentage: number }>;
  }> {
    try {
      const conversationsContainer = this.cosmosService.getContainer('conversations');
      
      let query = `
        SELECT c.intent 
        FROM c 
        WHERE c.merchantId = @merchantId 
        AND c.senderType = 'customer'
        AND c.intent != null
      `;
      
      const parameters: any[] = [{ name: '@merchantId', value: merchantId }];
      
      if (startDate) {
        query += ' AND c.timestamp >= @startDate';
        parameters.push({ name: '@startDate', value: startDate.toISOString() });
      }
      
      if (endDate) {
        query += ' AND c.timestamp <= @endDate';
        parameters.push({ name: '@endDate', value: endDate.toISOString() });
      }
      
      const { resources: messages } = await conversationsContainer.items
        .query({ query, parameters })
        .fetchAll();

      const totalMessages = messages.length;
      const intentCounts: Record<string, number> = {};

      messages.forEach(message => {
        if (message.intent?.primary) {
          intentCounts[message.intent.primary] = (intentCounts[message.intent.primary] || 0) + 1;
        }
      });

      const topIntents = Object.entries(intentCounts)
        .map(([intent, count]) => ({
          intent,
          count,
          percentage: Math.round((count / totalMessages) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalMessages,
        intentDistribution: intentCounts,
        topIntents
      };
    } catch (error) {
      this.logger.error('Error getting intent analytics:', error);
      throw error;
    }
  }

  /**
   * Get active conversations requiring handover
   */
  async getHandoverRequests(merchantId: string): Promise<Conversation[]> {
    try {
      const conversationsContainer = this.cosmosService.getContainer('conversations');
      
      const query = `
        SELECT * FROM c 
        WHERE c.merchantId = @merchantId 
        AND c.isHandedOver = true 
        AND c.status = 'active'
        ORDER BY c.handoverTime DESC
      `;
      
      const { resources: conversations } = await conversationsContainer.items
        .query({
          query,
          parameters: [{ name: '@merchantId', value: merchantId }]
        })
        .fetchAll();

      return conversations;
    } catch (error) {
      this.logger.error('Error getting handover requests:', error);
      return [];
    }
  }

  /**
   * Mark conversation as resolved
   */
  async resolveConversation(
    conversationId: string, 
    merchantId: string, 
    resolutionType: 'ai_resolved' | 'human_resolved' | 'customer_left'
  ): Promise<void> {
    try {
      const conversationsContainer = this.cosmosService.getContainer('conversations');
      
      const { resource: conversation } = await conversationsContainer
        .item(conversationId, merchantId)
        .read();

      if (conversation) {
        conversation.status = 'resolved';
        conversation.resolvedAt = new Date();
        conversation.resolutionType = resolutionType;
        conversation.updatedAt = new Date();
        
        await conversationsContainer.item(conversationId, merchantId).replace(conversation);
      }
    } catch (error) {
      this.logger.error('Error resolving conversation:', error);
      throw error;
    }
  }
} 
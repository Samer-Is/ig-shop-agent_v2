import { Injectable, Logger } from '@nestjs/common';
import { CosmosService } from '../database/cosmos.service';
import { ConversationService } from './conversation.service';
import { InstagramGraphService } from './instagram-graph.service';

export interface HandoverRequest {
  id: string;
  merchantId: string;
  customerId: string;
  pageId: string;
  conversationId: string;
  reason: 'negative_sentiment' | 'complex_issue' | 'manual_request' | 'escalation';
  triggerMessage: string;
  requestedAt: Date;
  status: 'pending' | 'accepted' | 'resolved' | 'timeout';
  acceptedBy?: string;
  acceptedAt?: Date;
  resolvedAt?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  metadata?: {
    sentimentScore?: number;
    customerLanguage?: string;
    previousAttempts?: number;
  };
}

export interface LiveConversation {
  id: string;
  merchantId: string;
  customerId: string;
  pageId: string;
  status: 'ai_active' | 'handover_pending' | 'human_active' | 'resolved';
  lastMessage: string;
  lastMessageAt: Date;
  messageCount: number;
  isAiPaused: boolean;
  handoverRequest?: HandoverRequest;
  humanAgent?: {
    agentId: string;
    agentName: string;
    takenOverAt: Date;
  };
}

@Injectable()
export class HandoverService {
  private readonly logger = new Logger(HandoverService.name);

  constructor(
    private cosmosService: CosmosService,
    private conversationService: ConversationService,
    private instagramService: InstagramGraphService
  ) {}

  /**
   * Request human handover
   */
  async requestHandover(
    merchantId: string,
    customerId: string,
    pageId: string,
    reason: HandoverRequest['reason'],
    triggerMessage: string,
    metadata?: HandoverRequest['metadata']
  ): Promise<HandoverRequest> {
    try {
      const container = this.cosmosService.getContainer('handover_requests');
      
      const handoverRequest: HandoverRequest = {
        id: this.generateHandoverId(),
        merchantId,
        customerId,
        pageId,
        conversationId: `${merchantId}_${customerId}`,
        reason,
        triggerMessage,
        requestedAt: new Date(),
        status: 'pending',
        priority: this.calculatePriority(reason, metadata?.sentimentScore),
        metadata
      };

      const { resource: createdRequest } = await container.items.create(handoverRequest);
      
      // Update live conversation status
      await this.updateLiveConversationStatus(
        merchantId,
        customerId,
        pageId,
        'handover_pending',
        createdRequest
      );

      // Send notification to merchant
      await this.notifyMerchantHandover(createdRequest);

      this.logger.log(`Handover requested: ${createdRequest.id} for customer ${customerId}`);
      return createdRequest;
    } catch (error) {
      this.logger.error('Error requesting handover:', error);
      throw error;
    }
  }

  /**
   * Accept handover (human agent takes over)
   */
  async acceptHandover(
    handoverId: string,
    agentId: string,
    agentName: string
  ): Promise<HandoverRequest> {
    try {
      const container = this.cosmosService.getContainer('handover_requests');
      
      const { resource: handoverRequest } = await container.item(handoverId).read();
      if (!handoverRequest) {
        throw new Error(`Handover request not found: ${handoverId}`);
      }

      if (handoverRequest.status !== 'pending') {
        throw new Error(`Cannot accept handover with status: ${handoverRequest.status}`);
      }

      handoverRequest.status = 'accepted';
      handoverRequest.acceptedBy = agentId;
      handoverRequest.acceptedAt = new Date();

      const { resource: updatedRequest } = await container.item(handoverId).replace(handoverRequest);

      // Update live conversation
      await this.updateLiveConversationStatus(
        handoverRequest.merchantId,
        handoverRequest.customerId,
        handoverRequest.pageId,
        'human_active',
        updatedRequest,
        { agentId, agentName, takenOverAt: new Date() }
      );

      // Pause AI for this conversation
      await this.pauseAIForConversation(handoverRequest.conversationId);

      this.logger.log(`Handover accepted: ${handoverId} by agent ${agentName}`);
      return updatedRequest;
    } catch (error) {
      this.logger.error('Error accepting handover:', error);
      throw error;
    }
  }

  /**
   * Send manual message from human agent
   */
  async sendManualMessage(
    handoverId: string,
    agentId: string,
    message: string
  ): Promise<void> {
    try {
      const container = this.cosmosService.getContainer('handover_requests');
      const { resource: handoverRequest } = await container.item(handoverId).read();
      
      if (!handoverRequest || handoverRequest.acceptedBy !== agentId) {
        throw new Error('Unauthorized or invalid handover request');
      }

      // Send message via Instagram
      await this.instagramService.sendMessage(
        handoverRequest.pageId,
        handoverRequest.customerId,
        message,
        await this.getMerchantAccessToken(handoverRequest.merchantId)
      );

      // Save message to conversation
      await this.conversationService.addMessage(handoverRequest.merchantId, {
        id: `manual_${Date.now()}`,
        senderId: handoverRequest.pageId,
        recipientId: handoverRequest.customerId,
        message,
        timestamp: new Date(),
        direction: 'outbound',
        messageType: 'text',
        platform: 'instagram',
        isAIGenerated: false,
        humanAgent: {
          agentId,
          agentName: handoverRequest.acceptedBy
        }
      });

      this.logger.log(`Manual message sent by agent ${agentId}: ${message}`);
    } catch (error) {
      this.logger.error('Error sending manual message:', error);
      throw error;
    }
  }

  /**
   * Resolve handover (return to AI)
   */
  async resolveHandover(
    handoverId: string,
    agentId: string,
    resolution?: string
  ): Promise<HandoverRequest> {
    try {
      const container = this.cosmosService.getContainer('handover_requests');
      
      const { resource: handoverRequest } = await container.item(handoverId).read();
      if (!handoverRequest || handoverRequest.acceptedBy !== agentId) {
        throw new Error('Unauthorized or invalid handover request');
      }

      handoverRequest.status = 'resolved';
      handoverRequest.resolvedAt = new Date();

      const { resource: updatedRequest } = await container.item(handoverId).replace(handoverRequest);

      // Resume AI for this conversation
      await this.resumeAIForConversation(handoverRequest.conversationId);

      // Update live conversation status
      await this.updateLiveConversationStatus(
        handoverRequest.merchantId,
        handoverRequest.customerId,
        handoverRequest.pageId,
        'ai_active'
      );

      this.logger.log(`Handover resolved: ${handoverId} by agent ${agentId}`);
      return updatedRequest;
    } catch (error) {
      this.logger.error('Error resolving handover:', error);
      throw error;
    }
  }

  /**
   * Get active handover requests for merchant
   */
  async getActiveHandovers(merchantId: string): Promise<HandoverRequest[]> {
    try {
      const container = this.cosmosService.getContainer('handover_requests');
      
      const query = `
        SELECT * FROM c 
        WHERE c.merchantId = @merchantId 
        AND c.status IN ('pending', 'accepted')
        ORDER BY c.requestedAt DESC
      `;
      
      const { resources: handovers } = await container.items
        .query({
          query,
          parameters: [{ name: '@merchantId', value: merchantId }]
        })
        .fetchAll();

      return handovers;
    } catch (error) {
      this.logger.error('Error fetching active handovers:', error);
      throw error;
    }
  }

  /**
   * Get live conversations for merchant
   */
  async getLiveConversations(merchantId: string): Promise<LiveConversation[]> {
    try {
      const container = this.cosmosService.getContainer('live_conversations');
      
      const query = `
        SELECT * FROM c 
        WHERE c.merchantId = @merchantId 
        AND c.status != 'resolved'
        ORDER BY c.lastMessageAt DESC
      `;
      
      const { resources: conversations } = await container.items
        .query({
          query,
          parameters: [{ name: '@merchantId', value: merchantId }]
        })
        .fetchAll();

      return conversations;
    } catch (error) {
      this.logger.error('Error fetching live conversations:', error);
      throw error;
    }
  }

  /**
   * Check if AI is paused for conversation
   */
  async isAIPaused(conversationId: string): Promise<boolean> {
    try {
      const container = this.cosmosService.getContainer('live_conversations');
      
      const query = `
        SELECT c.isAiPaused FROM c 
        WHERE c.id = @conversationId
      `;
      
      const { resources: results } = await container.items
        .query({
          query,
          parameters: [{ name: '@conversationId', value: conversationId }]
        })
        .fetchAll();

      return results.length > 0 ? results[0].isAiPaused : false;
    } catch (error) {
      this.logger.error('Error checking AI pause status:', error);
      return false;
    }
  }

  /**
   * Update live conversation status
   */
  private async updateLiveConversationStatus(
    merchantId: string,
    customerId: string,
    pageId: string,
    status: LiveConversation['status'],
    handoverRequest?: HandoverRequest,
    humanAgent?: LiveConversation['humanAgent']
  ): Promise<void> {
    try {
      const container = this.cosmosService.getContainer('live_conversations');
      const conversationId = `${merchantId}_${customerId}`;
      
      let conversation: LiveConversation;
      
      try {
        const { resource: existing } = await container.item(conversationId).read();
        conversation = existing;
      } catch {
        // Create new live conversation if doesn't exist
        conversation = {
          id: conversationId,
          merchantId,
          customerId,
          pageId,
          status: 'ai_active',
          lastMessage: '',
          lastMessageAt: new Date(),
          messageCount: 0,
          isAiPaused: false
        };
      }

      conversation.status = status;
      conversation.isAiPaused = status === 'human_active' || status === 'handover_pending';
      
      if (handoverRequest) {
        conversation.handoverRequest = handoverRequest;
      }
      
      if (humanAgent) {
        conversation.humanAgent = humanAgent;
      }

      await container.items.upsert(conversation);
    } catch (error) {
      this.logger.error('Error updating live conversation status:', error);
    }
  }

  /**
   * Pause AI for conversation
   */
  private async pauseAIForConversation(conversationId: string): Promise<void> {
    // This would set a flag that the AI service checks before processing messages
    this.logger.log(`AI paused for conversation: ${conversationId}`);
  }

  /**
   * Resume AI for conversation
   */
  private async resumeAIForConversation(conversationId: string): Promise<void> {
    // This would remove the AI pause flag
    this.logger.log(`AI resumed for conversation: ${conversationId}`);
  }

  /**
   * Calculate priority based on reason and sentiment
   */
  private calculatePriority(
    reason: HandoverRequest['reason'],
    sentimentScore?: number
  ): HandoverRequest['priority'] {
    if (reason === 'manual_request') {
      return 'medium';
    }
    
    if (sentimentScore && sentimentScore < -0.8) {
      return 'urgent';
    } else if (sentimentScore && sentimentScore < -0.5) {
      return 'high';
    }
    
    switch (reason) {
      case 'negative_sentiment':
        return 'high';
      case 'complex_issue':
        return 'medium';
      case 'escalation':
        return 'urgent';
      default:
        return 'low';
    }
  }

  /**
   * Notify merchant of handover request
   */
  private async notifyMerchantHandover(handoverRequest: HandoverRequest): Promise<void> {
    // In a real implementation, this would send email/push notifications
    this.logger.log(`Notification sent for handover: ${handoverRequest.id}`);
  }

  /**
   * Get merchant access token
   */
  private async getMerchantAccessToken(merchantId: string): Promise<string> {
    // This would fetch the merchant's access token from the database
    return 'merchant_access_token';
  }

  /**
   * Generate unique handover ID
   */
  private generateHandoverId(): string {
    return `handover_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }
} 
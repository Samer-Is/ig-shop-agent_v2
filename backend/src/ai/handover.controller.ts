import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Body, 
  Param, 
  UseGuards, 
  Req,
  BadRequestException,
  NotFoundException
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HandoverService, HandoverRequest, LiveConversation } from './handover.service';

@Controller('api/conversations')
@UseGuards(JwtAuthGuard)
export class HandoverController {
  constructor(private handoverService: HandoverService) {}

  /**
   * Get live conversations for merchant
   */
  @Get('live')
  async getLiveConversations(@Req() req: any) {
    try {
      const merchantId = req.user.merchantId;
      
      const conversations = await this.handoverService.getLiveConversations(merchantId);

      return {
        success: true,
        data: conversations,
        count: conversations.length
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Failed to fetch live conversations',
        error: error.message
      });
    }
  }

  /**
   * Get active handover requests
   */
  @Get('handovers')
  async getActiveHandovers(@Req() req: any) {
    try {
      const merchantId = req.user.merchantId;
      
      const handovers = await this.handoverService.getActiveHandovers(merchantId);

      return {
        success: true,
        data: handovers,
        count: handovers.length
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Failed to fetch handover requests',
        error: error.message
      });
    }
  }

  /**
   * Request manual handover
   */
  @Post('handover/request')
  async requestHandover(
    @Req() req: any,
    @Body() body: {
      customerId: string;
      pageId: string;
      reason: HandoverRequest['reason'];
      message?: string;
    }
  ) {
    try {
      const merchantId = req.user.merchantId;
      
      if (!body.customerId || !body.pageId || !body.reason) {
        throw new BadRequestException('Missing required fields');
      }

      const handoverRequest = await this.handoverService.requestHandover(
        merchantId,
        body.customerId,
        body.pageId,
        body.reason,
        body.message || 'Manual handover request',
        {
          previousAttempts: 0
        }
      );

      return {
        success: true,
        message: 'Handover requested successfully',
        data: handoverRequest
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Failed to request handover',
        error: error.message
      });
    }
  }

  /**
   * Accept handover (take over conversation)
   */
  @Put('handover/:handoverId/accept')
  async acceptHandover(
    @Param('handoverId') handoverId: string,
    @Req() req: any,
    @Body() body: { agentName?: string }
  ) {
    try {
      const agentId = req.user.id || req.user.merchantId;
      const agentName = body.agentName || req.user.name || 'Merchant';
      
      const updatedHandover = await this.handoverService.acceptHandover(
        handoverId,
        agentId,
        agentName
      );

      return {
        success: true,
        message: 'Handover accepted successfully',
        data: updatedHandover
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException({
          success: false,
          message: 'Handover request not found',
          error: error.message
        });
      }
      
      throw new BadRequestException({
        success: false,
        message: 'Failed to accept handover',
        error: error.message
      });
    }
  }

  /**
   * Send manual message
   */
  @Post('handover/:handoverId/message')
  async sendManualMessage(
    @Param('handoverId') handoverId: string,
    @Req() req: any,
    @Body() body: { message: string }
  ) {
    try {
      const agentId = req.user.id || req.user.merchantId;
      
      if (!body.message || body.message.trim().length === 0) {
        throw new BadRequestException('Message cannot be empty');
      }

      await this.handoverService.sendManualMessage(
        handoverId,
        agentId,
        body.message.trim()
      );

      return {
        success: true,
        message: 'Message sent successfully'
      };
    } catch (error) {
      if (error.message.includes('Unauthorized')) {
        throw new BadRequestException({
          success: false,
          message: 'Unauthorized to send message for this handover',
          error: error.message
        });
      }
      
      throw new BadRequestException({
        success: false,
        message: 'Failed to send message',
        error: error.message
      });
    }
  }

  /**
   * Resolve handover (return to AI)
   */
  @Put('handover/:handoverId/resolve')
  async resolveHandover(
    @Param('handoverId') handoverId: string,
    @Req() req: any,
    @Body() body: { resolution?: string }
  ) {
    try {
      const agentId = req.user.id || req.user.merchantId;
      
      const resolvedHandover = await this.handoverService.resolveHandover(
        handoverId,
        agentId,
        body.resolution
      );

      return {
        success: true,
        message: 'Handover resolved, AI resumed',
        data: resolvedHandover
      };
    } catch (error) {
      if (error.message.includes('Unauthorized')) {
        throw new BadRequestException({
          success: false,
          message: 'Unauthorized to resolve this handover',
          error: error.message
        });
      }
      
      throw new BadRequestException({
        success: false,
        message: 'Failed to resolve handover',
        error: error.message
      });
    }
  }

  /**
   * Check if AI is paused for conversation
   */
  @Get('conversation/:conversationId/ai-status')
  async getAIStatus(@Param('conversationId') conversationId: string) {
    try {
      const isPaused = await this.handoverService.isAIPaused(conversationId);

      return {
        success: true,
        data: {
          conversationId,
          aiPaused: isPaused,
          status: isPaused ? 'human_active' : 'ai_active'
        }
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Failed to check AI status',
        error: error.message
      });
    }
  }

  /**
   * Get handover statistics
   */
  @Get('handovers/stats')
  async getHandoverStats(@Req() req: any) {
    try {
      const merchantId = req.user.merchantId;
      
      const [activeHandovers, liveConversations] = await Promise.all([
        this.handoverService.getActiveHandovers(merchantId),
        this.handoverService.getLiveConversations(merchantId)
      ]);

      const pendingHandovers = activeHandovers.filter(h => h.status === 'pending').length;
      const acceptedHandovers = activeHandovers.filter(h => h.status === 'accepted').length;
      const aiActiveConversations = liveConversations.filter(c => c.status === 'ai_active').length;
      const humanActiveConversations = liveConversations.filter(c => c.status === 'human_active').length;

      return {
        success: true,
        data: {
          totalActiveHandovers: activeHandovers.length,
          pendingHandovers,
          acceptedHandovers,
          totalLiveConversations: liveConversations.length,
          aiActiveConversations,
          humanActiveConversations,
          handoverRate: liveConversations.length > 0 ? 
            ((pendingHandovers + acceptedHandovers) / liveConversations.length * 100) : 0
        }
      };
    } catch (error) {
      throw new BadRequestException({
        success: false,
        message: 'Failed to fetch handover statistics',
        error: error.message
      });
    }
  }
} 
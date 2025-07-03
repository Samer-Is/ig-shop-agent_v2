import { Controller, Get, UseGuards, Request, Query, ParseDatePipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationService } from './conversation.service';
import { AnalyticsService } from './analytics.service';

@Controller('api/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private conversationService: ConversationService,
    private analyticsService: AnalyticsService,
  ) {}

  /**
   * Get sentiment analytics for the authenticated merchant
   */
  @Get('sentiment')
  async getSentimentAnalytics(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const merchantId = req.user.merchantId;
    
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    
    return this.conversationService.getSentimentAnalytics(merchantId, start, end);
  }

  /**
   * Get intent analytics for the authenticated merchant
   */
  @Get('intent')
  async getIntentAnalytics(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const merchantId = req.user.merchantId;
    
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    
    return this.conversationService.getIntentAnalytics(merchantId, start, end);
  }

  /**
   * Get conversations requiring handover
   */
  @Get('handover-requests')
  async getHandoverRequests(@Request() req) {
    const merchantId = req.user.merchantId;
    return this.conversationService.getHandoverRequests(merchantId);
  }

  /**
   * Get conversation history with analytics
   */
  @Get('conversation-history')
  async getConversationHistory(
    @Request() req,
    @Query('conversationId') conversationId: string,
    @Query('limit') limit?: number,
  ) {
    const merchantId = req.user.merchantId;
    const messageLimit = limit ? parseInt(limit.toString()) : 50;
    
    return this.conversationService.getConversationHistory(conversationId, merchantId, messageLimit);
  }

  /**
   * Test sentiment analysis on provided text
   */
  @Get('test-sentiment')
  async testSentiment(
    @Query('text') text: string,
    @Query('language') language: 'en' | 'ar' | 'mixed' = 'en',
  ) {
    if (!text) {
      return { error: 'Text parameter is required' };
    }
    
    const sentiment = await this.analyticsService.analyzeSentiment(text, language);
    const shouldHandover = this.analyticsService.shouldRequestHandover(sentiment);
    const sentimentScore = this.analyticsService.calculateSentimentScore(sentiment);
    
    return {
      text,
      language,
      sentiment,
      shouldHandover,
      sentimentScore
    };
  }

  /**
   * Test intent classification on provided text
   */
  @Get('test-intent')
  async testIntent(
    @Query('text') text: string,
    @Query('language') language: 'en' | 'ar' | 'mixed' = 'en',
  ) {
    if (!text) {
      return { error: 'Text parameter is required' };
    }
    
    const intent = await this.analyticsService.classifyIntent(text, language);
    
    return {
      text,
      language,
      intent
    };
  }

  /**
   * Get comprehensive analytics dashboard data
   */
  @Get('dashboard')
  async getDashboardAnalytics(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const merchantId = req.user.merchantId;
    
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    
    // Run analytics queries in parallel
    const [sentimentData, intentData, handoverRequests] = await Promise.all([
      this.conversationService.getSentimentAnalytics(merchantId, start, end),
      this.conversationService.getIntentAnalytics(merchantId, start, end),
      this.conversationService.getHandoverRequests(merchantId)
    ]);
    
    return {
      period: {
        startDate: start?.toISOString(),
        endDate: end?.toISOString()
      },
      sentiment: sentimentData,
      intent: intentData,
      handover: {
        activeRequests: handoverRequests.length,
        requests: handoverRequests
      },
      summary: {
        totalConversations: sentimentData.totalMessages,
        averageSentiment: sentimentData.averageSentimentScore,
        topIntent: intentData.topIntents[0]?.intent || 'N/A',
        needsAttention: handoverRequests.length
      }
    };
  }
} 
import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { AnalyticsService } from './analytics.service';
import { ConversationService } from './conversation.service';
import { SpeechService } from './speech.service';
import { OrderService } from './order.service';
import { HandoverService } from './handover.service';
import { AnalyticsController } from './analytics.controller';
import { OrderController } from './order.controller';
import { HandoverController } from './handover.controller';
import { InstagramGraphService } from './instagram-graph.service';
import { DatabaseModule } from '../database';
import { AzureModule } from '../azure';

@Module({
  imports: [DatabaseModule, AzureModule],
  providers: [AIService, AnalyticsService, ConversationService, SpeechService, OrderService, HandoverService, InstagramGraphService],
  controllers: [AnalyticsController, OrderController, HandoverController],
  exports: [AIService, AnalyticsService, ConversationService, SpeechService, OrderService, HandoverService, InstagramGraphService],
})
export class AIModule {} 
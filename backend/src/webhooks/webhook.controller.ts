import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Headers,
  Req,
  BadRequestException,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { WebhookService, InstagramWebhookEvent } from './webhook.service';

@Controller('api/webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Handle webhook verification (GET request)
   * Meta sends this to verify the webhook endpoint during setup
   */
  @Get('instagram')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    try {
      this.logger.log('Webhook verification request received', {
        mode,
        tokenPresent: !!token,
        challengePresent: !!challenge,
      });

      if (!mode || !token || !challenge) {
        this.logger.error('Missing required verification parameters');
        throw new BadRequestException('Missing verification parameters');
      }

      return this.webhookService.handleVerification(mode, token, challenge);
    } catch (error) {
      this.logger.error('Webhook verification failed:', error);
      throw error;
    }
  }

  /**
   * Handle Instagram webhook events (POST request)
   * Receives real-time updates when users message the Instagram page
   */
  @Post('instagram')
  @HttpCode(HttpStatus.OK)
  async handleInstagramWebhook(
    @Body() body: InstagramWebhookEvent,
    @Headers('x-hub-signature-256') signature: string,
    @Req() req: Request,
  ): Promise<{ status: string }> {
    try {
      this.logger.log('Instagram webhook event received');

      // Verify the request signature
      if (!signature) {
        this.logger.error('Missing webhook signature');
        throw new BadRequestException('Missing signature');
      }

      // Get raw body for signature verification
      const rawBody = this.getRawBody(req);
      
      if (!this.webhookService.verifySignature(rawBody, signature)) {
        this.logger.error('Invalid webhook signature');
        throw new BadRequestException('Invalid signature');
      }

      this.logger.debug('Webhook signature verified successfully');

      // Process the webhook event
      await this.webhookService.processWebhookEvent(body);

      this.logger.log('Webhook event processed successfully');
      return { status: 'success' };
    } catch (error) {
      this.logger.error('Error handling Instagram webhook:', error);
      throw error;
    }
  }

  /**
   * Extract raw body from request for signature verification
   * This is needed because the signature is calculated on the raw JSON string
   */
  private getRawBody(req: Request): string {
    try {
      // With our raw body middleware, req.body should be a Buffer for webhook endpoints
      if (Buffer.isBuffer(req.body)) {
        return req.body.toString('utf8');
      }
      
      // If body is already a string, return as-is
      if (typeof req.body === 'string') {
        return req.body;
      }

      // If body is an object (shouldn't happen with raw middleware), stringify it
      if (req.body && typeof req.body === 'object') {
        return JSON.stringify(req.body);
      }

      // Fallback
      this.logger.warn('Unable to extract raw body for signature verification');
      return '';
    } catch (error) {
      this.logger.error('Error extracting raw body:', error);
      return '';
    }
  }

  /**
   * Health check endpoint for webhook
   */
  @Get('instagram/health')
  healthCheck(): { status: string; timestamp: string } {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
} 
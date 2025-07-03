import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface InstagramSendMessageRequest {
  recipientId: string;
  message: string;
  accessToken: string;
}

export interface InstagramSendMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class InstagramGraphService {
  private readonly logger = new Logger(InstagramGraphService.name);
  private readonly graphApiVersion: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.graphApiVersion = this.configService.get<string>('instagram.graphApiVersion');
    this.baseUrl = this.configService.get<string>('instagram.baseUrl');
  }

  /**
   * Send a message reply via Instagram Graph API
   */
  async sendMessage(request: InstagramSendMessageRequest): Promise<InstagramSendMessageResponse> {
    try {
      this.logger.log(`Sending Instagram message to user ${request.recipientId}`);

      const url = `${this.baseUrl}/${this.graphApiVersion}/me/messages`;
      
      const payload = {
        recipient: {
          id: request.recipientId,
        },
        message: {
          text: request.message,
        },
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${request.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
      });

      if (response.data && response.data.message_id) {
        this.logger.log(`Message sent successfully: ${response.data.message_id}`);
        return {
          success: true,
          messageId: response.data.message_id,
        };
      } else {
        this.logger.error('Unexpected response format from Instagram API', response.data);
        return {
          success: false,
          error: 'Unexpected response format',
        };
      }
    } catch (error) {
      this.logger.error('Error sending Instagram message:', error);
      
      // Handle specific Instagram API errors
      if (error.response) {
        const { status, data } = error.response;
        this.logger.error(`Instagram API error ${status}:`, data);
        
        if (status === 429) {
          return {
            success: false,
            error: 'Rate limit exceeded - please try again later',
          };
        } else if (status === 403) {
          return {
            success: false,
            error: 'Access forbidden - check permissions and access token',
          };
        } else if (status === 400) {
          return {
            success: false,
            error: `Bad request: ${data.error?.message || 'Invalid request'}`,
          };
        }
      }

      return {
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  /**
   * Validate access token by making a simple API call
   */
  async validateAccessToken(accessToken: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/${this.graphApiVersion}/me`;
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        timeout: 5000,
      });

      return response.status === 200 && response.data.id;
    } catch (error) {
      this.logger.error('Error validating access token:', error);
      return false;
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile(userId: string, accessToken: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/${this.graphApiVersion}/${userId}`;
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        params: {
          fields: 'id,name,profile_pic',
        },
        timeout: 5000,
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Error getting user profile for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Check if messaging is available (within 24-hour window)
   */
  async canSendMessage(recipientId: string, accessToken: string): Promise<boolean> {
    try {
      // This is a simplified check - in production, you'd want to track
      // the last interaction timestamp and check against 24-hour rule
      
      // For now, we'll assume messaging is available
      // This should be enhanced with proper 24-hour window tracking
      return true;
    } catch (error) {
      this.logger.error('Error checking messaging availability:', error);
      return false;
    }
  }
} 
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

@Injectable()
export class KeyVaultService {
  private readonly logger = new Logger(KeyVaultService.name);
  private readonly secretClient: SecretClient;

  constructor(private configService: ConfigService) {
    const keyVaultUrl = this.configService.get<string>('azure.keyVaultUrl');
    
    if (!keyVaultUrl) {
      this.logger.error('Key Vault URL not configured');
      throw new Error('Key Vault URL is required');
    }

    // Use managed identity in production, fallback to environment variables in development
    const credential = new DefaultAzureCredential();
    this.secretClient = new SecretClient(keyVaultUrl, credential);
  }

  /**
   * Retrieve access token for a merchant by their page ID
   */
  async getAccessToken(pageId: string): Promise<string | null> {
    try {
      const secretName = this.getSecretName(pageId);
      this.logger.debug(`Retrieving access token for page: ${pageId}`);
      
      const secret = await this.secretClient.getSecret(secretName);
      
      if (!secret.value) {
        this.logger.warn(`No access token found for page: ${pageId}`);
        return null;
      }

      this.logger.debug(`Access token retrieved successfully for page: ${pageId}`);
      return secret.value;
    } catch (error) {
      this.logger.error(`Error retrieving access token for page ${pageId}:`, error);
      return null;
    }
  }

  /**
   * Store access token for a merchant
   */
  async storeAccessToken(pageId: string, accessToken: string): Promise<boolean> {
    try {
      const secretName = this.getSecretName(pageId);
      this.logger.debug(`Storing access token for page: ${pageId}`);

      await this.secretClient.setSecret(secretName, accessToken, {
        tags: {
          type: 'instagram-access-token',
          pageId: pageId,
          createdAt: new Date().toISOString(),
        },
      });

      this.logger.log(`Access token stored successfully for page: ${pageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error storing access token for page ${pageId}:`, error);
      return false;
    }
  }

  /**
   * Delete access token for a merchant (when they disconnect)
   */
  async deleteAccessToken(pageId: string): Promise<boolean> {
    try {
      const secretName = this.getSecretName(pageId);
      this.logger.debug(`Deleting access token for page: ${pageId}`);

      await this.secretClient.beginDeleteSecret(secretName);
      
      this.logger.log(`Access token deleted successfully for page: ${pageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting access token for page ${pageId}:`, error);
      return false;
    }
  }

  /**
   * Check if access token exists for a page
   */
  async hasAccessToken(pageId: string): Promise<boolean> {
    try {
      const secretName = this.getSecretName(pageId);
      const secret = await this.secretClient.getSecret(secretName);
      return !!secret.value;
    } catch (error) {
      // If secret doesn't exist, this will throw an error
      return false;
    }
  }

  /**
   * Generate consistent secret name for page ID
   */
  private getSecretName(pageId: string): string {
    // Azure Key Vault secret names must be 1-127 characters and contain only
    // alphanumeric characters and dashes
    return `instagram-token-${pageId}`.replace(/[^a-zA-Z0-9-]/g, '-');
  }

  /**
   * Health check for Key Vault connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to list secrets (just to test connectivity)
      const iterator = this.secretClient.listPropertiesOfSecrets();
      await iterator.next();
      return true;
    } catch (error) {
      this.logger.error('Key Vault health check failed:', error);
      return false;
    }
  }
} 
import { Injectable, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { KeyVaultSecret, SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

@Injectable()
export class InstagramService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly keyVaultUrl: string;
  private readonly secretClient: SecretClient;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('instagram.clientId');
    this.clientSecret = this.configService.get<string>('instagram.clientSecret');
    this.redirectUri = this.configService.get<string>('instagram.redirectUri');
    this.keyVaultUrl = this.configService.get<string>('keyvault.url');
    this.secretClient = new SecretClient(this.keyVaultUrl, new DefaultAzureCredential());
  }

  async exchangeCodeForToken(code: string): Promise<{ accessToken: string; userId: string; pageId: string; pageName: string; }> {
    // Exchange code for short-lived token
    const tokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code,
      },
    });
    const shortLivedToken = tokenRes.data.access_token;

    // Exchange for long-lived token
    const longTokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        fb_exchange_token: shortLivedToken,
      },
    });
    const accessToken = longTokenRes.data.access_token;

    // Get user id
    const userRes = await axios.get('https://graph.facebook.com/v19.0/me', {
      params: {
        access_token: accessToken,
        fields: 'id,name',
      },
    });
    const userId = userRes.data.id;

    // Get Instagram business accounts (pages)
    const pagesRes = await axios.get('https://graph.facebook.com/v19.0/me/accounts', {
      params: {
        access_token: accessToken,
      },
    });
    const page = pagesRes.data.data[0]; // Assume first page for now
    if (!page) throw new UnauthorizedException('No Facebook page found');

    // Get Instagram business account id
    const pageDetailsRes = await axios.get(`https://graph.facebook.com/v19.0/${page.id}`, {
      params: {
        access_token: accessToken,
        fields: 'id,name,instagram_business_account',
      },
    });
    const pageId = pageDetailsRes.data.instagram_business_account?.id;
    if (!pageId) throw new UnauthorizedException('No Instagram business account linked to this page');

    return {
      accessToken,
      userId,
      pageId,
      pageName: pageDetailsRes.data.name,
    };
  }

  async storeAccessTokenInKeyVault(pageId: string, accessToken: string): Promise<string> {
    const secretName = `ig-access-token-${pageId}`;
    const secret: KeyVaultSecret = await this.secretClient.setSecret(secretName, accessToken);
    return secret.id || `${this.keyVaultUrl}/secrets/${secretName}`;
  }
} 
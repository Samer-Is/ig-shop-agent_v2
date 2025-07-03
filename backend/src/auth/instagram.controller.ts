import { Body, Controller, Post, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InstagramService } from './instagram.service';
import { CosmosService } from '../database/cosmos.service';
import { Merchant } from '../database/merchants.schema';
import { WhitelistEntry } from '../database/whitelist.schema';
import { JwtPayload } from './jwt.strategy';

@Controller('api')
export class InstagramController {
  constructor(
    private readonly instagramService: InstagramService,
    private readonly cosmosService: CosmosService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Handles Instagram OAuth 2.0 callback and merchant onboarding
   * @param body { code: string }
   */
  @Post('onboard')
  async onboard(@Body() body: { code: string }) {
    if (!body.code) throw new BadRequestException('Missing code');
    // Exchange code for token and page info
    const { accessToken, userId, pageId, pageName } = await this.instagramService.exchangeCodeForToken(body.code);
    // Check whitelist
    const whitelistContainer = this.cosmosService.getWhitelistContainer();
    const { resources: whitelist } = await whitelistContainer.items
      .query<WhitelistEntry>({
        query: 'SELECT * FROM c WHERE c.instagramPageId = @pageId',
        parameters: [{ name: '@pageId', value: pageId }],
      })
      .fetchAll();
    if (!whitelist.length) throw new UnauthorizedException('Instagram page is not whitelisted');
    // Store access token in Key Vault
    const secretUri = await this.instagramService.storeAccessTokenInKeyVault(pageId, accessToken);
    // Create merchant document
    const merchantsContainer = this.cosmosService.getMerchantsContainer();
    const merchant: Merchant = {
      id: pageId,
      pageId,
      instagramUserId: userId,
      businessName: pageName,
      email: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subscriptionTier: 'basic',
      instagramAccessTokenSecretUri: secretUri,
      productCatalog: [],
      businessInfo: { workingHours: '', termsAndConditions: '' },
      aiSettings: { customPrompt: '' },
    };
    await merchantsContainer.items.upsert(merchant);

    // Generate JWT token
    const payload: JwtPayload = {
      sub: pageId,
      merchantId: pageId,
      pageId,
      pageName,
    };
    const token = this.jwtService.sign(payload);

    return { 
      success: true, 
      token,
      merchant: {
        id: pageId,
        pageId,
        pageName,
        subscriptionTier: 'basic',
        createdAt: merchant.createdAt,
      }
    };
  }
} 
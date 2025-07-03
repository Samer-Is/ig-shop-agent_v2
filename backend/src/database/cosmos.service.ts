import { Injectable, OnModuleInit } from '@nestjs/common';
import { CosmosClient, Container } from '@azure/cosmos';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CosmosService implements OnModuleInit {
  private client: CosmosClient;
  private databaseId: string;
  private merchantsContainer: Container;
  private whitelistContainer: Container;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.client = new CosmosClient({
      endpoint: this.configService.get<string>('cosmos.endpoint'),
      key: this.configService.get<string>('cosmos.key'),
    });
    this.databaseId = this.configService.get<string>('cosmos.databaseId') || 'SaaSPlatformDB';
    const db = this.client.database(this.databaseId);
    this.merchantsContainer = db.container('merchants');
    this.whitelistContainer = db.container('whitelist');
  }

  getMerchantsContainer(): Container {
    return this.merchantsContainer;
  }

  getWhitelistContainer(): Container {
    return this.whitelistContainer;
  }
} 
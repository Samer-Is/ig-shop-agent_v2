import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CosmosService } from './database/cosmos.service';
import { InstagramService, InstagramController } from './auth';
import { MerchantService, MerchantController } from './merchant';
import { WebhookService, WebhookController } from './webhooks';
import { AIService, InstagramGraphService, AnalyticsService, ConversationService, SpeechService } from './ai';
import { KeyVaultService } from './azure';
import { JwtStrategy } from './auth/jwt.strategy';

// Configuration
import { configuration } from './config/configuration';
import { validationSchema } from './config/validation';

// Core modules (to be implemented in Phase 1)
// import { AuthModule } from './modules/auth/auth.module';
// import { MerchantsModule } from './modules/merchants/merchants.module';
// import { AiModule } from './modules/ai/ai.module';
// import { OrdersModule } from './modules/orders/orders.module';
// import { WebhooksModule } from './modules/webhooks/webhooks.module';
// import { BillingModule } from './modules/billing/billing.module';

// Database and external services (to be implemented in Phase 1)
// import { DatabaseModule } from './database/database.module';
// import { ExternalModule } from './external/external.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // validationSchema will be properly implemented in Phase 1 with Joi
      validate: validationSchema.validate,
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60 * 1000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Passport and JWT setup
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('auth.jwtSecret'),
        signOptions: { 
          expiresIn: configService.get<string>('auth.jwtExpiration') 
        },
      }),
      inject: [ConfigService],
    }),

    // Core modules (Phase 1)
    // AuthModule,
    // MerchantsModule,
    // AiModule,
    // OrdersModule,
    // WebhooksModule,
    // BillingModule,

    // Infrastructure modules (Phase 1)
    // DatabaseModule,
    // ExternalModule,
  ],
  controllers: [AppController, InstagramController, MerchantController, WebhookController],
  providers: [
    AppService,
    CosmosService,
    InstagramService,
    MerchantService,
    WebhookService,
    AIService,
    AnalyticsService,
    ConversationService,
    SpeechService,
    InstagramGraphService,
    KeyVaultService,
    JwtStrategy,
  ],
})
export class AppModule {} 
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Raw body parsing for webhook signature verification
  app.use('/api/webhooks/instagram', express.raw({ type: 'application/json' }));
  
  // Security middleware
  app.use(helmet());
  app.use(compression());

  // CORS configuration
  app.enableCors({
    origin: configService.get('CORS_ORIGINS', 'http://localhost:5173').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global prefix (exclude webhook endpoints as they need specific paths for Meta)
  app.setGlobalPrefix('api/v1', {
    exclude: ['/health', '/', '/api/webhooks/instagram'],
  });

  // Swagger documentation
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Instagram AI Agent SaaS API')
      .setDescription('API documentation for Instagram AI Agent SaaS Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('Authentication', 'User authentication and authorization')
      .addTag('Merchants', 'Merchant management and configuration')
      .addTag('Products', 'Product catalog management')
      .addTag('Orders', 'Order management and tracking')
      .addTag('AI', 'AI conversation and configuration')
      .addTag('Webhooks', 'Instagram webhook handlers')
      .addTag('Admin', 'Vendor admin functionality')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  // Start server
  const port = configService.get('PORT', 3000);
  await app.listen(port);

  logger.log(`🚀 Instagram AI Agent API is running on: http://localhost:${port}`);
  logger.log(`📚 API Documentation available at: http://localhost:${port}/api/docs`);
  logger.log(`🌍 Environment: ${configService.get('NODE_ENV', 'development')}`);
}

bootstrap().catch((error) => {
  Logger.error('❌ Error starting server', error);
  process.exit(1);
}); 
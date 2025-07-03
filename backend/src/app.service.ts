import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getApiInfo() {
    return {
      name: 'Instagram AI Agent SaaS API',
      version: '1.0.0',
      description: 'Multi-tenant SaaS platform providing AI-powered Instagram DM management',
      environment: this.configService.get('NODE_ENV', 'development'),
      status: 'operational',
      timestamp: new Date().toISOString(),
      documentation: '/api/docs',
      endpoints: {
        health: '/health',
        api: '/api/v1',
        docs: '/api/docs',
      },
    };
  }

  getHealthStatus() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.configService.get('NODE_ENV', 'development'),
      version: '1.0.0',
      checks: {
        api: 'healthy',
        // Add more health checks here as we implement more services
        // database: 'healthy',
        // openai: 'healthy',
        // azure: 'healthy',
      },
    };
  }
} 
export const configuration = () => ({
  // Application settings
  app: {
    name: 'Instagram AI Agent SaaS API',
    version: '1.0.0',
    port: parseInt(process.env.PORT, 10) || 3000,
    environment: process.env.NODE_ENV || 'development',
    corsOrigins: process.env.CORS_ORIGINS || 'http://localhost:5173',
  },

  // Database configuration
  database: {
    cosmosEndpoint: process.env.COSMOS_DB_ENDPOINT,
    cosmosKey: process.env.COSMOS_DB_KEY,
    databaseName: process.env.COSMOS_DB_NAME || 'SaaSPlatformDB',
  },

  // External API configurations
  facebook: {
    appId: process.env.FACEBOOK_APP_ID,
    appSecret: process.env.FACEBOOK_APP_SECRET,
  },

  // Webhook configuration
  webhooks: {
    verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || 'instagram-webhook-verify-token-2024',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o',
  },

  // Azure services
  azure: {
    keyVaultUrl: process.env.KEY_VAULT_URL,
    blobStorageConnectionString: process.env.BLOB_STORAGE_CONNECTION_STRING,
    cognitiveSearchEndpoint: process.env.COGNITIVE_SEARCH_ENDPOINT,
    cognitiveSearchKey: process.env.COGNITIVE_SEARCH_KEY,
    speechServiceKey: process.env.AZURE_SPEECH_KEY,
    speechServiceRegion: process.env.AZURE_SPEECH_REGION,
  },

  // Authentication
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    jwtExpiration: process.env.JWT_EXPIRATION || '24h',
    refreshTokenExpiration: process.env.REFRESH_TOKEN_EXPIRATION || '7d',
  },

  // Rate limiting
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 100,
  },

  // Instagram API
  instagram: {
    graphApiVersion: process.env.INSTAGRAM_API_VERSION || 'v18.0',
    baseUrl: 'https://graph.facebook.com',
  },

  // Application features
  features: {
    enableSwagger: process.env.NODE_ENV !== 'production',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    enableDetailedLogs: process.env.ENABLE_DETAILED_LOGS === 'true',
  },
}); 
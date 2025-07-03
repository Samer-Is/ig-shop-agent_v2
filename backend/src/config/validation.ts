// Validation schema - to be enhanced with Joi in Phase 1
export const validationSchema = {
  // Basic validation for Phase 0
  // Will be replaced with proper Joi validation in Phase 1
  
  validate: (config: Record<string, any>) => {
    const required = ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET', 'OPENAI_API_KEY'];
    const missing = required.filter(key => !config[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    return config;
  }
}; 
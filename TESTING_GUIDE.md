# Instagram AI Agent SaaS Platform - Testing Guide

## Prerequisites

### Required Software
1. **Node.js** (v18 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version` and `npm --version`

2. **Azure Account** with active subscription
   - Sign up at: https://azure.microsoft.com/
   - Install Azure CLI: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli

3. **Meta Developer Account** 
   - Create at: https://developers.facebook.com/
   - Set up Instagram Basic Display API app

### Environment Setup

#### 1. Azure Infrastructure Deployment
```bash
# Clone repository
git clone <your-repo-url>
cd insta_agent_gemini

# Deploy Azure resources
cd azure
chmod +x deploy.sh
./deploy.sh dev  # For development environment

# Or use PowerShell on Windows
.\deploy.ps1 -Environment dev
```

#### 2. Backend Configuration
```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Update .env with your Azure resource values:
# - DATABASE_CONNECTION_STRING (from Cosmos DB)
# - AZURE_KEY_VAULT_URL (from Key Vault deployment)
# - OPENAI_ENDPOINT (from Azure OpenAI service)
# - JWT_SECRET (generate a secure random string)
```

#### 3. Frontend Configuration  
```bash
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Update .env.local with:
# VITE_API_BASE_URL=http://localhost:3000
# VITE_FACEBOOK_APP_ID=<your-facebook-app-id>
```

#### 4. Meta Webhooks Setup
1. Create Instagram app in Meta Developer Console
2. Add Instagram Basic Display product
3. Configure webhooks URL: `https://<your-backend-url>/api/webhooks/instagram`
4. Subscribe to message events

## Testing Phases

### Phase 0 ✅ Infrastructure Testing

#### Azure Resources Verification
```bash
# Check resource group
az group show --name InstagramAIAgent-dev-rg

# Verify Cosmos DB
az cosmosdb show --name <cosmosdb-name> --resource-group InstagramAIAgent-dev-rg

# Test Key Vault access
az keyvault secret list --vault-name <keyvault-name>

# Check OpenAI deployment
az cognitiveservices account show --name <openai-name> --resource-group InstagramAIAgent-dev-rg
```

#### Expected Results
- ✅ All Azure resources provisioned successfully
- ✅ Cosmos DB containers created (merchants, whitelist, orders, conversations)
- ✅ Key Vault accessible with proper permissions
- ✅ OpenAI service deployed with GPT-4o models

### Phase 1 ✅ Backend Foundation Testing

#### 1. Start Backend Server
```bash
cd backend
npm run start:dev
```

#### 2. Test Merchant Authentication
```bash
# Test whitelist endpoint (should require whitelisted Instagram page)
curl -X POST http://localhost:3000/api/onboard \
  -H "Content-Type: application/json" \
  -d '{"code":"test_auth_code","state":"test_state"}'
```

#### 3. Test Merchant API Endpoints
```bash
# Get merchant data (requires JWT token)
curl -X GET http://localhost:3000/api/merchant/me \
  -H "Authorization: Bearer <jwt-token>"

# Update product catalog
curl -X PUT http://localhost:3000/api/merchant/product-catalog \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '[{"id":"1","name":"Test Product","description":"Test","price":10,"currency":"JOD","stock":5,"category":"Test","isActive":true,"mediaLinks":[]}]'
```

#### Expected Results
- ✅ Server starts without errors
- ✅ Authentication endpoints respond correctly
- ✅ CRUD operations work for merchant data
- ✅ JWT authentication protects endpoints properly

### Phase 2 ✅ AI Conversation Testing

#### 1. Test Webhook Verification
```bash
# Meta webhook verification
curl -X GET "http://localhost:3000/api/webhooks/instagram?hub.mode=subscribe&hub.challenge=test&hub.verify_token=your_verify_token"
```

#### 2. Simulate Instagram Message
```bash
curl -X POST http://localhost:3000/api/webhooks/instagram \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=<calculated-signature>" \
  -d '{
    "object": "instagram",
    "entry": [{
      "id": "page_id",
      "messaging": [{
        "sender": {"id": "user_id"},
        "recipient": {"id": "page_id"},
        "timestamp": 1234567890,
        "message": {"text": "Hello, what products do you have?"}
      }]
    }]
  }'
```

#### 3. Test AI Response Generation
```bash
# Direct AI testing
curl -X POST http://localhost:3000/api/merchant/test-ai \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "What products do you sell?"}'
```

#### Expected Results
- ✅ Webhook verification passes
- ✅ Message processing triggers AI response
- ✅ AI generates contextual responses using merchant data
- ✅ Responses sent back via Instagram Graph API

### Phase 3 ✅ Frontend Dashboard Testing

#### 1. Start Frontend Development Server
```bash
cd frontend
npm run dev
```

#### 2. Authentication Flow Testing
1. Navigate to `http://localhost:5173`
2. Click "Login with Instagram"
3. Complete OAuth flow
4. Verify redirect to dashboard

#### 3. Dashboard Functionality Testing

##### Product Catalog Management
1. Navigate to Product Catalog page
2. Test adding new product:
   - Fill all required fields
   - Upload product image
   - Save and verify in list
3. Test editing existing product
4. Test product search and filtering
5. Test product deletion

##### Business Settings
1. Navigate to Business Settings
2. Test Business Info tab:
   - Update working hours
   - Add contact information
   - Save changes
3. Test AI Settings tab:
   - Customize AI prompt
   - Change response style
   - Enable/disable features
   - Save configuration

##### Chat Playground
1. Navigate to Chat Playground
2. Send test messages
3. Verify AI responses match configuration
4. Test bilingual responses (English/Arabic)
5. Check response confidence scores

##### Data Export
1. Navigate to Export Data
2. Test CSV export for:
   - Product catalog
   - Business information
   - Combined data
3. Verify file downloads correctly

#### Expected Results
- ✅ Login flow completes successfully
- ✅ All dashboard pages load without errors
- ✅ Product CRUD operations work correctly
- ✅ Settings can be updated and saved
- ✅ Chat playground shows real AI responses
- ✅ Data export generates proper CSV files
- ✅ Responsive design works on mobile devices

## End-to-End Testing Scenarios

### Scenario 1: New Merchant Onboarding
1. Admin adds Instagram page ID to whitelist
2. Merchant attempts Instagram OAuth login
3. System creates merchant account
4. Merchant configures product catalog
5. Merchant sets up business information
6. Merchant customizes AI settings
7. Customer sends Instagram DM
8. AI processes and responds appropriately

### Scenario 2: Product Inquiry Flow
1. Customer sends message: "Do you have smartphones?"
2. AI searches merchant's product catalog
3. AI responds with available smartphone options
4. Customer asks for specific product details
5. AI provides detailed product information
6. Customer inquires about pricing and availability
7. AI provides current pricing and stock status

### Scenario 3: Business Hours Inquiry
1. Customer sends message outside business hours
2. AI detects time-based context
3. AI responds with business hours information
4. AI offers to take contact information for follow-up
5. System logs interaction for merchant review

## Performance Testing

### Load Testing
```bash
# Install artillery for load testing
npm install -g artillery

# Test webhook endpoint
artillery quick --count 100 --num 10 http://localhost:3000/api/webhooks/instagram

# Test API endpoints
artillery quick --count 50 --num 5 http://localhost:3000/api/merchant/me
```

### Expected Performance
- ✅ Webhook processes 100+ messages/second
- ✅ API responses under 500ms
- ✅ Frontend loads under 3 seconds
- ✅ AI responses generated under 5 seconds

## Error Testing

### Test Error Scenarios
1. **Invalid JWT tokens** - Should return 401 Unauthorized
2. **Missing merchant data** - Should create default values
3. **AI service unavailable** - Should return fallback response
4. **Instagram API errors** - Should retry with exponential backoff
5. **Webhook signature mismatch** - Should reject request
6. **Database connection issues** - Should return appropriate error

## Security Testing

### Authentication & Authorization
- ✅ JWT tokens properly validated
- ✅ Merchant can only access own data
- ✅ Webhook signatures verified
- ✅ Environment variables secured
- ✅ API keys stored in Key Vault

### Input Validation
- ✅ SQL injection prevention
- ✅ XSS protection in frontend
- ✅ Message content sanitization
- ✅ File upload restrictions
- ✅ Rate limiting on endpoints

## Monitoring & Debugging

### Application Insights
- View real-time metrics in Azure Portal
- Monitor API response times
- Track error rates and exceptions
- Analyze user behavior flows

### Logging
```bash
# Check backend logs
cd backend
npm run start:dev | grep ERROR

# Check frontend console for errors
# Open browser developer tools -> Console tab
```

### Health Checks
```bash
# Backend health
curl http://localhost:3000/health

# Database connectivity
curl http://localhost:3000/api/health/database

# AI service connectivity  
curl http://localhost:3000/api/health/ai
```

## Troubleshooting Common Issues

### Issue: "Node.js not found"
**Solution**: Install Node.js from nodejs.org and restart terminal

### Issue: "Azure CLI not authenticated" 
**Solution**: Run `az login` and authenticate with your Azure account

### Issue: "Instagram OAuth fails"
**Solution**: 
1. Check Facebook App ID in environment variables
2. Verify redirect URLs in Meta Developer Console
3. Ensure Instagram page is whitelisted

### Issue: "AI responses not generating"
**Solution**:
1. Check Azure OpenAI service deployment
2. Verify API keys in Key Vault
3. Check merchant configuration exists

### Issue: "Webhook not receiving messages"
**Solution**:
1. Verify webhook URL in Meta Developer Console
2. Check webhook signature verification
3. Ensure HTTPS for production webhooks

## Ready for Production

After successful testing:

1. **Deploy to Production Azure Environment**
   ```bash
   cd azure
   ./deploy.sh prod
   ```

2. **Configure Production Environment Variables**
   - Update all .env files with production values
   - Use production Facebook App credentials
   - Configure production domain URLs

3. **Set up Production Monitoring**
   - Configure Application Insights alerts
   - Set up health check monitoring
   - Enable automated backups

4. **Security Hardening**
   - Enable Azure DDoS protection
   - Configure Web Application Firewall
   - Set up SSL certificates
   - Review and update security policies

## Success Criteria

The platform is ready for production when:
- ✅ All automated tests pass
- ✅ End-to-end scenarios work flawlessly  
- ✅ Performance meets requirements
- ✅ Security vulnerabilities addressed
- ✅ Monitoring and alerting configured
- ✅ Documentation complete and updated

## Next Steps: Phase 4 - Advanced AI Features

Once Phase 3 testing is complete, proceed to Phase 4:
- Sentiment analysis implementation
- Intent classification and analytics
- Voice message transcription
- Advanced conversation context tracking

---

**Last Updated**: December 18, 2024
**Version**: 3.0 (Phase 3 Complete) 

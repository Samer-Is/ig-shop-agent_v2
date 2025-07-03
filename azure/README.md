# Azure Infrastructure Deployment

This directory contains Infrastructure as Code (IaC) templates and scripts to provision all required Azure resources for the Instagram AI Agent SaaS Platform.

## Overview

The deployment creates the following Azure resources:

- **Azure Cosmos DB**: NoSQL database with containers for merchants, orders, whitelist, and conversations
- **Azure Key Vault**: Secure storage for API keys and secrets
- **Azure OpenAI Service**: GPT-4o deployment for AI conversation engine
- **Azure App Service**: Backend API hosting (NestJS)
- **Azure Static Web Apps**: Frontend hosting (React/Vite)
- **Azure Cognitive Services**: Speech-to-text and sentiment analysis
- **Azure Cognitive Search**: Knowledge base indexing and retrieval
- **Azure Blob Storage**: File storage for documents and media
- **Azure Application Insights**: Monitoring and analytics

## Prerequisites

### For PowerShell (Windows)
- [Azure PowerShell module](https://docs.microsoft.com/en-us/powershell/azure/install-az-ps)
- [Azure Bicep CLI](https://docs.microsoft.com/en-us/azure/azure-resource-manager/bicep/install)

### For Bash (Linux/macOS)
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- [jq](https://stedolan.github.io/jq/) for JSON processing
- [Azure Bicep CLI](https://docs.microsoft.com/en-us/azure/azure-resource-manager/bicep/install)

## Quick Start

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd insta_agent_gemini/azure
```

### 2. Configure Parameters
Edit `bicep/parameters.dev.json` with your specific values:

```json
{
  "parameters": {
    "environment": { "value": "dev" },
    "appName": { "value": "insta-agent" },
    "location": { "value": "eastus" },
    "facebookAppId": { "value": "YOUR_FACEBOOK_APP_ID" },
    "facebookAppSecret": { "value": "YOUR_FACEBOOK_APP_SECRET" },
    "openAiApiKey": { "value": "YOUR_OPENAI_API_KEY" },
    "adminEmail": { "value": "your-email@domain.com" }
  }
}
```

### 3. Deploy Infrastructure

#### Using PowerShell (Windows)
```powershell
.\deploy.ps1 -SubscriptionId "YOUR_SUBSCRIPTION_ID"
```

#### Using Bash (Linux/macOS)
```bash
chmod +x deploy.sh
./deploy.sh -s "YOUR_SUBSCRIPTION_ID"
```

## Deployment Scripts

### PowerShell Script (`deploy.ps1`)
```powershell
# Basic deployment
.\deploy.ps1 -SubscriptionId "12345678-1234-1234-1234-123456789abc"

# Custom environment and location
.\deploy.ps1 -SubscriptionId "12345678-1234-1234-1234-123456789abc" -Environment "staging" -Location "westus2"

# Custom resource group
.\deploy.ps1 -SubscriptionId "12345678-1234-1234-1234-123456789abc" -ResourceGroupName "my-custom-rg"
```

### Bash Script (`deploy.sh`)
```bash
# Basic deployment
./deploy.sh -s "12345678-1234-1234-1234-123456789abc"

# Custom environment and location
./deploy.sh -s "12345678-1234-1234-1234-123456789abc" -e "staging" -l "westus2"

# Custom resource group
./deploy.sh -s "12345678-1234-1234-1234-123456789abc" -r "my-custom-rg"

# Help
./deploy.sh -h
```

## File Structure

```
azure/
├── bicep/
│   ├── main.bicep                 # Main template
│   ├── parameters.dev.json        # Development parameters
│   └── modules/
│       ├── cosmosdb.bicep         # Cosmos DB resources
│       ├── keyvault.bicep         # Key Vault resources
│       ├── openai.bicep           # Azure OpenAI resources
│       ├── appservice.bicep       # App Service resources
│       ├── staticwebapp.bicep     # Static Web App resources
│       ├── cognitive.bicep        # Cognitive Services resources
│       ├── search.bicep           # Cognitive Search resources
│       ├── storage.bicep          # Blob Storage resources
│       └── appinsights.bicep      # Application Insights resources
├── deploy.ps1                     # PowerShell deployment script
├── deploy.sh                      # Bash deployment script
└── README.md                      # This file
```

## Resource Naming Convention

Resources are named using the pattern: `{appName}-{environment}-{resourceType}`

For example, with `appName: "insta-agent"` and `environment: "dev"`:
- Resource Group: `rg-insta-agent-dev`
- Cosmos DB: `insta-agent-dev-cosmos`
- Key Vault: `insta-agent-dev-kv`
- App Service: `insta-agent-dev-api`
- Static Web App: `insta-agent-dev-swa`

## Environment-Specific Deployments

### Development Environment
```bash
./deploy.sh -s "YOUR_SUBSCRIPTION_ID" -e "dev"
```

### Staging Environment
```bash
./deploy.sh -s "YOUR_SUBSCRIPTION_ID" -e "staging"
```

### Production Environment
```bash
./deploy.sh -s "YOUR_SUBSCRIPTION_ID" -e "prod"
```

Make sure to create corresponding parameter files:
- `bicep/parameters.dev.json`
- `bicep/parameters.staging.json`
- `bicep/parameters.prod.json`

## Post-Deployment Configuration

After deployment completes, you'll need to:

### 1. Configure GitHub Actions Secrets
Add the following secrets to your GitHub repository:

```
AZURE_SUBSCRIPTION_ID
AZURE_RESOURCE_GROUP
AZURE_APP_SERVICE_NAME
AZURE_STATIC_WEB_APP_NAME
AZURE_KEY_VAULT_URL
AZURE_COSMOS_DB_ENDPOINT
AZURE_OPENAI_ENDPOINT
```

### 2. Configure Static Web App
Connect your Static Web App to your GitHub repository:

1. Go to Azure Portal → Static Web Apps → your app
2. Click "Manage deployment token"
3. Copy the deployment token
4. Add it as `AZURE_STATIC_WEB_APPS_API_TOKEN` in GitHub secrets

### 3. Configure Custom Domain (Optional)
1. Purchase a domain
2. Configure DNS settings
3. Add custom domain in Azure Portal

## Monitoring and Maintenance

### Application Insights
- Dashboard: Check Azure Portal → Application Insights → your app
- Logs: Use Kusto queries for detailed analysis
- Alerts: Configured for failure rate and response time

### Cost Monitoring
- Set up budget alerts in Azure Cost Management
- Monitor usage in Azure Portal
- Consider scaling down development resources when not in use

### Security
- Review Key Vault access policies regularly
- Rotate secrets periodically
- Monitor security recommendations in Azure Security Center

## Troubleshooting

### Common Issues

#### 1. Authentication Failures
```bash
# Re-login to Azure
az login
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

#### 2. Resource Name Conflicts
- Resource names must be globally unique
- Modify the `appName` parameter if conflicts occur

#### 3. Quota Limitations
- Check Azure subscription quotas
- Request quota increases if needed

#### 4. OpenAI Service Availability
- OpenAI service is only available in specific regions
- Use `eastus` or `westus2` for best availability

#### 5. Template Validation Errors
```bash
# Validate template manually
az deployment group validate \
  --resource-group "YOUR_RESOURCE_GROUP" \
  --template-file "bicep/main.bicep" \
  --parameters "@bicep/parameters.dev.json"
```

### Getting Help

1. Check Azure Portal for detailed error messages
2. Review deployment logs in Azure Portal → Deployments
3. Use Azure CLI for debugging:
   ```bash
   az deployment group show \
     --resource-group "YOUR_RESOURCE_GROUP" \
     --name "YOUR_DEPLOYMENT_NAME"
   ```

### Clean Up Resources

To delete all resources:

```bash
# Delete the entire resource group
az group delete --name "rg-insta-agent-dev" --yes --no-wait
```

## Cost Optimization

### Development Environment
- Use Basic tier for App Service
- Use Free tier for Static Web Apps
- Use Serverless for Cosmos DB
- Schedule auto-shutdown for non-production resources

### Production Environment
- Enable autoscaling for App Service
- Use reserved instances for predictable workloads
- Implement lifecycle policies for Blob Storage
- Monitor and optimize based on usage patterns

## Next Steps

After successful deployment:

1. ✅ **Task 0.2 Complete**: Azure infrastructure provisioned
2. 🔄 **Task 0.3**: Set up CI/CD pipeline
3. 🔄 **Phase 1**: Begin backend development

## Support

For issues related to:
- **Azure resources**: Contact Azure Support
- **Deployment scripts**: Create an issue in the repository
- **Application code**: Review the main project documentation 

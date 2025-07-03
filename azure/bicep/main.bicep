// Main Bicep template for Instagram AI Agent SaaS Platform
// This template provisions all required Azure resources for Phase 0

@description('Environment name (dev, staging, prod)')
param environment string = 'dev'

@description('Application name prefix')
param appName string = 'insta-agent'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Facebook App ID for Instagram integration')
@secure()
param facebookAppId string

@description('Facebook App Secret for Instagram integration')
@secure()
param facebookAppSecret string

@description('OpenAI API Key for GPT-4o integration')
@secure()
param openAiApiKey string

@description('Administrator email for notifications')
param adminEmail string

// Variables
var resourceNamePrefix = '${appName}-${environment}'
var tags = {
  Environment: environment
  Project: 'Instagram AI Agent SaaS'
  Owner: 'Development Team'
  CostCenter: 'Engineering'
}

// Resource Group is assumed to exist (created separately)

// 1. Azure Cosmos DB Account
module cosmosDb 'modules/cosmosdb.bicep' = {
  name: 'cosmosdb-deployment'
  params: {
    accountName: '${resourceNamePrefix}-cosmos'
    location: location
    tags: tags
    databaseName: 'SaaSPlatformDB'
  }
}

// 2. Azure Key Vault
module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault-deployment'
  params: {
    keyVaultName: '${resourceNamePrefix}-kv'
    location: location
    tags: tags
    secrets: [
      {
        name: 'facebook-app-id'
        value: facebookAppId
      }
      {
        name: 'facebook-app-secret'
        value: facebookAppSecret
      }
      {
        name: 'openai-api-key'
        value: openAiApiKey
      }
      {
        name: 'cosmos-connection-string'
        value: cosmosDb.outputs.connectionString
      }
    ]
  }
}

// 3. Azure OpenAI Service
module openAi 'modules/openai.bicep' = {
  name: 'openai-deployment'
  params: {
    accountName: '${resourceNamePrefix}-openai'
    location: 'eastus' // OpenAI is not available in all regions
    tags: tags
  }
}

// 4. Azure App Service Plan & App Service (Backend)
module appService 'modules/appservice.bicep' = {
  name: 'appservice-deployment'
  params: {
    appServicePlanName: '${resourceNamePrefix}-asp'
    appServiceName: '${resourceNamePrefix}-api'
    location: location
    tags: tags
    keyVaultName: keyVault.outputs.keyVaultName
    cosmosEndpoint: cosmosDb.outputs.endpoint
    openAiEndpoint: openAi.outputs.endpoint
  }
}

// 5. Azure Static Web Apps (Frontend)
module staticWebApp 'modules/staticwebapp.bicep' = {
  name: 'staticwebapp-deployment'
  params: {
    staticWebAppName: '${resourceNamePrefix}-swa'
    location: 'centralus' // Static Web Apps have limited regions
    tags: tags
    apiUrl: appService.outputs.appServiceUrl
  }
}

// 6. Azure Cognitive Services (Speech-to-Text)
module cognitiveServices 'modules/cognitive.bicep' = {
  name: 'cognitive-deployment'
  params: {
    accountName: '${resourceNamePrefix}-cognitive'
    location: location
    tags: tags
  }
}

// 7. Azure Cognitive Search
module cognitiveSearch 'modules/search.bicep' = {
  name: 'search-deployment'
  params: {
    searchServiceName: '${resourceNamePrefix}-search'
    location: location
    tags: tags
  }
}

// 8. Azure Blob Storage
module blobStorage 'modules/storage.bicep' = {
  name: 'storage-deployment'
  params: {
    storageAccountName: '${replace(resourceNamePrefix, '-', '')}storage'
    location: location
    tags: tags
  }
}

// 9. Azure Application Insights
module appInsights 'modules/appinsights.bicep' = {
  name: 'appinsights-deployment'
  params: {
    appInsightsName: '${resourceNamePrefix}-ai'
    location: location
    tags: tags
  }
}

// Outputs
output resourceGroupName string = resourceGroup().name
output cosmosDbEndpoint string = cosmosDb.outputs.endpoint
output keyVaultUrl string = keyVault.outputs.keyVaultUrl
output openAiEndpoint string = openAi.outputs.endpoint
output appServiceUrl string = appService.outputs.appServiceUrl
output staticWebAppUrl string = staticWebApp.outputs.staticWebAppUrl
output blobStorageEndpoint string = blobStorage.outputs.primaryEndpoint
output searchServiceEndpoint string = cognitiveSearch.outputs.searchServiceUrl
output appInsightsInstrumentationKey string = appInsights.outputs.instrumentationKey 
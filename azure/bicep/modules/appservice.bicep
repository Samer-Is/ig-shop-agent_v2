// App Service module for Instagram AI Agent SaaS Platform Backend
@description('App Service Plan name')
param appServicePlanName string

@description('App Service name')
param appServiceName string

@description('Location for App Service')
param location string

@description('Tags for resources')
param tags object

@description('Key Vault name for configuration')
param keyVaultName string

@description('Cosmos DB endpoint')
param cosmosEndpoint string

@description('OpenAI endpoint')
param openAiEndpoint string

@description('SKU for App Service Plan')
param skuName string = 'B1'

@description('Number of instances')
param skuCapacity int = 1

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  sku: {
    name: skuName
    capacity: skuCapacity
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

// App Service
resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: appServiceName
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    reserved: true
    siteConfig: {
      linuxFxVersion: 'NODE|18-lts'
      alwaysOn: true
      ftpsState: 'Disabled'
      httpLoggingEnabled: true
      requestTracingEnabled: true
      detailedErrorLoggingEnabled: true
      appSettings: [
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'PORT'
          value: '8000'
        }
        {
          name: 'WEBSITES_PORT'
          value: '8000'
        }
        {
          name: 'COSMOS_DB_ENDPOINT'
          value: cosmosEndpoint
        }
        {
          name: 'OPENAI_ENDPOINT'
          value: openAiEndpoint
        }
        {
          name: 'KEY_VAULT_URL'
          value: 'https://${keyVaultName}.vault.azure.net/'
        }
        // Secrets will be configured via Key Vault references
        {
          name: 'FACEBOOK_APP_ID'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=facebook-app-id)'
        }
        {
          name: 'FACEBOOK_APP_SECRET'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=facebook-app-secret)'
        }
        {
          name: 'OPENAI_API_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=openai-api-key)'
        }
        {
          name: 'COSMOS_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=cosmos-connection-string)'
        }
        {
          name: 'JWT_SECRET'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=jwt-secret)'
        }
        {
          name: 'WEBHOOK_VERIFY_TOKEN'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=webhook-verify-token)'
        }
        // Enable Application Insights
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=appinsights-instrumentation-key)'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=appinsights-connection-string)'
        }
        // Performance and monitoring
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '18.17.1'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
      ]
      cors: {
        allowedOrigins: [
          'https://*.azurestaticapps.net'
          'http://localhost:5173'
          'http://localhost:3000'
        ]
        supportCredentials: true
      }
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      use32BitWorkerProcess: false
      webSocketsEnabled: false
      managedPipelineMode: 'Integrated'
      requestTimeout: '00:04:00'
    }
    httpsOnly: true
    clientAffinityEnabled: false
  }
}

// Key Vault access policy for App Service managed identity
resource keyVaultAccessPolicy 'Microsoft.KeyVault/vaults/accessPolicies@2023-07-01' = {
  name: '${keyVaultName}/add'
  properties: {
    accessPolicies: [
      {
        tenantId: appService.identity.tenantId
        objectId: appService.identity.principalId
        permissions: {
          secrets: [
            'get'
            'list'
          ]
        }
      }
    ]
  }
}

// Deployment slot for staging (Blue-Green deployment)
resource stagingSlot 'Microsoft.Web/sites/slots@2023-01-01' = {
  parent: appService
  name: 'staging'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|18-lts'
      alwaysOn: true
      appSettings: [
        {
          name: 'NODE_ENV'
          value: 'staging'
        }
        {
          name: 'PORT'
          value: '8000'
        }
        {
          name: 'WEBSITES_PORT'
          value: '8000'
        }
      ]
    }
  }
}

// Outputs
output appServiceName string = appService.name
output appServiceUrl string = 'https://${appService.properties.defaultHostName}'
output appServiceId string = appService.id
output principalId string = appService.identity.principalId
output stagingUrl string = 'https://${stagingSlot.properties.defaultHostName}' 
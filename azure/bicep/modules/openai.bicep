// Azure OpenAI module for Instagram AI Agent SaaS Platform
@description('OpenAI account name')
param accountName string

@description('Location for OpenAI account')
param location string = 'eastus'

@description('Tags for resources')
param tags object

@description('SKU name for OpenAI service')
param skuName string = 'S0'

// Azure OpenAI Account
resource openAiAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: accountName
  location: location
  tags: tags
  kind: 'OpenAI'
  sku: {
    name: skuName
  }
  properties: {
    customSubDomainName: accountName
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

// GPT-4o Model Deployment
resource gpt4oDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openAiAccount
  name: 'gpt-4o'
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o'
      version: '2024-05-13'
    }
    raiPolicyName: 'Microsoft.DefaultV2'
  }
  sku: {
    name: 'Standard'
    capacity: 30
  }
}

// Text Embedding Model Deployment (for RAG functionality)
resource embeddingDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openAiAccount
  name: 'text-embedding-ada-002'
  dependsOn: [gpt4oDeployment] // Deploy sequentially
  properties: {
    model: {
      format: 'OpenAI'
      name: 'text-embedding-ada-002'
      version: '2'
    }
    raiPolicyName: 'Microsoft.DefaultV2'
  }
  sku: {
    name: 'Standard'
    capacity: 30
  }
}

// GPT-4o Mini Model Deployment (for faster/cheaper operations)
resource gpt4oMiniDeployment 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = {
  parent: openAiAccount
  name: 'gpt-4o-mini'
  dependsOn: [embeddingDeployment] // Deploy sequentially
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4o-mini'
      version: '2024-07-18'
    }
    raiPolicyName: 'Microsoft.DefaultV2'
  }
  sku: {
    name: 'Standard'
    capacity: 50
  }
}

// Outputs
output accountName string = openAiAccount.name
output endpoint string = openAiAccount.properties.endpoint
output accountId string = openAiAccount.id
output primaryKey string = openAiAccount.listKeys().key1
output deployments object = {
  'gpt-4o': {
    name: gpt4oDeployment.name
    endpoint: '${openAiAccount.properties.endpoint}openai/deployments/${gpt4oDeployment.name}'
  }
  'text-embedding-ada-002': {
    name: embeddingDeployment.name
    endpoint: '${openAiAccount.properties.endpoint}openai/deployments/${embeddingDeployment.name}'
  }
  'gpt-4o-mini': {
    name: gpt4oMiniDeployment.name
    endpoint: '${openAiAccount.properties.endpoint}openai/deployments/${gpt4oMiniDeployment.name}'
  }
} 
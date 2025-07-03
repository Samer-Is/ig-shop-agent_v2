// Azure Cognitive Search module for Instagram AI Agent SaaS Platform
@description('Search service name')
param searchServiceName string

@description('Location for Search service')
param location string

@description('Tags for resources')
param tags object

@description('SKU for Search service')
param skuName string = 'basic'

@description('Number of replicas')
param replicaCount int = 1

@description('Number of partitions')
param partitionCount int = 1

// Azure Cognitive Search Service
resource searchService 'Microsoft.Search/searchServices@2023-11-01' = {
  name: searchServiceName
  location: location
  tags: tags
  sku: {
    name: skuName
  }
  properties: {
    replicaCount: replicaCount
    partitionCount: partitionCount
    hostingMode: 'default'
    publicNetworkAccess: 'enabled'
    networkRuleSet: {
      ipRules: []
    }
    encryptionWithCmk: {
      enforcement: 'Unspecified'
    }
    disableLocalAuth: false
    authOptions: {
      apiKeyOnly: {}
    }
    semanticSearch: 'free'
  }
}

// Outputs
output searchServiceName string = searchService.name
output searchServiceUrl string = 'https://${searchService.name}.search.windows.net'
output searchServiceId string = searchService.id
output primaryKey string = searchService.listAdminKeys().primaryKey
output secondaryKey string = searchService.listAdminKeys().secondaryKey
output queryKey string = searchService.listQueryKeys().value[0].key 
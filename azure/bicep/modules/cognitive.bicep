// Cognitive Services module for Instagram AI Agent SaaS Platform
@description('Cognitive Services account name')
param accountName string

@description('Location for Cognitive Services')
param location string

@description('Tags for resources')
param tags object

@description('SKU for Cognitive Services')
param skuName string = 'S0'

// Multi-service Cognitive Services Account
resource cognitiveServicesAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: accountName
  location: location
  tags: tags
  kind: 'CognitiveServices'
  sku: {
    name: skuName
  }
  properties: {
    customSubDomainName: accountName
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
    apiProperties: {}
  }
}

// Speech Services (dedicated for better performance)
resource speechServicesAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: '${accountName}-speech'
  location: location
  tags: tags
  kind: 'SpeechServices'
  sku: {
    name: skuName
  }
  properties: {
    customSubDomainName: '${accountName}-speech'
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

// Computer Vision (for analyzing images in Instagram messages)
resource computerVisionAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: '${accountName}-vision'
  location: location
  tags: tags
  kind: 'ComputerVision'
  sku: {
    name: skuName
  }
  properties: {
    customSubDomainName: '${accountName}-vision'
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

// Text Analytics (for sentiment analysis)
resource textAnalyticsAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: '${accountName}-text'
  location: location
  tags: tags
  kind: 'TextAnalytics'
  sku: {
    name: skuName
  }
  properties: {
    customSubDomainName: '${accountName}-text'
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

// Outputs
output multiServiceAccountName string = cognitiveServicesAccount.name
output multiServiceEndpoint string = cognitiveServicesAccount.properties.endpoint
output multiServiceKey string = cognitiveServicesAccount.listKeys().key1

output speechAccountName string = speechServicesAccount.name
output speechEndpoint string = speechServicesAccount.properties.endpoint
output speechKey string = speechServicesAccount.listKeys().key1
output speechRegion string = location

output visionAccountName string = computerVisionAccount.name
output visionEndpoint string = computerVisionAccount.properties.endpoint
output visionKey string = computerVisionAccount.listKeys().key1

output textAccountName string = textAnalyticsAccount.name
output textEndpoint string = textAnalyticsAccount.properties.endpoint
output textKey string = textAnalyticsAccount.listKeys().key1 
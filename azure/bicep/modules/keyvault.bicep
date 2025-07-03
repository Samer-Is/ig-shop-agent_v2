// Key Vault module for Instagram AI Agent SaaS Platform
@description('Key Vault name')
param keyVaultName string

@description('Location for Key Vault')
param location string

@description('Tags for resources')
param tags object

@description('Array of secrets to store')
param secrets array = []

@description('Object ID of the user/service principal that will have access')
param objectId string = ''

// Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enablePurgeProtection: false
    enableRbacAuthorization: false
    accessPolicies: [
      // Access policy for the current deployment
      {
        tenantId: subscription().tenantId
        objectId: objectId != '' ? objectId : 'PLACEHOLDER-OBJECT-ID'
        permissions: {
          keys: [
            'get'
            'list'
            'create'
            'update'
            'delete'
          ]
          secrets: [
            'get'
            'list'
            'set'
            'delete'
          ]
          certificates: [
            'get'
            'list'
            'create'
            'update'
            'delete'
          ]
        }
      }
    ]
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// Store secrets
resource keyVaultSecrets 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = [for secret in secrets: {
  parent: keyVault
  name: secret.name
  properties: {
    value: secret.value
    attributes: {
      enabled: true
    }
  }
}]

// Additional secrets that will be added later
resource jwtSecretPlaceholder 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'jwt-secret'
  properties: {
    value: base64(uniqueString(keyVault.id, 'jwt-secret'))
    attributes: {
      enabled: true
    }
  }
}

resource webhookSecretPlaceholder 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'webhook-verify-token'
  properties: {
    value: base64(uniqueString(keyVault.id, 'webhook-verify-token'))
    attributes: {
      enabled: true
    }
  }
}

// Outputs
output keyVaultName string = keyVault.name
output keyVaultUrl string = keyVault.properties.vaultUri
output keyVaultId string = keyVault.id 
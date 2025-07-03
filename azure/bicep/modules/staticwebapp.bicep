// Static Web App module for Instagram AI Agent SaaS Platform Frontend
@description('Static Web App name')
param staticWebAppName string

@description('Location for Static Web App')
param location string = 'centralus'

@description('Tags for resources')
param tags object

@description('API URL for backend integration')
param apiUrl string

@description('SKU for Static Web App')
param skuName string = 'Free'

// Static Web App
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: staticWebAppName
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuName
  }
  properties: {
    repositoryUrl: 'https://github.com/your-org/insta-agent-saas-platform'
    branch: 'main'
    buildProperties: {
      appLocation: '/frontend'
      apiLocation: ''
      outputLocation: 'dist'
      appBuildCommand: 'npm run build'
      apiBuildCommand: ''
    }
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    enterpriseGradeCdnStatus: 'Disabled'
  }
}

// Static Web App configuration
resource staticWebAppConfig 'Microsoft.Web/staticSites/config@2023-01-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    VITE_API_URL: apiUrl
    VITE_APP_NAME: 'Instagram AI Agent SaaS'
    VITE_APP_VERSION: '1.0.0'
    VITE_ENVIRONMENT: 'production'
  }
}

// Custom domain configuration (placeholder for future)
// This would be configured later with actual domain
/*
resource customDomain 'Microsoft.Web/staticSites/customDomains@2023-01-01' = {
  parent: staticWebApp
  name: 'app.instagramaiagent.com'
  properties: {
    validationMethod: 'cname-delegation'
  }
}
*/

// Outputs
output staticWebAppName string = staticWebApp.name
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output staticWebAppId string = staticWebApp.id
output repositoryToken string = staticWebApp.listSecrets().properties.apiKey 
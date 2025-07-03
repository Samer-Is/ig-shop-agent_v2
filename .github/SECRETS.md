# GitHub Actions Secrets Configuration

This document lists all the GitHub Actions secrets required for the CI/CD pipeline to function properly.

## 🔑 Required Secrets

### Azure Authentication Secrets

#### Development Environment
- `AZURE_CREDENTIALS_DEV`: Azure service principal credentials for development environment
- `AZURE_SUBSCRIPTION_ID_DEV`: Azure subscription ID for development
- `AZURE_WEBAPP_NAME_DEV`: Name of the Azure App Service for development
- `AZURE_WEBAPP_URL_DEV`: URL of the Azure App Service for development
- `AZURE_STATIC_WEB_APPS_API_TOKEN_DEV`: Deployment token for Azure Static Web Apps

#### Staging Environment
- `AZURE_CREDENTIALS_STAGING`: Azure service principal credentials for staging
- `AZURE_WEBAPP_NAME_STAGING`: Name of the Azure App Service for staging
- `AZURE_WEBAPP_URL_STAGING`: URL of the Azure App Service for staging
- `AZURE_STATIC_WEB_APPS_API_TOKEN_STAGING`: Deployment token for Azure Static Web Apps

#### Production Environment
- `AZURE_CREDENTIALS_PROD`: Azure service principal credentials for production
- `AZURE_WEBAPP_NAME_PROD`: Name of the Azure App Service for production
- `AZURE_WEBAPP_URL_PROD`: URL of the Azure App Service for production
- `AZURE_STATIC_WEB_APPS_API_TOKEN_PROD`: Deployment token for Azure Static Web Apps

### Application Secrets

#### Core Application Credentials
- `FACEBOOK_APP_ID`: Facebook App ID for Instagram integration
- `FACEBOOK_APP_SECRET`: Facebook App Secret for Instagram integration
- `OPENAI_API_KEY`: OpenAI API key for GPT-4o integration
- `ADMIN_EMAIL`: Administrator email for notifications

#### Frontend Environment URLs
- `API_URL_DEV`: Backend API URL for development environment
- `API_URL_STAGING`: Backend API URL for staging environment
- `API_URL_PROD`: Backend API URL for production environment
- `FRONTEND_URL_DEV`: Frontend URL for development environment
- `FRONTEND_URL_STAGING`: Frontend URL for staging environment
- `FRONTEND_URL_PROD`: Frontend URL for production environment

### Security and Monitoring

#### Code Quality Tools
- `SONAR_TOKEN`: SonarCloud token for code quality analysis
- `SNYK_TOKEN`: Snyk token for security vulnerability scanning
- `CODECOV_TOKEN`: Codecov token for test coverage reporting

#### Notifications
- `SLACK_WEBHOOK_URL`: Slack webhook URL for deployment notifications 

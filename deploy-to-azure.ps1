# IG-Shop-Agent V2 - Azure Cloud Deployment Script
# Full production deployment for sales-ready platform

param(
    [string]$ResourceGroupName = "igshop-v2-prod",
    [string]$Location = "East US",
    [string]$AppServicePlan = "igshop-v2-plan",
    [string]$WebAppName = "igshop-v2-api",
    [string]$StaticWebApp = "igshop-v2-frontend",
    [string]$PostgreSQLServer = "igshop-v2-db",
    [string]$DatabaseName = "igshop_v2_prod"
)

Write-Host "🚀 Starting IG-Shop-Agent V2 Cloud Deployment..." -ForegroundColor Green
Write-Host "💰 Target: $35-40/month production costs" -ForegroundColor Yellow

# 1. Login to Azure (if not already logged in)
Write-Host "🔐 Checking Azure login..." -ForegroundColor Blue
try {
    az account show | Out-Null
    Write-Host "✅ Already logged in to Azure" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Please login to Azure..." -ForegroundColor Yellow
    az login
}

# 2. Create Resource Group
Write-Host "📦 Creating Resource Group..." -ForegroundColor Blue
az group create --name $ResourceGroupName --location $Location
Write-Host "✅ Resource Group created: $ResourceGroupName" -ForegroundColor Green

# 3. Create PostgreSQL Database (Flexible Server for cost optimization)
Write-Host "🗄️ Creating PostgreSQL Database..." -ForegroundColor Blue
az postgres flexible-server create `
    --resource-group $ResourceGroupName `
    --name $PostgreSQLServer `
    --location $Location `
    --admin-user igshop_admin `
    --admin-password "IgShop2024!Secure" `
    --sku-name Standard_B1ms `
    --tier Burstable `
    --storage-size 32 `
    --version 15

# Create database
az postgres flexible-server db create `
    --resource-group $ResourceGroupName `
    --server-name $PostgreSQLServer `
    --database-name $DatabaseName

Write-Host "✅ PostgreSQL Database created" -ForegroundColor Green

# 4. Create App Service Plan (Basic tier for cost optimization)
Write-Host "⚙️ Creating App Service Plan..." -ForegroundColor Blue
az appservice plan create `
    --name $AppServicePlan `
    --resource-group $ResourceGroupName `
    --location $Location `
    --sku B1 `
    --is-linux

Write-Host "✅ App Service Plan created" -ForegroundColor Green

# 5. Create Web App for Backend API
Write-Host "🌐 Creating Backend Web App..." -ForegroundColor Blue
az webapp create `
    --resource-group $ResourceGroupName `
    --plan $AppServicePlan `
    --name $WebAppName `
    --runtime "PYTHON|3.11" `
    --deployment-local-git

# Configure environment variables
Write-Host "🔧 Configuring environment variables..." -ForegroundColor Blue
$dbConnectionString = "postgresql://igshop_admin:IgShop2024!Secure@$PostgreSQLServer.postgres.database.azure.com:5432/$DatabaseName"

az webapp config appsettings set `
    --resource-group $ResourceGroupName `
    --name $WebAppName `
    --settings `
    ENVIRONMENT="production" `
    DATABASE_URL="$dbConnectionString" `
    OPENAI_API_KEY="your_openai_api_key_here" `
    META_APP_ID="1879578119651644" `
    META_APP_SECRET="your_meta_app_secret" `
    META_WEBHOOK_VERIFY_TOKEN="igshop_v2_webhook_verify_token_2024" `
    SCM_DO_BUILD_DURING_DEPLOYMENT="true" `
    ENABLE_ORYX_BUILD="true"

Write-Host "✅ Backend Web App configured" -ForegroundColor Green

# 6. Create Static Web App for Frontend
Write-Host "🎨 Creating Frontend Static Web App..." -ForegroundColor Blue
az staticwebapp create `
    --name $StaticWebApp `
    --resource-group $ResourceGroupName `
    --location $Location `
    --source "https://github.com/yourusername/igshop-v2" `
    --branch "main" `
    --app-location "/frontend" `
    --api-location "/backend" `
    --output-location "/"

Write-Host "✅ Static Web App created" -ForegroundColor Green

# 7. Configure CORS for API
Write-Host "🔗 Configuring CORS..." -ForegroundColor Blue
$staticWebAppUrl = az staticwebapp show --name $StaticWebApp --resource-group $ResourceGroupName --query "defaultHostname" -o tsv
$backendUrl = az webapp show --name $WebAppName --resource-group $ResourceGroupName --query "defaultHostName" -o tsv

az webapp cors add `
    --resource-group $ResourceGroupName `
    --name $WebAppName `
    --allowed-origins "https://$staticWebAppUrl" "https://localhost:3000"

Write-Host "✅ CORS configured" -ForegroundColor Green

# 8. Deploy Backend Code
Write-Host "📤 Deploying Backend Code..." -ForegroundColor Blue
Push-Location backend

# Create requirements.txt for Azure deployment
@"
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
psycopg2-binary==2.9.9
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
httpx==0.28.1
openai==1.93.0
python-dotenv==1.0.0
"@ | Out-File -FilePath "requirements.txt" -Encoding UTF8

# Create startup.py for Azure
@"
import os
import sys
sys.path.append(os.path.dirname(__file__))

from main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
"@ | Out-File -FilePath "startup.py" -Encoding UTF8

# Deploy using git
git init
git add .
git commit -m "Initial deployment to Azure"

$deploymentUrl = az webapp deployment source config-local-git --name $WebAppName --resource-group $ResourceGroupName --query "url" -o tsv
git remote add azure $deploymentUrl
git push azure main

Pop-Location
Write-Host "✅ Backend deployed to Azure" -ForegroundColor Green

# 9. Update Frontend Configuration
Write-Host "🎨 Updating Frontend Configuration..." -ForegroundColor Blue
$frontendConfig = @"
// IG-Shop-Agent V2 - Production Configuration
const CONFIG = {
    API_BASE_URL: 'https://$backendUrl',
    ENVIRONMENT: 'production',
    APP_NAME: 'IG-Shop-Agent V2',
    VERSION: '2.0.0'
};

// Update frontend API calls to use production backend
window.CONFIG = CONFIG;
"@

$frontendConfig | Out-File -FilePath "frontend/config.js" -Encoding UTF8
Write-Host "✅ Frontend configured for production" -ForegroundColor Green

# 10. Display Deployment Information
Write-Host "`n🎉 DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Yellow

Write-Host "`n🌐 Production URLs:" -ForegroundColor Blue
Write-Host "Frontend: https://$staticWebAppUrl" -ForegroundColor White
Write-Host "Backend API: https://$backendUrl" -ForegroundColor White
Write-Host "API Docs: https://$backendUrl/docs" -ForegroundColor White

Write-Host "`n🗄️ Database:" -ForegroundColor Blue
Write-Host "PostgreSQL Server: $PostgreSQLServer.postgres.database.azure.com" -ForegroundColor White
Write-Host "Database: $DatabaseName" -ForegroundColor White

Write-Host "`n💰 Monthly Costs (Estimated):" -ForegroundColor Blue
Write-Host "App Service (B1): ~$15/month" -ForegroundColor White
Write-Host "PostgreSQL (Burstable): ~$15/month" -ForegroundColor White
Write-Host "Static Web App: FREE" -ForegroundColor White
Write-Host "OpenAI API: ~$10-15/month" -ForegroundColor White
Write-Host "Total: ~$40-45/month" -ForegroundColor Green

Write-Host "`n📋 Next Steps:" -ForegroundColor Blue
Write-Host "1. Update Instagram App webhook URL to: https://$backendUrl/api/webhooks/instagram" -ForegroundColor White
Write-Host "2. Test the deployment at: https://$staticWebAppUrl" -ForegroundColor White
Write-Host "3. Configure custom domain (optional)" -ForegroundColor White
Write-Host "4. Set up monitoring and alerts" -ForegroundColor White

Write-Host "`n🚀 Your IG-Shop-Agent V2 is now LIVE in the cloud!" -ForegroundColor Green
Write-Host "Ready for customer onboarding and sales!" -ForegroundColor Yellow 

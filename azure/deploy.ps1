# Azure Infrastructure Deployment Script for Instagram AI Agent SaaS Platform
# This script provisions all required Azure resources for Phase 0

param(
    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId,
    
    [Parameter(Mandatory=$false)]
    [string]$Environment = "dev",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "eastus",
    
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroupName = "rg-insta-agent-$Environment"
)

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "=== Instagram AI Agent SaaS Platform - Azure Infrastructure Deployment ===" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "Location: $Location" -ForegroundColor Yellow
Write-Host "Resource Group: $ResourceGroupName" -ForegroundColor Yellow
Write-Host ""

# Step 1: Login and select subscription
Write-Host "Step 1: Authenticating with Azure..." -ForegroundColor Green
try {
    $context = Get-AzContext
    if ($null -eq $context -or $context.Subscription.Id -ne $SubscriptionId) {
        Connect-AzAccount -SubscriptionId $SubscriptionId
    }
    Write-Host "✓ Successfully authenticated with Azure" -ForegroundColor Green
} catch {
    Write-Error "Failed to authenticate with Azure: $_"
    exit 1
}

# Step 2: Create Resource Group
Write-Host "Step 2: Creating Resource Group..." -ForegroundColor Green
try {
    $resourceGroup = Get-AzResourceGroup -Name $ResourceGroupName -ErrorAction SilentlyContinue
    if ($null -eq $resourceGroup) {
        $resourceGroup = New-AzResourceGroup -Name $ResourceGroupName -Location $Location
        Write-Host "✓ Created resource group: $ResourceGroupName" -ForegroundColor Green
    } else {
        Write-Host "✓ Resource group already exists: $ResourceGroupName" -ForegroundColor Yellow
    }
} catch {
    Write-Error "Failed to create resource group: $_"
    exit 1
}

# Step 3: Validate Bicep template
Write-Host "Step 3: Validating Bicep template..." -ForegroundColor Green
try {
    $templatePath = Join-Path $PSScriptRoot "bicep\main.bicep"
    $parametersPath = Join-Path $PSScriptRoot "bicep\parameters.$Environment.json"
    
    if (-not (Test-Path $templatePath)) {
        throw "Template file not found: $templatePath"
    }
    
    if (-not (Test-Path $parametersPath)) {
        throw "Parameters file not found: $parametersPath"
    }
    
    $validationResult = Test-AzResourceGroupDeployment `
        -ResourceGroupName $ResourceGroupName `
        -TemplateFile $templatePath `
        -TemplateParameterFile $parametersPath
    
    if ($validationResult) {
        Write-Host "⚠ Template validation warnings:" -ForegroundColor Yellow
        $validationResult | ForEach-Object { Write-Host "  - $($_.Message)" -ForegroundColor Yellow }
    } else {
        Write-Host "✓ Template validation passed" -ForegroundColor Green
    }
} catch {
    Write-Error "Template validation failed: $_"
    exit 1
}

# Step 4: Deploy infrastructure
Write-Host "Step 4: Deploying Azure infrastructure..." -ForegroundColor Green
Write-Host "This may take 10-15 minutes..." -ForegroundColor Yellow

try {
    $deploymentName = "insta-agent-infrastructure-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    
    $deployment = New-AzResourceGroupDeployment `
        -Name $deploymentName `
        -ResourceGroupName $ResourceGroupName `
        -TemplateFile $templatePath `
        -TemplateParameterFile $parametersPath `
        -Verbose
    
    if ($deployment.ProvisioningState -eq "Succeeded") {
        Write-Host "✓ Infrastructure deployment completed successfully!" -ForegroundColor Green
    } else {
        throw "Deployment failed with state: $($deployment.ProvisioningState)"
    }
} catch {
    Write-Error "Infrastructure deployment failed: $_"
    exit 1
}

# Step 5: Display deployment outputs
Write-Host "Step 5: Deployment Summary" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Cyan

if ($deployment.Outputs) {
    Write-Host "Resource Endpoints:" -ForegroundColor Yellow
    $outputs = $deployment.Outputs
    
    if ($outputs.appServiceUrl) {
        Write-Host "  Backend API: $($outputs.appServiceUrl.Value)" -ForegroundColor White
    }
    
    if ($outputs.staticWebAppUrl) {
        Write-Host "  Frontend App: $($outputs.staticWebAppUrl.Value)" -ForegroundColor White
    }
    
    if ($outputs.cosmosDbEndpoint) {
        Write-Host "  Cosmos DB: $($outputs.cosmosDbEndpoint.Value)" -ForegroundColor White
    }
    
    if ($outputs.keyVaultUrl) {
        Write-Host "  Key Vault: $($outputs.keyVaultUrl.Value)" -ForegroundColor White
    }
    
    if ($outputs.openAiEndpoint) {
        Write-Host "  Azure OpenAI: $($outputs.openAiEndpoint.Value)" -ForegroundColor White
    }
    
    if ($outputs.searchServiceEndpoint) {
        Write-Host "  Cognitive Search: $($outputs.searchServiceEndpoint.Value)" -ForegroundColor White
    }
    
    if ($outputs.blobStorageEndpoint) {
        Write-Host "  Blob Storage: $($outputs.blobStorageEndpoint.Value)" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Update GitHub Actions secrets with the deployment outputs" -ForegroundColor White
Write-Host "2. Configure Static Web App to connect to your GitHub repository" -ForegroundColor White
Write-Host "3. Run Task 0.3 to set up CI/CD pipeline" -ForegroundColor White
Write-Host ""
Write-Host "Deployment completed successfully! 🎉" -ForegroundColor Green 

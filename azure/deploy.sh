#!/bin/bash

# Azure Infrastructure Deployment Script for Instagram AI Agent SaaS Platform
# This script provisions all required Azure resources for Phase 0

set -e  # Exit on any error

# Default values
ENVIRONMENT="dev"
LOCATION="eastus"
RESOURCE_GROUP_NAME=""
SUBSCRIPTION_ID=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

print_error() {
    echo -e "${RED}$1${NC}"
}

print_info() {
    echo -e "${CYAN}$1${NC}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 -s SUBSCRIPTION_ID [-e ENVIRONMENT] [-l LOCATION] [-r RESOURCE_GROUP_NAME]"
    echo ""
    echo "Options:"
    echo "  -s SUBSCRIPTION_ID     Azure subscription ID (required)"
    echo "  -e ENVIRONMENT         Environment name (default: dev)"
    echo "  -l LOCATION           Azure region (default: eastus)"
    echo "  -r RESOURCE_GROUP     Resource group name (default: rg-insta-agent-ENVIRONMENT)"
    echo "  -h                    Show this help message"
    echo ""
    echo "Example:"
    echo "  $0 -s 12345678-1234-1234-1234-123456789abc -e dev -l eastus"
}

# Parse command line arguments
while getopts "s:e:l:r:h" opt; do
    case $opt in
        s)
            SUBSCRIPTION_ID="$OPTARG"
            ;;
        e)
            ENVIRONMENT="$OPTARG"
            ;;
        l)
            LOCATION="$OPTARG"
            ;;
        r)
            RESOURCE_GROUP_NAME="$OPTARG"
            ;;
        h)
            show_usage
            exit 0
            ;;
        \?)
            print_error "Invalid option: -$OPTARG"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [ -z "$SUBSCRIPTION_ID" ]; then
    print_error "Subscription ID is required"
    show_usage
    exit 1
fi

# Set default resource group name if not provided
if [ -z "$RESOURCE_GROUP_NAME" ]; then
    RESOURCE_GROUP_NAME="rg-insta-agent-$ENVIRONMENT"
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_PATH="$SCRIPT_DIR/bicep/main.bicep"
PARAMETERS_PATH="$SCRIPT_DIR/bicep/parameters.$ENVIRONMENT.json"

print_info "=== Instagram AI Agent SaaS Platform - Azure Infrastructure Deployment ==="
print_warning "Environment: $ENVIRONMENT"
print_warning "Location: $LOCATION"
print_warning "Resource Group: $RESOURCE_GROUP_NAME"
print_warning "Subscription: $SUBSCRIPTION_ID"
echo ""

# Step 1: Check Azure CLI and login
print_status "Step 1: Checking Azure CLI and authentication..."

if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it first:"
    print_error "https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in and set subscription
CURRENT_SUB=$(az account show --query id -o tsv 2>/dev/null || echo "")
if [ "$CURRENT_SUB" != "$SUBSCRIPTION_ID" ]; then
    print_warning "Logging in to Azure..."
    az login
    az account set --subscription "$SUBSCRIPTION_ID"
fi

print_status "✓ Successfully authenticated with Azure"

# Step 2: Create Resource Group
print_status "Step 2: Creating Resource Group..."

if az group show --name "$RESOURCE_GROUP_NAME" &> /dev/null; then
    print_warning "✓ Resource group already exists: $RESOURCE_GROUP_NAME"
else
    az group create --name "$RESOURCE_GROUP_NAME" --location "$LOCATION"
    print_status "✓ Created resource group: $RESOURCE_GROUP_NAME"
fi

# Step 3: Validate template files
print_status "Step 3: Validating template files..."

if [ ! -f "$TEMPLATE_PATH" ]; then
    print_error "Template file not found: $TEMPLATE_PATH"
    exit 1
fi

if [ ! -f "$PARAMETERS_PATH" ]; then
    print_error "Parameters file not found: $PARAMETERS_PATH"
    exit 1
fi

print_status "✓ Template files found"

# Step 4: Validate Bicep template
print_status "Step 4: Validating Bicep template..."

VALIDATION_RESULT=$(az deployment group validate \
    --resource-group "$RESOURCE_GROUP_NAME" \
    --template-file "$TEMPLATE_PATH" \
    --parameters "@$PARAMETERS_PATH" \
    --query "error" -o tsv 2>/dev/null || echo "null")

if [ "$VALIDATION_RESULT" != "null" ] && [ "$VALIDATION_RESULT" != "" ]; then
    print_error "Template validation failed:"
    az deployment group validate \
        --resource-group "$RESOURCE_GROUP_NAME" \
        --template-file "$TEMPLATE_PATH" \
        --parameters "@$PARAMETERS_PATH"
    exit 1
fi

print_status "✓ Template validation passed"

# Step 5: Deploy infrastructure
print_status "Step 5: Deploying Azure infrastructure..."
print_warning "This may take 10-15 minutes..."

DEPLOYMENT_NAME="insta-agent-infrastructure-$(date +%Y%m%d-%H%M%S)"

DEPLOYMENT_OUTPUT=$(az deployment group create \
    --name "$DEPLOYMENT_NAME" \
    --resource-group "$RESOURCE_GROUP_NAME" \
    --template-file "$TEMPLATE_PATH" \
    --parameters "@$PARAMETERS_PATH" \
    --output json)

if [ $? -eq 0 ]; then
    print_status "✓ Infrastructure deployment completed successfully!"
else
    print_error "Infrastructure deployment failed"
    exit 1
fi

# Step 6: Display deployment outputs
print_status "Step 6: Deployment Summary"
print_info "========================="

print_warning "Resource Endpoints:"

# Extract outputs
APP_SERVICE_URL=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.appServiceUrl.value // empty')
STATIC_WEB_APP_URL=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.staticWebAppUrl.value // empty')
COSMOS_DB_ENDPOINT=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.cosmosDbEndpoint.value // empty')
KEY_VAULT_URL=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.keyVaultUrl.value // empty')
OPENAI_ENDPOINT=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.openAiEndpoint.value // empty')
SEARCH_ENDPOINT=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.searchServiceEndpoint.value // empty')
BLOB_ENDPOINT=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.blobStorageEndpoint.value // empty')

[ -n "$APP_SERVICE_URL" ] && echo -e "  Backend API: ${WHITE}$APP_SERVICE_URL${NC}"
[ -n "$STATIC_WEB_APP_URL" ] && echo -e "  Frontend App: ${WHITE}$STATIC_WEB_APP_URL${NC}"
[ -n "$COSMOS_DB_ENDPOINT" ] && echo -e "  Cosmos DB: ${WHITE}$COSMOS_DB_ENDPOINT${NC}"
[ -n "$KEY_VAULT_URL" ] && echo -e "  Key Vault: ${WHITE}$KEY_VAULT_URL${NC}"
[ -n "$OPENAI_ENDPOINT" ] && echo -e "  Azure OpenAI: ${WHITE}$OPENAI_ENDPOINT${NC}"
[ -n "$SEARCH_ENDPOINT" ] && echo -e "  Cognitive Search: ${WHITE}$SEARCH_ENDPOINT${NC}"
[ -n "$BLOB_ENDPOINT" ] && echo -e "  Blob Storage: ${WHITE}$BLOB_ENDPOINT${NC}"

echo ""
print_warning "Next Steps:"
echo -e "1. Update GitHub Actions secrets with the deployment outputs"
echo -e "2. Configure Static Web App to connect to your GitHub repository"
echo -e "3. Run Task 0.3 to set up CI/CD pipeline"
echo ""
print_status "Deployment completed successfully! 🎉"

# Save outputs to file for later use
OUTPUT_FILE="$SCRIPT_DIR/deployment-outputs-$ENVIRONMENT.json"
echo "$DEPLOYMENT_OUTPUT" | jq '.properties.outputs' > "$OUTPUT_FILE"
print_info "Deployment outputs saved to: $OUTPUT_FILE" 
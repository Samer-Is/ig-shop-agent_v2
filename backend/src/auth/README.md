# Auth Module

This module handles Instagram OAuth 2.0 onboarding and merchant authentication for the Instagram AI Agent SaaS Platform backend.

## Instagram Onboarding Flow

- **POST /api/onboard**
  - Receives the OAuth 2.0 code from the frontend
  - Exchanges code for a long-lived user access token and page details
  - Checks if the Instagram page ID is in the whitelist
  - If whitelisted, creates a new merchant document in Cosmos DB
  - Stores the encrypted access token in Azure Key Vault and references the secret URI in the merchant document
  - Returns success and merchantId if onboarding is successful

## Services

- **InstagramService**: Handles OAuth code exchange, page info retrieval, and secure token storage
- **CosmosService**: Provides access to Cosmos DB containers for merchants and whitelist 

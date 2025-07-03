# Database Module

This module contains the Cosmos DB schemas and service for the Instagram AI Agent SaaS Platform backend.

## Schemas

- **Merchant** (`merchants` container):
  - Merchant info, configuration, Instagram tokens, subscription tier, and pageId
  - Product catalog, business info, and AI settings
- **WhitelistEntry** (`whitelist` container):
  - Stores the `instagram_page_id` of approved merchants

## CosmosService

- Handles Cosmos DB connection and provides access to the `merchants` and `whitelist` containers
- Uses configuration from environment variables or `configService`
- Registered as a provider in the main app module 

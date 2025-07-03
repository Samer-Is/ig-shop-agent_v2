# Merchant Module

This module provides secure CRUD API endpoints for merchants to manage their product catalog, business info, and AI settings.

## Endpoints

- **GET /api/merchant/me**: Get all merchant data (requires authentication)
- **PUT /api/merchant/product-catalog**: Update product catalog (array of products)
- **PUT /api/merchant/business-info**: Update business info (working hours, terms, rules)
- **PUT /api/merchant/ai-settings**: Update AI settings (custom prompt)

All endpoints require authentication and only allow the merchant to access or update their own data.

## Service

- **MerchantService**: Handles CRUD operations for merchant data in Cosmos DB 

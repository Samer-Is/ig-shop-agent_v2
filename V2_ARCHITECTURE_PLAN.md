# Instagram AI Agent V2: Ultra Low-Cost Architecture

## 🎯 Project Vision

Create an **ultra low-cost Instagram DM automation platform** with **95% cost reduction** while maintaining core functionality.

## 💰 Cost Optimization Goals

| Component | Enterprise (V1) | Ultra Low-Cost (V2) | Savings |
|-----------|-----------------|-------------------|---------|
| **Database** | Azure Cosmos DB ($150/month) | PostgreSQL Container ($15/month) | 90% |
| **Search** | Azure Cognitive Search ($250/month) | pgvector (FREE) | 100% |
| **Compute** | Azure App Service ($150/month) | Azure Functions ($5/month) | 97% |
| **AI Services** | Multiple Azure AI ($200/month) | OpenAI Direct ($15/month) | 92% |
| **Storage** | Premium Storage ($50/month) | Basic Storage ($5/month) | 90% |
| **TOTAL** | **$800/month** | **$40/month** | **95%** |

## 🏗️ V2 Architecture

### Technology Stack
```
Frontend: React + TypeScript + Vite
Backend: FastAPI + Python 3.11
Database: PostgreSQL 15 + pgvector
Compute: Azure Functions (Consumption Plan)
AI: OpenAI GPT-4o (Direct API)
Storage: Azure Blob Storage (Hot tier)
Search: pgvector (Embedded in PostgreSQL)
Hosting: Azure Static Web Apps
```

### Repository Structure
```
ig-shop-agent-v2/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/               # API routes
│   │   ├── core/              # Core configuration
│   │   ├── crud/              # Database operations
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   └── services/          # Business logic
│   ├── alembic/               # Database migrations
│   ├── tests/                 # Python tests
│   ├── requirements.txt       # Python dependencies
│   ├── function_app.py        # Azure Functions entry
│   └── main.py               # FastAPI application
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/            # Page components
│   │   ├── services/         # API services
│   │   ├── stores/           # State management
│   │   └── types/            # TypeScript types
│   ├── public/               # Static assets
│   └── package.json          # Frontend dependencies
├── infra/                    # Infrastructure as Code
│   ├── bicep/                # Azure Bicep templates
│   ├── terraform/            # Terraform (alternative)
│   └── docker/               # Docker configurations
├── scripts/                  # Deployment scripts
│   ├── deploy-minimal.sh     # One-command deployment
│   ├── setup-db.py          # Database initialization
│   └── test-e2e.py          # End-to-end testing
└── docs/                     # Documentation
    ├── API.md               # API documentation
    ├── DEPLOYMENT.md        # Deployment guide
    └── COST_ANALYSIS.md     # Cost breakdown
```

## 🔧 Key Implementation Changes

### 1. Database Architecture
```python
# PostgreSQL with pgvector instead of Cosmos DB
class BusinessProfile(Base):
    __tablename__ = "business_profiles"
    
    id = Column(UUID, primary_key=True, default=uuid4)
    instagram_page_id = Column(String, unique=True, index=True)
    business_name = Column(String, nullable=False)
    product_catalog = Column(JSON)  # Store as JSON
    embedding = Column(Vector(1536))  # pgvector for search
    created_at = Column(DateTime, default=datetime.utcnow)
```

### 2. Vector Search with pgvector
```python
# Replace Azure Cognitive Search with pgvector
async def search_products(query: str, business_id: str):
    query_embedding = await get_embedding(query)
    
    result = await db.execute(
        text("""
        SELECT *, embedding <-> :query_embedding as distance
        FROM products 
        WHERE business_id = :business_id
        ORDER BY distance LIMIT 5
        """),
        {
            "query_embedding": query_embedding,
            "business_id": business_id
        }
    )
    return result.fetchall()
```

### 3. Azure Functions Serverless Backend
```python
# function_app.py - Azure Functions entry point
import azure.functions as func
from app.main import app

def main(req: func.HttpRequest) -> func.HttpResponse:
    # Route FastAPI through Azure Functions
    return func.AsgiMiddleware(app).handle(req)
```

### 4. Ultra Low-Cost Infrastructure
```bicep
// Azure Functions Consumption Plan (Pay per execution)
resource functionApp 'Microsoft.Web/sites@2022-03-01' = {
  name: 'igshop-${environment}-functions'
  location: location
  kind: 'functionapp,linux'
  properties: {
    serverFarmId: consumptionPlan.id
    siteConfig: {
      linuxFxVersion: 'Python|3.11'
      appSettings: [
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'python'
        }
      ]
    }
  }
}

// PostgreSQL Container Instance
resource postgresql 'Microsoft.ContainerInstance/containerGroups@2021-09-01' = {
  name: 'igshop-${environment}-postgres'
  location: location
  properties: {
    containers: [
      {
        name: 'postgres'
        properties: {
          image: 'postgres:15-alpine'
          resources: {
            requests: {
              cpu: 1
              memoryInGB: 2
            }
          }
          environmentVariables: [
            {
              name: 'POSTGRES_DB'
              value: 'igshop'
            }
            {
              name: 'POSTGRES_USER'
              value: 'igshop_user'
            }
            {
              name: 'POSTGRES_PASSWORD'
              secureValue: postgresPassword
            }
          ]
          ports: [
            {
              port: 5432
              protocol: 'TCP'
            }
          ]
          volumeMounts: [
            {
              name: 'postgres-data'
              mountPath: '/var/lib/postgresql/data'
            }
          ]
        }
      }
    ]
    volumes: [
      {
        name: 'postgres-data'
        azureFile: {
          shareName: 'postgres-data'
          storageAccountName: storageAccount.name
          storageAccountKey: storageAccount.listKeys().keys[0].value
        }
      }
    ]
    osType: 'Linux'
    ipAddress: {
      type: 'Private'
      ports: [
        {
          port: 5432
          protocol: 'TCP'
        }
      ]
    }
  }
}
```

## 🚀 Deployment Strategy

### One-Command Deployment
```bash
#!/bin/bash
# deploy-minimal.sh - Ultra low-cost deployment

set -e

ENVIRONMENT=${1:-dev}
RESOURCE_GROUP="igshop-${ENVIRONMENT}-rg"
LOCATION="eastus"

echo "🚀 Deploying IG-Shop-Agent V2 (Ultra Low-Cost)"
echo "Environment: $ENVIRONMENT"
echo "Estimated monthly cost: $35-40"

# 1. Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# 2. Deploy infrastructure
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file infra/bicep/main.bicep \
  --parameters environment=$ENVIRONMENT

# 3. Setup database
python scripts/setup-db.py --environment $ENVIRONMENT

# 4. Deploy backend (Azure Functions)
cd backend
func azure functionapp publish "igshop-${ENVIRONMENT}-functions"

# 5. Deploy frontend (Static Web Apps)
cd ../frontend
npm run build
az staticwebapp deploy \
  --name "igshop-${ENVIRONMENT}-app" \
  --source-location "./dist"

echo "✅ Deployment complete!"
echo "Frontend: https://igshop-${ENVIRONMENT}-app.azurestaticapps.net"
echo "Backend: https://igshop-${ENVIRONMENT}-functions.azurewebsites.net"
```

## 📊 Feature Comparison

| Feature | Enterprise (V1) | Ultra Low-Cost (V2) | Status |
|---------|-----------------|-------------------|--------|
| **Instagram Integration** | ✅ Full OAuth | ✅ Full OAuth | Same |
| **AI Conversations** | ✅ GPT-4o + Azure AI | ✅ GPT-4o Direct | Same |
| **Order Management** | ✅ Full Pipeline | ✅ Simplified | Reduced |
| **Multi-tenant** | ✅ Enterprise Grade | ✅ Basic Support | Reduced |
| **Analytics** | ✅ Comprehensive | ✅ Basic Metrics | Reduced |
| **Vector Search** | ✅ Azure Cognitive Search | ✅ pgvector | Same Capability |
| **File Processing** | ✅ Azure Form Recognizer | ✅ Basic PDF/Text | Reduced |
| **Scalability** | ✅ Auto-scaling | ✅ Function-based | Different |
| **Security** | ✅ Enterprise Grade | ✅ Basic JWT | Reduced |

## 🎯 Target Market Differentiation

### Enterprise (V1) - Current Implementation
- **Market**: Large enterprises ($10M+ revenue)
- **Price Point**: $500-2000/month
- **Features**: Full enterprise features, advanced analytics, compliance
- **Support**: White-glove onboarding, 24/7 support

### Ultra Low-Cost (V2) - Proposed Implementation
- **Market**: SMBs and startups (<$10M revenue)
- **Price Point**: $29-99/month
- **Features**: Core automation, basic analytics, self-service
- **Support**: Documentation, community, email support

## 🔄 Migration Strategy

### Phase 1: Repository Creation (Week 1)
- Create new repository: `ig-shop-agent-v2`
- Implement core FastAPI backend
- Setup PostgreSQL with pgvector
- Basic React frontend

### Phase 2: Feature Implementation (Week 2-3)
- Instagram integration
- AI conversation engine
- Basic order management
- Simple analytics

### Phase 3: Testing & Optimization (Week 4)
- Cost optimization testing
- Performance benchmarking
- Security audit
- Documentation

### Phase 4: Launch (Week 5)
- Deploy to production
- Marketing for SMB segment
- Monitor costs and performance
- Iterate based on feedback

## 💡 Business Value

### For SMBs/Startups
- **Accessible pricing**: $40/month vs $800/month
- **Quick setup**: One-command deployment
- **Essential features**: Focus on core Instagram automation
- **Scalable**: Pay only for what you use

### For Platform Owner
- **Larger market**: Target 10x more businesses
- **Higher volume**: More customers at lower price point
- **Operational efficiency**: Serverless reduces management overhead
- **Market validation**: Test features before adding to enterprise version

## 🚀 Next Steps

1. **Create V2 Repository**: Initialize new repository with FastAPI structure
2. **Implement Core Features**: Focus on essential Instagram automation
3. **Cost Validation**: Deploy and measure actual costs
4. **Market Testing**: Launch with early adopters
5. **Feature Iteration**: Add features based on user feedback

---

**Target: Launch V2 within 4 weeks with $35/month operating cost** 

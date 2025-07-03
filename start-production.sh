#!/bin/bash

# IG-Shop-Agent V2 - Production Startup Script

echo "🚀 Starting IG-Shop-Agent V2 in Production Mode..."

# Set production environment
export ENVIRONMENT=production
export PYTHONPATH=/app
export PORT=${PORT:-8000}

# Check if running in cloud or local
if [ -n "$RAILWAY_ENVIRONMENT" ] || [ -n "$RENDER" ] || [ -n "$AZURE_FUNCTIONS_ENVIRONMENT" ]; then
    echo "☁️ Cloud environment detected"
    CLOUD_MODE=true
else
    echo "🏠 Local production mode"
    CLOUD_MODE=false
fi

# Database initialization
echo "🗄️ Initializing database..."
cd /app/backend || cd backend

# Run database migrations if needed
if [ "$CLOUD_MODE" = true ]; then
    echo "📊 Setting up production database..."
    python -c "
from app.core.database import engine, Base
from app.core.config import create_demo_data
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    # Create all tables
    Base.metadata.create_all(bind=engine)
    logger.info('✅ Database tables created')
    
    # Create demo data if needed
    create_demo_data()
    logger.info('✅ Demo data initialized')
    
except Exception as e:
    logger.error(f'❌ Database initialization failed: {e}')
    exit(1)
"
fi

# Health check
echo "🏥 Running health check..."
python -c "
import sys
from app.core.config import settings

print(f'🔧 Environment: {settings.environment}')
print(f'🗄️ Database: {\"PostgreSQL\" if settings.is_postgresql else \"SQLite\"}')
print(f'🤖 AI Configured: {bool(settings.openai_api_key)}')
print(f'📱 Meta Configured: {bool(settings.meta_app_id)}')

if not settings.openai_api_key:
    print('❌ OpenAI API key not configured')
    sys.exit(1)

if not settings.meta_app_id:
    print('❌ Meta App ID not configured')
    sys.exit(1)

print('✅ All configurations valid')
"

# Start the application
echo "🌟 Starting FastAPI application..."

if [ "$CLOUD_MODE" = true ]; then
    # Cloud deployment - use gunicorn for better performance
    exec gunicorn main:app \
        --bind 0.0.0.0:$PORT \
        --workers 2 \
        --worker-class uvicorn.workers.UvicornWorker \
        --access-logfile - \
        --error-logfile - \
        --log-level info
else
    # Local production - use uvicorn
    exec uvicorn main:app \
        --host 0.0.0.0 \
        --port $PORT \
        --workers 1 \
        --log-level info
fi 
"""
Health check API endpoints for IG-Shop-Agent V2
Simple health monitoring for the ultra low-cost platform
"""
from fastapi import APIRouter
from datetime import datetime
import sys
import os

from ..core.config import settings

health_router = APIRouter()

@health_router.get("/")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.utcnow().isoformat(),
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "cost_optimization": "95% savings vs enterprise",
        "target_market": "SMBs and startups"
    }

@health_router.get("/detailed")
async def detailed_health_check():
    """Detailed health check with system information"""
    return {
        "status": "healthy",
        "app_info": {
            "name": settings.APP_NAME,
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT
        },
        "system_info": {
            "python_version": sys.version,
            "platform": sys.platform,
            "timestamp": datetime.utcnow().isoformat()
        },
        "features": {
            "ai_model": settings.OPENAI_MODEL,
            "database": "SQLite (development)" if settings.ENVIRONMENT == "development" else "PostgreSQL",
            "instagram_integration": True,
            "webhook_support": True,
            "multi_language": True
        },
        "cost_info": {
            "monthly_target": "$35-40",
            "savings_vs_enterprise": "95%",
            "architecture": "Ultra low-cost"
        }
    }

@health_router.get("/database")
async def database_health():
    """Database connectivity check"""
    try:
        # Simple database connectivity test
        from ..core.database import SessionLocal
        
        db = SessionLocal()
        try:
            # Try a simple query
            db.execute("SELECT 1")
            db.close()
            
            return {
                "status": "healthy",
                "database": "connected",
                "type": "SQLite (development)" if settings.ENVIRONMENT == "development" else "PostgreSQL",
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            db.close()
            return {
                "status": "unhealthy",
                "database": "connection_failed",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "initialization_failed",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@health_router.get("/config")
async def config_health():
    """Configuration validation check"""
    config_status = {
        "openai_configured": bool(settings.OPENAI_API_KEY),
        "meta_app_configured": bool(settings.META_APP_ID and settings.META_APP_SECRET),
        "webhook_token_configured": bool(settings.META_WEBHOOK_VERIFY_TOKEN),
        "environment": settings.ENVIRONMENT
    }
    
    all_configured = all([
        config_status["openai_configured"],
        config_status["meta_app_configured"],
        config_status["webhook_token_configured"]
    ])
    
    return {
        "status": "healthy" if all_configured else "warning",
        "message": "All critical configuration present" if all_configured else "Some configuration missing",
        "config": config_status,
        "timestamp": datetime.utcnow().isoformat()
    } 
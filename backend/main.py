"""
IG-Shop-Agent V2: Ultra Low-Cost Instagram DM Automation Platform
FastAPI Backend Application
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import API routes
from app.api.auth import auth_router
from app.api.merchants import merchants_router
from app.api.webhooks import webhook_router
from app.api.health import health_router

# Import database
from app.core.database import engine, create_tables
from app.core.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    create_tables()
    print("🚀 Database tables created successfully")
    print(f"🌐 FastAPI server starting on {settings.HOST}:{settings.PORT}")
    yield
    # Shutdown
    print("📴 FastAPI server shutting down")

# Create FastAPI application
app = FastAPI(
    title="IG-Shop-Agent V2 API",
    description="Ultra Low-Cost Instagram DM Automation Platform",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)

# CORS Configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Trusted host middleware for security
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors"""
    print(f"❌ Unhandled error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "Something went wrong. Please try again later.",
            "request_id": getattr(request.state, "request_id", "unknown")
        }
    )

# Include API routers
app.include_router(health_router, prefix="/api/health", tags=["Health"])
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(merchants_router, prefix="/api/merchants", tags=["Merchants"])
app.include_router(webhook_router, prefix="/api/webhooks", tags=["Webhooks"])

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "🤖 IG-Shop-Agent V2 API",
        "version": "2.0.0",
        "description": "Ultra Low-Cost Instagram DM Automation Platform",
        "status": "running",
        "cost_savings": "95% vs Enterprise",
        "docs": "/docs"
    }

@app.get("/api")
async def api_info():
    """API information endpoint"""
    return {
        "api_version": "2.0.0",
        "environment": settings.ENVIRONMENT,
        "database": "PostgreSQL + pgvector",
        "ai_provider": "OpenAI GPT-4o",
        "deployment": "Azure Functions",
        "estimated_cost": "$35-40/month"
    }

# Run the application
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development",
        log_level="info"
    ) 
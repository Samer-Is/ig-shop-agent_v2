"""
Configuration management for IG-Shop-Agent V2
Ultra Low-Cost Instagram DM Automation Platform
"""
import os
from typing import List, Dict, Any, ClassVar
from pydantic_settings import BaseSettings
from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

class Settings(BaseSettings):
    """Application settings"""
    
    # Application Configuration
    APP_NAME: str = "IG-Shop-Agent V2"
    VERSION: str = "2.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "ultra-low-cost-instagram-ai-agent-v2")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://igshop-dev-app.azurestaticapps.net",
        "https://igshop-prod-app.azurestaticapps.net"
    ]
    
    ALLOWED_HOSTS: List[str] = [
        "localhost",
        "127.0.0.1",
        "*.azurewebsites.net",
        "*.azurestaticapps.net"
    ]
    
    # Database Configuration (PostgreSQL + pgvector)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://igshop:password@localhost:5432/igshop_v2"
    )
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 10
    
    # OpenAI Configuration (Direct API - Cost Optimized)
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_MAX_TOKENS: int = 1500
    OPENAI_TEMPERATURE: float = 0.7
    
    # Meta/Instagram Configuration
    META_APP_ID: str = os.getenv("META_APP_ID", "")
    META_APP_SECRET: str = os.getenv("META_APP_SECRET", "")
    META_WEBHOOK_VERIFY_TOKEN: str = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "igshop_v2_webhook")
    
    # Azure Configuration (Minimal)
    AZURE_STORAGE_CONNECTION_STRING: str = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
    AZURE_STORAGE_CONTAINER: str = "igshop-documents"
    
    # Rate Limiting (Cost Control)
    RATE_LIMIT_REQUESTS: int = 100  # requests per minute
    RATE_LIMIT_WINDOW: int = 60     # window in seconds
    
    # AI Response Configuration
    MAX_CONVERSATION_HISTORY: int = 10  # Keep last 10 messages for context
    DEFAULT_AI_RESPONSE: str = "I'm sorry, I'm currently unavailable. Please try again later."
    
    # Subscription Tiers (Cost-based) - ClassVar to avoid pydantic field annotation
    TIER_LIMITS: ClassVar[Dict[str, Dict[str, Any]]] = {
        "starter": {"messages": 1000, "price": 29},
        "growth": {"messages": 5000, "price": 59},
        "business": {"messages": 15000, "price": 99}
    }
    
    # Feature Flags
    ENABLE_VOICE_TRANSCRIPTION: bool = False  # Disabled for cost savings
    ENABLE_ADVANCED_ANALYTICS: bool = False   # Basic analytics only
    ENABLE_FILE_UPLOAD: bool = True           # Basic file upload
    
    @property
    def is_production(self) -> bool:
        """Check if running in production environment"""
        return self.environment.lower() == "production"
    
    @property
    def is_postgresql(self) -> bool:
        """Check if using PostgreSQL database"""
        return self.database_url.startswith("postgresql://")
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Create settings instance
settings = Settings()

# Database Configuration
if settings.is_postgresql:
    # PostgreSQL for production
    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_recycle=300,
        echo=not settings.is_production
    )
else:
    # SQLite for development
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False},
        echo=settings.debug
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Database dependency for FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_demo_data():
    """Create demo data - works for both SQLite and PostgreSQL"""
    from sqlalchemy import text
    
    db = SessionLocal()
    try:
        # Check if demo data already exists
        result = db.execute(text("SELECT COUNT(*) FROM merchants")).scalar()
        if result > 0:
            print("✅ Demo data already exists")
            return
        
        # Create demo merchant
        merchant_id = "demo_merchant_v2_2024"
        
        demo_merchant_sql = """
        INSERT INTO merchants (
            id, business_name, subscription_tier, languages, ai_personality,
            working_hours, monthly_message_count, created_at, updated_at
        ) VALUES (
            :id, :business_name, :tier, :languages, :personality,
            :hours, :count, :created, :updated
        )
        """
        
        db.execute(text(demo_merchant_sql), {
            "id": merchant_id,
            "business_name": "Demo Business V2 - Cloud Ready",
            "tier": "starter",
            "languages": "Arabic,English",
            "personality": "friendly",
            "hours": "9:00-17:00",
            "count": 0,
            "created": datetime.utcnow().isoformat(),
            "updated": datetime.utcnow().isoformat()
        })
        
        # Create demo products
        products = [
            {"name": "Premium Product", "price": 50.0, "description": "High quality premium item"},
            {"name": "Quality Product", "price": 30.0, "description": "Good quality standard item"},
            {"name": "Basic Product", "price": 20.0, "description": "Affordable basic item"}
        ]
        
        for i, product in enumerate(products):
            product_sql = """
            INSERT INTO products (
                id, merchant_id, name, price, description, created_at
            ) VALUES (
                :id, :merchant_id, :name, :price, :description, :created
            )
            """
            
            db.execute(text(product_sql), {
                "id": f"prod_{i+1}",
                "merchant_id": merchant_id,
                "name": product["name"],
                "price": product["price"],
                "description": product["description"],
                "created": datetime.utcnow().isoformat()
            })
        
        db.commit()
        print("✅ Demo data created successfully")
        
    except Exception as e:
        print(f"⚠️ Error creating demo data: {e}")
        db.rollback()
    finally:
        db.close()

# Validation
def validate_settings():
    """Validate critical settings"""
    required_settings = [
        ("OPENAI_API_KEY", settings.OPENAI_API_KEY),
        ("META_APP_ID", settings.META_APP_ID),
        ("META_APP_SECRET", settings.META_APP_SECRET),
        ("DATABASE_URL", settings.DATABASE_URL)
    ]
    
    missing = [name for name, value in required_settings if not value]
    
    if missing:
        raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
    
    print("✅ Configuration validation passed")
    return True

# Auto-validate on import
if settings.ENVIRONMENT != "test":
    try:
        validate_settings()
    except ValueError as e:
        print(f"⚠️ Configuration warning: {e}")
        print("🔧 Please check your .env file or environment variables")

# Print configuration info
print(f"🔧 Environment: {settings.environment}")
print(f"🗄️ Database: {'PostgreSQL' if settings.is_postgresql else 'SQLite'}")
print(f"🚀 Production: {settings.is_production}")
print(f"🤖 AI Model: {settings.openai_model}") 
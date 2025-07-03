"""
Database configuration for IG-Shop-Agent V2
Simplified SQLite setup for demo and development
"""
import os
from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from .config import settings

# Use SQLite for demo/development to avoid PostgreSQL setup complexity
if settings.ENVIRONMENT == "development":
    DATABASE_URL = "sqlite:///./igshop_v2_demo.db"
else:
    DATABASE_URL = settings.DATABASE_URL

# Create SQLAlchemy engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=settings.ENVIRONMENT == "development"
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class for models
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    """Create database tables"""
    try:
        # Import models to register them
        from ..models.merchant import Merchant
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully")
        print(f"📊 Database: {DATABASE_URL}")
        
        # Create a demo merchant if none exists (for testing)
        db = SessionLocal()
        try:
            existing_merchant = db.query(Merchant).first()
            if not existing_merchant:
                demo_merchant = Merchant(
                    instagram_page_id="demo_page_123",
                    page_name="demo_business",
                    access_token_hash="demo_hash",
                    business_name="Demo Business V2",
                    business_description="A sample business for testing V2 features",
                    business_category="E-commerce",
                    subscription_tier="starter",
                    monthly_message_limit=1000,
                    product_catalog=[
                        {
                            "name": "Premium Product A",
                            "description": "High-quality premium product with excellent features",
                            "price": "$50",
                            "availability": "In stock",
                            "category": "Premium"
                        },
                        {
                            "name": "Quality Product B", 
                            "description": "Mid-range product with good value for money",
                            "price": "$30",
                            "availability": "In stock",
                            "category": "Standard"
                        },
                        {
                            "name": "Basic Product C",
                            "description": "Entry-level product perfect for beginners",
                            "price": "$20", 
                            "availability": "In stock",
                            "category": "Basic"
                        }
                    ],
                    working_hours={
                        "monday": "9:00 AM - 6:00 PM",
                        "tuesday": "9:00 AM - 6:00 PM", 
                        "wednesday": "9:00 AM - 6:00 PM",
                        "thursday": "9:00 AM - 6:00 PM",
                        "friday": "9:00 AM - 6:00 PM",
                        "saturday": "10:00 AM - 4:00 PM",
                        "sunday": "Closed"
                    },
                    ai_personality="friendly",
                    default_language="Arabic",
                    fallback_language="English"
                )
                db.add(demo_merchant)
                db.commit()
                print("✅ Demo merchant created for testing")
        finally:
            db.close()
            
    except Exception as e:
        print(f"❌ Database setup error: {e}")
        raise

async def create_tables_async():
    """Async version for FastAPI startup"""
    create_tables()

def create_tables_sync():
    """Synchronous table creation"""
    create_tables() 
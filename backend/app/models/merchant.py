"""
Merchant Model for IG-Shop-Agent V2
SQLAlchemy model for merchant data with SQLite compatibility
"""
from sqlalchemy import Column, String, Integer, Float, Boolean, JSON, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timezone
import uuid

from ..core.database import Base

class Merchant(Base):
    """Merchant model for storing Instagram business information"""
    
    __tablename__ = "merchants"
    
    # Primary key - Using String for SQLite compatibility
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Instagram Integration
    instagram_page_id = Column(String, unique=True, nullable=False, index=True)
    page_name = Column(String, nullable=False)
    access_token_hash = Column(String, nullable=False)  # Hashed Instagram token
    
    # Business Information
    business_name = Column(String, nullable=False)
    business_description = Column(Text, nullable=True)
    business_category = Column(String, nullable=True)
    
    # Subscription & Usage
    subscription_tier = Column(String, default="starter")  # starter, growth, business
    monthly_message_count = Column(Integer, default=0)
    monthly_message_limit = Column(Integer, default=1000)
    
    # Business Configuration
    product_catalog = Column(JSON, nullable=True)  # List of products
    working_hours = Column(JSON, nullable=True)    # Business hours
    contact_info = Column(JSON, nullable=True)     # Contact information
    
    # AI Configuration
    ai_personality = Column(String, default="friendly")  # friendly, professional, casual
    default_language = Column(String, default="Arabic")
    fallback_language = Column(String, default="English")
    custom_instructions = Column(Text, nullable=True)
    
    # Status & Timestamps
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_active_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    def can_send_message(self) -> bool:
        """Check if merchant can send messages (within limits)"""
        if not self.is_active:
            return False
        return self.monthly_message_count < self.monthly_message_limit
    
    def get_usage_percentage(self) -> float:
        """Get usage percentage for current billing period"""
        if self.monthly_message_limit == 0:
            return 100.0
        return (self.monthly_message_count / self.monthly_message_limit) * 100
    
    def to_dict(self) -> dict:
        """Convert merchant to dictionary for API responses"""
        return {
            "id": self.id,
            "instagram_page_id": self.instagram_page_id,
            "page_name": self.page_name,
            "business_name": self.business_name,
            "business_description": self.business_description,
            "business_category": self.business_category,
            "subscription_tier": self.subscription_tier,
            "monthly_message_count": self.monthly_message_count,
            "monthly_message_limit": self.monthly_message_limit,
            "usage_percentage": self.get_usage_percentage(),
            "can_send_messages": self.can_send_message(),
            "product_catalog": self.product_catalog or [],
            "working_hours": self.working_hours,
            "contact_info": self.contact_info,
            "ai_personality": self.ai_personality,
            "default_language": self.default_language,
            "fallback_language": self.fallback_language,
            "custom_instructions": self.custom_instructions,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_active_at": self.last_active_at.isoformat() if self.last_active_at else None
        }
    
    def __repr__(self):
        return f"<Merchant(id={self.id}, business_name='{self.business_name}', page_name='{self.page_name}')>" 
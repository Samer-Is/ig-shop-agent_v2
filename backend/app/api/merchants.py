"""
Merchant Management API for IG-Shop-Agent V2
CRUD operations for merchant settings, products, and business info
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from jose import JWTError, jwt

from ..core.database import get_db
from ..core.config import settings
from ..models.merchant import Merchant
from ..services.ai_service import AIService

merchants_router = APIRouter()
security = HTTPBearer()

# Pydantic Models
class ProductItem(BaseModel):
    name: str
    description: str
    price: str
    availability: str = "In stock"
    category: Optional[str] = None
    image_url: Optional[str] = None

class BusinessInfo(BaseModel):
    business_name: Optional[str] = None
    business_description: Optional[str] = None
    business_category: Optional[str] = None
    working_hours: Optional[Dict[str, str]] = None
    contact_info: Optional[Dict[str, str]] = None

class AISettings(BaseModel):
    ai_personality: Optional[str] = "friendly"
    default_language: Optional[str] = "Arabic"
    fallback_language: Optional[str] = "English"
    custom_instructions: Optional[str] = None

class MerchantUpdate(BaseModel):
    business_info: Optional[BusinessInfo] = None
    ai_settings: Optional[AISettings] = None

class TestMessageRequest(BaseModel):
    message: str

def get_current_merchant(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Merchant:
    """Get current authenticated merchant"""
    try:
        payload = jwt.decode(
            credentials.credentials, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        merchant_id: str = payload.get("sub")
        if merchant_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if merchant is None:
        raise HTTPException(status_code=404, detail="Merchant not found")
    
    return merchant

@merchants_router.get("/profile")
async def get_merchant_profile(
    merchant: Merchant = Depends(get_current_merchant)
):
    """Get merchant profile and settings"""
    return {
        "merchant_id": merchant.id,
        "business_name": merchant.business_name,
        "page_name": merchant.page_name,
        "instagram_page_id": merchant.instagram_page_id,
        "business_description": merchant.business_description,
        "business_category": merchant.business_category,
        "subscription_tier": merchant.subscription_tier,
        "monthly_message_count": merchant.monthly_message_count,
        "monthly_message_limit": merchant.monthly_message_limit,
        "working_hours": merchant.working_hours,
        "contact_info": merchant.contact_info,
        "ai_personality": merchant.ai_personality,
        "default_language": merchant.default_language,
        "fallback_language": merchant.fallback_language,
        "custom_instructions": merchant.custom_instructions,
        "created_at": merchant.created_at,
        "last_active_at": merchant.last_active_at,
        "is_active": merchant.is_active
    }

@merchants_router.put("/profile")
async def update_merchant_profile(
    update_data: MerchantUpdate,
    merchant: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db)
):
    """Update merchant profile and settings"""
    try:
        # Update business info
        if update_data.business_info:
            if update_data.business_info.business_name:
                merchant.business_name = update_data.business_info.business_name
            if update_data.business_info.business_description:
                merchant.business_description = update_data.business_info.business_description
            if update_data.business_info.business_category:
                merchant.business_category = update_data.business_info.business_category
            if update_data.business_info.working_hours:
                merchant.working_hours = update_data.business_info.working_hours
            if update_data.business_info.contact_info:
                merchant.contact_info = update_data.business_info.contact_info
        
        # Update AI settings
        if update_data.ai_settings:
            if update_data.ai_settings.ai_personality:
                merchant.ai_personality = update_data.ai_settings.ai_personality
            if update_data.ai_settings.default_language:
                merchant.default_language = update_data.ai_settings.default_language
            if update_data.ai_settings.fallback_language:
                merchant.fallback_language = update_data.ai_settings.fallback_language
            if update_data.ai_settings.custom_instructions:
                merchant.custom_instructions = update_data.ai_settings.custom_instructions
        
        db.commit()
        db.refresh(merchant)
        
        return {
            "status": "success",
            "message": "Profile updated successfully",
            "merchant_id": merchant.id
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Update failed: {str(e)}")

@merchants_router.get("/products")
async def get_products(
    merchant: Merchant = Depends(get_current_merchant)
):
    """Get merchant's product catalog"""
    return {
        "products": merchant.product_catalog or [],
        "total_products": len(merchant.product_catalog or []),
        "business_name": merchant.business_name
    }

@merchants_router.post("/products")
async def add_product(
    product: ProductItem,
    merchant: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db)
):
    """Add product to catalog"""
    try:
        # Initialize product catalog if None
        if merchant.product_catalog is None:
            merchant.product_catalog = []
        
        # Add new product
        new_product = product.dict()
        merchant.product_catalog.append(new_product)
        
        # Mark the column as modified for SQLAlchemy
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(merchant, "product_catalog")
        
        db.commit()
        db.refresh(merchant)
        
        return {
            "status": "success",
            "message": "Product added successfully",
            "product": new_product,
            "total_products": len(merchant.product_catalog)
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to add product: {str(e)}")

@merchants_router.put("/products/{product_index}")
async def update_product(
    product_index: int,
    product: ProductItem,
    merchant: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db)
):
    """Update product in catalog"""
    try:
        if not merchant.product_catalog or product_index >= len(merchant.product_catalog):
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Update product
        merchant.product_catalog[product_index] = product.dict()
        
        # Mark the column as modified for SQLAlchemy
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(merchant, "product_catalog")
        
        db.commit()
        db.refresh(merchant)
        
        return {
            "status": "success",
            "message": "Product updated successfully",
            "product": merchant.product_catalog[product_index]
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to update product: {str(e)}")

@merchants_router.delete("/products/{product_index}")
async def delete_product(
    product_index: int,
    merchant: Merchant = Depends(get_current_merchant),
    db: Session = Depends(get_db)
):
    """Delete product from catalog"""
    try:
        if not merchant.product_catalog or product_index >= len(merchant.product_catalog):
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Remove product
        removed_product = merchant.product_catalog.pop(product_index)
        
        # Mark the column as modified for SQLAlchemy
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(merchant, "product_catalog")
        
        db.commit()
        db.refresh(merchant)
        
        return {
            "status": "success",
            "message": "Product deleted successfully",
            "removed_product": removed_product,
            "remaining_products": len(merchant.product_catalog)
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to delete product: {str(e)}")

@merchants_router.post("/test-ai")
async def test_ai_response(
    test_request: TestMessageRequest,
    merchant: Merchant = Depends(get_current_merchant)
):
    """Test AI response generation"""
    try:
        ai_service = AIService()
        result = await ai_service.test_ai_response(merchant, test_request.message)
        
        return {
            "status": "success",
            "test_input": test_request.message,
            "ai_response": result.get("ai_response"),
            "business_name": merchant.business_name,
            "ai_personality": merchant.ai_personality,
            "model_used": settings.OPENAI_MODEL
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"AI test failed: {str(e)}")

@merchants_router.get("/analytics")
async def get_analytics(
    merchant: Merchant = Depends(get_current_merchant)
):
    """Get merchant analytics (basic for V2)"""
    return {
        "subscription_tier": merchant.subscription_tier,
        "messages_this_month": merchant.monthly_message_count,
        "message_limit": merchant.monthly_message_limit,
        "usage_percentage": round((merchant.monthly_message_count / merchant.monthly_message_limit) * 100, 2),
        "products_count": len(merchant.product_catalog or []),
        "account_status": "Active" if merchant.is_active else "Inactive",
        "created_at": merchant.created_at,
        "last_active": merchant.last_active_at,
        "days_active": (merchant.last_active_at - merchant.created_at).days if merchant.last_active_at else 0
    }

@merchants_router.get("/subscription")
async def get_subscription_info(
    merchant: Merchant = Depends(get_current_merchant)
):
    """Get subscription information"""
    tier_info = settings.TIER_LIMITS.get(merchant.subscription_tier, {})
    
    return {
        "current_tier": merchant.subscription_tier,
        "message_limit": merchant.monthly_message_limit,
        "messages_used": merchant.monthly_message_count,
        "messages_remaining": merchant.monthly_message_limit - merchant.monthly_message_count,
        "can_send_messages": merchant.can_send_message(),
        "tier_price": tier_info.get("price", 0),
        "available_tiers": settings.TIER_LIMITS
    } 
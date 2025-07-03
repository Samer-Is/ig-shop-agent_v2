"""
Authentication API for IG-Shop-Agent V2
Instagram OAuth and JWT token management
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel
from jose import JWTError, jwt
from datetime import datetime, timedelta
import httpx
import hashlib

from ..core.database import get_db
from ..core.config import settings
from ..models.merchant import Merchant

auth_router = APIRouter()
security = HTTPBearer()

class InstagramAuthRequest(BaseModel):
    code: str
    state: str

class InstagramAuthResponse(BaseModel):
    access_token: str
    merchant_id: str
    page_name: str
    business_name: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

def create_access_token(data: dict):
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def hash_token(token: str) -> str:
    """Hash Instagram access token for secure storage"""
    return hashlib.sha256(token.encode()).hexdigest()

async def exchange_code_for_token(code: str):
    """Exchange Instagram auth code for access token"""
    url = "https://api.instagram.com/oauth/access_token"
    
    data = {
        "client_id": settings.META_APP_ID,
        "client_secret": settings.META_APP_SECRET,
        "grant_type": "authorization_code",
        "redirect_uri": "https://localhost:3000/auth/callback",  # This should match your frontend
        "code": code
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, data=data)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Instagram OAuth error: {response.text}"
            )
        
        result = response.json()
        return result

async def get_instagram_user_info(access_token: str):
    """Get Instagram user and page information"""
    url = f"https://graph.instagram.com/me?fields=id,username&access_token={access_token}"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to get Instagram user info: {response.text}"
            )
        
        return response.json()

@auth_router.post("/instagram/callback", response_model=InstagramAuthResponse)
async def instagram_oauth_callback(
    auth_request: InstagramAuthRequest,
    db: Session = Depends(get_db)
):
    """Handle Instagram OAuth callback"""
    try:
        # Exchange code for access token
        token_data = await exchange_code_for_token(auth_request.code)
        access_token = token_data.get("access_token")
        
        if not access_token:
            raise HTTPException(status_code=400, detail="No access token received")
        
        # Get user info
        user_info = await get_instagram_user_info(access_token)
        instagram_page_id = user_info.get("id")
        page_name = user_info.get("username", "Unknown")
        
        if not instagram_page_id:
            raise HTTPException(status_code=400, detail="Failed to get Instagram page ID")
        
        # Check if merchant already exists
        existing_merchant = db.query(Merchant).filter(
            Merchant.instagram_page_id == instagram_page_id
        ).first()
        
        if existing_merchant:
            # Update existing merchant
            existing_merchant.access_token_hash = hash_token(access_token)
            existing_merchant.page_name = page_name
            existing_merchant.last_active_at = datetime.utcnow()
            db.commit()
            merchant = existing_merchant
        else:
            # Create new merchant
            merchant = Merchant(
                instagram_page_id=instagram_page_id,
                page_name=page_name,
                access_token_hash=hash_token(access_token),
                business_name=f"{page_name} Business",
                subscription_tier="starter",
                monthly_message_limit=1000
            )
            db.add(merchant)
            db.commit()
            db.refresh(merchant)
        
        # Create JWT token for merchant
        jwt_token = create_access_token(
            data={
                "sub": str(merchant.id),
                "instagram_page_id": instagram_page_id,
                "tier": merchant.subscription_tier
            }
        )
        
        return InstagramAuthResponse(
            access_token=jwt_token,
            merchant_id=str(merchant.id),
            page_name=page_name,
            business_name=merchant.business_name
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication failed: {str(e)}")

@auth_router.get("/me")
async def get_current_merchant(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
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
    
    return merchant.to_dict()

@auth_router.get("/instagram/auth-url")
async def get_instagram_auth_url():
    """Get Instagram OAuth authorization URL"""
    base_url = "https://api.instagram.com/oauth/authorize"
    redirect_uri = "https://localhost:3000/auth/callback"  # Frontend callback URL
    state = "igshop_v2_auth_state"  # In production, use a random state
    
    auth_url = (
        f"{base_url}?"
        f"client_id={settings.META_APP_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"scope=user_profile,user_media&"
        f"response_type=code&"
        f"state={state}"
    )
    
    return {
        "auth_url": auth_url,
        "redirect_uri": redirect_uri,
        "state": state
    }

@auth_router.post("/refresh")
async def refresh_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Refresh JWT token"""
    try:
        payload = jwt.decode(
            credentials.credentials, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        merchant_id: str = payload.get("sub")
        instagram_page_id: str = payload.get("instagram_page_id")
        tier: str = payload.get("tier")
        
        if merchant_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Create new token
        new_token = create_access_token(
            data={
                "sub": merchant_id,
                "instagram_page_id": instagram_page_id,
                "tier": tier
            }
        )
        
        return TokenResponse(
            access_token=new_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token") 
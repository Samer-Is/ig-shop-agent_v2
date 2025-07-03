"""
Instagram Webhooks API for IG-Shop-Agent V2
Process incoming Instagram DMs and trigger AI responses
"""
from fastapi import APIRouter, Request, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session
import hashlib
import hmac
import json
from typing import Dict, Any

from ..core.database import get_db
from ..core.config import settings
from ..models.merchant import Merchant
from ..services.ai_service import AIService
from ..services.instagram_service import InstagramService

webhook_router = APIRouter()

def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Verify Instagram webhook signature"""
    expected_signature = hmac.new(
        settings.META_APP_SECRET.encode(),
        payload,
        hashlib.sha1
    ).hexdigest()
    
    return hmac.compare_digest(f"sha1={expected_signature}", signature)

@webhook_router.get("/instagram")
async def verify_webhook(request: Request):
    """Verify Instagram webhook subscription"""
    hub_mode = request.query_params.get("hub.mode")
    hub_challenge = request.query_params.get("hub.challenge")
    hub_verify_token = request.query_params.get("hub.verify_token")
    
    if (hub_mode == "subscribe" and 
        hub_verify_token == settings.META_WEBHOOK_VERIFY_TOKEN):
        print("✅ Instagram webhook verified successfully")
        return hub_challenge
    
    raise HTTPException(status_code=403, detail="Webhook verification failed")

@webhook_router.post("/instagram")
async def handle_instagram_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Handle incoming Instagram webhook events"""
    try:
        # Get request body and signature
        body = await request.body()
        signature = request.headers.get("X-Hub-Signature")
        
        if not signature:
            raise HTTPException(status_code=400, detail="Missing signature")
        
        # Verify signature in production
        if settings.ENVIRONMENT == "production":
            if not verify_webhook_signature(body, signature):
                raise HTTPException(status_code=403, detail="Invalid signature")
        
        # Parse webhook data
        webhook_data = json.loads(body.decode())
        
        # Process webhook in background to respond quickly
        background_tasks.add_task(
            process_webhook_data,
            webhook_data,
            db
        )
        
        return {"status": "success", "message": "Webhook received"}
        
    except Exception as e:
        print(f"❌ Webhook processing error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

async def process_webhook_data(webhook_data: Dict[Any, Any], db: Session):
    """Process Instagram webhook data"""
    try:
        entries = webhook_data.get("entry", [])
        
        for entry in entries:
            # Get page/user ID
            page_id = entry.get("id")
            
            # Find merchant by Instagram page ID
            merchant = db.query(Merchant).filter(
                Merchant.instagram_page_id == page_id
            ).first()
            
            if not merchant:
                print(f"⚠️ Merchant not found for page ID: {page_id}")
                continue
            
            if not merchant.can_send_message():
                print(f"⚠️ Merchant {merchant.business_name} cannot send messages (usage limit or inactive)")
                continue
            
            # Process messaging events
            messaging = entry.get("messaging", [])
            
            for message_event in messaging:
                await process_message_event(message_event, merchant, db)
                
    except Exception as e:
        print(f"❌ Error processing webhook data: {e}")

async def process_message_event(message_event: Dict[Any, Any], merchant: Merchant, db: Session):
    """Process individual Instagram message event"""
    try:
        # Extract message data
        sender_id = message_event.get("sender", {}).get("id")
        recipient_id = message_event.get("recipient", {}).get("id")
        timestamp = message_event.get("timestamp")
        
        # Get message content
        message_data = message_event.get("message", {})
        message_text = message_data.get("text", "")
        message_id = message_data.get("mid")
        
        if not message_text or not sender_id:
            print("⚠️ Invalid message data")
            return
        
        print(f"📨 Processing message from {sender_id}: {message_text[:50]}...")
        
        # Initialize services
        ai_service = AIService()
        instagram_service = InstagramService()
        
        # Generate AI response
        ai_response = await ai_service.generate_response(
            message_text=message_text,
            merchant=merchant,
            sender_id=sender_id,
            db=db
        )
        
        if ai_response:
            # Send response via Instagram
            await instagram_service.send_message(
                recipient_id=sender_id,
                message_text=ai_response,
                merchant=merchant
            )
            
            # Update merchant usage
            merchant.monthly_message_count += 1
            db.commit()
            
            print(f"✅ AI response sent to {sender_id}")
        else:
            print("⚠️ No AI response generated")
            
    except Exception as e:
        print(f"❌ Error processing message event: {e}")

@webhook_router.get("/test")
async def test_webhook():
    """Test endpoint for webhook functionality"""
    return {
        "status": "healthy",
        "service": "Instagram Webhook Handler",
        "version": "2.0.0",
        "verify_token": settings.META_WEBHOOK_VERIFY_TOKEN,
        "app_id": settings.META_APP_ID,
        "environment": settings.ENVIRONMENT
    } 
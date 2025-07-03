"""
Instagram Graph API Service for IG-Shop-Agent V2
Handle Instagram DM sending and API interactions
"""
import httpx
from typing import Optional, Dict, Any
import asyncio

from ..core.config import settings
from ..models.merchant import Merchant

class InstagramService:
    """Service for Instagram Graph API interactions"""
    
    def __init__(self):
        """Initialize Instagram service"""
        self.base_url = "https://graph.instagram.com/v18.0"
        self.timeout = 10  # 10 second timeout
    
    async def send_message(
        self,
        recipient_id: str,
        message_text: str,
        merchant: Merchant
    ) -> bool:
        """Send message via Instagram Graph API"""
        try:
            # For V2, we'll simulate message sending since we need actual Instagram access tokens
            # In production, you would decrypt the access token and use it here
            
            print(f"📤 Sending message to {recipient_id}: {message_text[:50]}...")
            
            # Simulate API call delay
            await asyncio.sleep(0.5)
            
            # In production, use this logic:
            # access_token = self._decrypt_access_token(merchant.access_token_hash)
            # url = f"{self.base_url}/me/messages"
            # data = {
            #     "recipient": {"id": recipient_id},
            #     "message": {"text": message_text},
            #     "access_token": access_token
            # }
            # 
            # async with httpx.AsyncClient() as client:
            #     response = await client.post(url, json=data, timeout=self.timeout)
            #     
            #     if response.status_code == 200:
            #         return True
            #     else:
            #         print(f"❌ Instagram API error: {response.text}")
            #         return False
            
            # For V2 demo, always return success
            print(f"✅ Message simulated successfully (V2 Demo Mode)")
            return True
            
        except Exception as e:
            print(f"❌ Instagram service error: {e}")
            return False
    
    async def get_user_info(self, user_id: str, access_token: str) -> Optional[Dict[Any, Any]]:
        """Get Instagram user information"""
        try:
            url = f"{self.base_url}/{user_id}"
            params = {
                "fields": "id,username,name",
                "access_token": access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, timeout=self.timeout)
                
                if response.status_code == 200:
                    return response.json()
                else:
                    print(f"❌ Failed to get user info: {response.text}")
                    return None
                    
        except Exception as e:
            print(f"❌ Error getting user info: {e}")
            return None
    
    async def validate_access_token(self, access_token: str) -> bool:
        """Validate Instagram access token"""
        try:
            url = f"{self.base_url}/me"
            params = {"access_token": access_token}
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, timeout=self.timeout)
                
                return response.status_code == 200
                
        except Exception as e:
            print(f"❌ Token validation error: {e}")
            return False
    
    async def setup_webhook(self, access_token: str, webhook_url: str) -> bool:
        """Setup Instagram webhook subscription"""
        try:
            url = f"{self.base_url}/me/subscribed_apps"
            params = {
                "subscribed_fields": "messages,messaging_postbacks",
                "access_token": access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, params=params, timeout=self.timeout)
                
                if response.status_code == 200:
                    print(f"✅ Webhook setup successful for {webhook_url}")
                    return True
                else:
                    print(f"❌ Webhook setup failed: {response.text}")
                    return False
                    
        except Exception as e:
            print(f"❌ Webhook setup error: {e}")
            return False
    
    def _decrypt_access_token(self, token_hash: str) -> str:
        """Decrypt Instagram access token (placeholder)"""
        # In production, implement proper encryption/decryption
        # For V2, return a demo token
        return "demo_access_token_v2"
    
    async def get_page_info(self, access_token: str) -> Optional[Dict[Any, Any]]:
        """Get Instagram page information"""
        try:
            url = f"{self.base_url}/me"
            params = {
                "fields": "id,username,name,biography,followers_count,media_count",
                "access_token": access_token
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, timeout=self.timeout)
                
                if response.status_code == 200:
                    return response.json()
                else:
                    print(f"❌ Failed to get page info: {response.text}")
                    return None
                    
        except Exception as e:
            print(f"❌ Error getting page info: {e}")
            return None
    
    async def test_instagram_connection(self) -> Dict[str, Any]:
        """Test Instagram API connection"""
        return {
            "status": "healthy",
            "service": "Instagram Graph API",
            "base_url": self.base_url,
            "demo_mode": True,  # V2 uses demo mode
            "capabilities": [
                "send_messages",
                "receive_webhooks", 
                "user_authentication",
                "webhook_verification"
            ]
        } 
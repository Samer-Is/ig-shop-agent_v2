"""
AI Service for IG-Shop-Agent V2
OpenAI GPT-4o integration for generating Instagram DM responses
"""
import openai
from typing import Optional
from sqlalchemy.orm import Session
import json

from ..core.config import settings
from ..models.merchant import Merchant

class AIService:
    """AI service for generating conversational responses"""
    
    def __init__(self):
        """Initialize OpenAI client"""
        openai.api_key = settings.OPENAI_API_KEY
        self.model = settings.OPENAI_MODEL
        self.max_tokens = settings.OPENAI_MAX_TOKENS
        self.temperature = settings.OPENAI_TEMPERATURE
    
    async def generate_response(
        self,
        message_text: str,
        merchant: Merchant,
        sender_id: str,
        db: Session
    ) -> Optional[str]:
        """Generate AI response for Instagram DM"""
        try:
            # Build context and prompt
            system_prompt = self._build_system_prompt(merchant)
            user_message = self._format_user_message(message_text, sender_id)
            
            # Call OpenAI GPT-4o
            response = await self._call_openai(system_prompt, user_message)
            
            if response:
                print(f"🤖 AI generated response: {response[:100]}...")
                return response
            else:
                return settings.DEFAULT_AI_RESPONSE
                
        except Exception as e:
            print(f"❌ AI service error: {e}")
            return settings.DEFAULT_AI_RESPONSE
    
    def _build_system_prompt(self, merchant: Merchant) -> str:
        """Build system prompt with merchant context"""
        # Default product catalog if none exists
        products = merchant.product_catalog or [
            {
                "name": "Sample Product",
                "description": "A great product for customers",
                "price": "Contact for pricing",
                "availability": "In stock"
            }
        ]
        
        # Build working hours info
        hours_info = "We're available during business hours"
        if merchant.working_hours:
            hours_info = f"Our working hours: {json.dumps(merchant.working_hours)}"
        
        system_prompt = f"""You are a helpful AI assistant for {merchant.business_name}, an Instagram business.

BUSINESS INFORMATION:
- Business Name: {merchant.business_name}
- Category: {merchant.business_category or 'General Business'}
- Description: {merchant.business_description or 'A great business serving customers'}
- Instagram: @{merchant.page_name}
- {hours_info}

COMMUNICATION STYLE:
- Be {merchant.ai_personality or 'friendly'} and professional
- Respond in {merchant.default_language or 'Arabic'} primarily, fallback to {merchant.fallback_language or 'English'}
- Keep responses concise and helpful
- Always be polite and customer-focused

PRODUCT CATALOG:
{json.dumps(products, indent=2)}

CAPABILITIES:
- Answer questions about products and services
- Provide pricing information
- Help with orders and inquiries
- Give business information
- Handle customer service requests

GUIDELINES:
- If asked about products, refer to the catalog above
- For orders, collect: product name, quantity, customer info, delivery address
- If you can't help, politely direct them to contact us directly
- Never make up information not provided in the context
- Be helpful but don't overpromise

IMPORTANT: Keep responses under 500 characters for Instagram DM limits."""

        return system_prompt
    
    def _format_user_message(self, message_text: str, sender_id: str) -> str:
        """Format user message with context"""
        return f"Customer (ID: {sender_id}) says: {message_text}"
    
    async def _call_openai(self, system_prompt: str, user_message: str) -> Optional[str]:
        """Call OpenAI API with error handling"""
        try:
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                timeout=10  # 10 second timeout for cost control
            )
            
            if response.choices and response.choices[0].message:
                return response.choices[0].message.content.strip()
            
            return None
            
        except openai.error.RateLimitError:
            print("⚠️ OpenAI rate limit reached")
            return "I'm currently busy helping other customers. Please try again in a moment."
            
        except openai.error.InvalidRequestError as e:
            print(f"⚠️ OpenAI request error: {e}")
            return settings.DEFAULT_AI_RESPONSE
            
        except Exception as e:
            print(f"❌ OpenAI API error: {e}")
            return None
    
    async def test_ai_response(self, merchant: Merchant, test_message: str) -> dict:
        """Test AI response generation (for API testing)"""
        try:
            response = await self.generate_response(
                message_text=test_message,
                merchant=merchant,
                sender_id="test_user",
                db=None
            )
            
            return {
                "status": "success",
                "test_message": test_message,
                "ai_response": response,
                "model": self.model,
                "business": merchant.business_name
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "test_message": test_message
            } 
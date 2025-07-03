import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CosmosService } from '../database/cosmos.service';
import { AnalyticsService } from './analytics.service';
import { ConversationService } from './conversation.service';
import { SentimentAnalysis, IntentClassification } from '../database/conversations.schema';
import axios from 'axios';
import { KeyVaultService } from '../azure/keyvault.service';
import { InstagramGraphService } from './instagram-graph.service';
import { SpeechService } from './speech.service';
import { OrderExtractionService } from './order-extraction.service';
import { OrderService } from './order.service';
import { KnowledgeBaseService } from './knowledge-base.service';

export interface MessageContext {
  pageId: string;
  senderId: string;
  messageText: string;
  timestamp: Date;
}

export interface MerchantContext {
  merchantId: string;
  pageId: string;
  businessInfo: {
    businessName?: string;
    workingHours?: string;
    termsAndConditions?: string;
    rules?: string;
  };
  productCatalog: Array<{
    name: string;
    description: string;
    price?: number;
    stock?: number;
    rules?: string;
    mediaLinks?: string[];
  }>;
  aiSettings: {
    customPrompt?: string;
    tone?: 'professional' | 'friendly' | 'casual';
    language?: 'en' | 'ar' | 'auto';
  };
}

export interface AIResponse {
  text: string;
  confidence: number;
  languageDetected: 'en' | 'ar' | 'mixed';
  intent?: IntentClassification;
  sentiment?: SentimentAnalysis;
  requiresHandover?: boolean;
  responseTime?: number;
  tokensUsed?: number;
}

interface WebhookMessage {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    messaging: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
        attachments?: Array<{
          type: 'audio' | 'image' | 'video' | 'file';
          payload: { url: string };
        }>;
      };
    }>;
  }>;
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly openaiApiKey: string;
  private readonly openaiModel: string;

  constructor(
    private configService: ConfigService,
    private cosmosService: CosmosService,
    private analyticsService: AnalyticsService,
    private conversationService: ConversationService,
    private keyVaultService: KeyVaultService,
    private instagramService: InstagramGraphService,
    private speechService: SpeechService,
    private orderExtractionService: OrderExtractionService,
    private orderService: OrderService,
    private knowledgeBaseService: KnowledgeBaseService
  ) {
    this.openaiApiKey = this.configService.get<string>('openai.apiKey');
    this.openaiModel = this.configService.get<string>('openai.model');
  }

  /**
   * Main method to process incoming message and generate AI response
   */
  async processMessage(context: MessageContext): Promise<AIResponse | null> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Processing message for page ${context.pageId}`);

      // Step 1: Look up merchant by pageId
      const merchantContext = await this.getMerchantContext(context.pageId);
      if (!merchantContext) {
        this.logger.warn(`No merchant found for page ID: ${context.pageId}`);
        return null;
      }

      // Step 2: Detect message language
      const detectedLanguage = this.detectLanguage(context.messageText);

      // Step 3: Run sentiment analysis and intent classification in parallel
      const [sentiment, intent] = await Promise.all([
        this.analyticsService.analyzeSentiment(context.messageText, detectedLanguage),
        this.analyticsService.classifyIntent(context.messageText, detectedLanguage)
      ]);

      // Step 4: Store customer message with analytics
      await this.conversationService.storeMessage(
        merchantContext.merchantId,
        context.pageId,
        context.senderId,
        context.messageText,
        'customer',
        'text',
        {
          sentiment,
          intent,
          languageDetected: detectedLanguage,
          confidence: Math.max(sentiment.confidence, intent.confidence)
        }
      );

      // Step 5: Check if human handover is required
      const requiresHandover = this.analyticsService.shouldRequestHandover(sentiment);
      
      // Step 6: Search knowledge base for relevant context
      const knowledgeContext = await this.searchKnowledgeBase(merchantContext.merchantId, context.messageText);

      // Step 7: Construct system prompt with merchant context, sentiment awareness, and knowledge base context
      const systemPrompt = this.constructSystemPrompt(merchantContext, detectedLanguage, sentiment, knowledgeContext);

      // Step 8: Generate AI response
      const aiResponse = await this.generateAIResponse(
        systemPrompt,
        context.messageText,
        detectedLanguage,
        sentiment,
        intent,
        requiresHandover,
      );

      const responseTime = Date.now() - startTime;
      aiResponse.responseTime = responseTime;
      aiResponse.sentiment = sentiment;
      aiResponse.intent = intent;
      aiResponse.requiresHandover = requiresHandover;

      // Step 9: Store AI response
      await this.conversationService.storeMessage(
        merchantContext.merchantId,
        context.pageId,
        'ai_assistant',
        aiResponse.text,
        'ai',
        'text',
        {
          sentiment,
          intent,
          confidence: aiResponse.confidence,
          languageDetected: detectedLanguage,
          responseTime,
          tokensUsed: aiResponse.tokensUsed,
          modelUsed: this.openaiModel,
          handoverRequested: requiresHandover,
          handoverReason: requiresHandover ? 'Negative sentiment detected' : undefined
        }
      );

      this.logger.log(`AI response generated successfully for page ${context.pageId} in ${responseTime}ms`);
      return aiResponse;
    } catch (error) {
      this.logger.error('Error processing message with AI:', error);
      return null;
    }
  }

  /**
   * Retrieve merchant context from database by pageId
   */
  private async getMerchantContext(pageId: string): Promise<MerchantContext | null> {
    try {
      const merchantContainer = this.cosmosService.getContainer('merchants');
      
      // Query merchant by pageId
      const query = 'SELECT * FROM c WHERE c.pageId = @pageId';
      const { resources: merchants } = await merchantContainer.items
        .query({
          query,
          parameters: [{ name: '@pageId', value: pageId }],
        })
        .fetchAll();

      if (merchants.length === 0) {
        return null;
      }

      const merchant = merchants[0];
      
      return {
        merchantId: merchant.id,
        pageId: merchant.pageId,
        businessInfo: merchant.businessInfo || {},
        productCatalog: merchant.productCatalog || [],
        aiSettings: merchant.aiSettings || {},
      };
    } catch (error) {
      this.logger.error('Error retrieving merchant context:', error);
      return null;
    }
  }

  /**
   * Detect message language (simple heuristic-based detection)
   */
  private detectLanguage(text: string): 'en' | 'ar' | 'mixed' {
    try {
      // Count Arabic characters (Unicode ranges for Arabic script)
      const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
      const arabicMatches = text.match(arabicRegex) || [];
      
      // Count English characters
      const englishRegex = /[a-zA-Z]/g;
      const englishMatches = text.match(englishRegex) || [];

      const arabicRatio = arabicMatches.length / text.length;
      const englishRatio = englishMatches.length / text.length;

      if (arabicRatio > 0.3) {
        return englishRatio > 0.2 ? 'mixed' : 'ar';
      } else if (englishRatio > 0.3) {
        return 'ar';
      } else {
        return 'mixed';
      }
    } catch (error) {
      this.logger.error('Error detecting language:', error);
      return 'en'; // Default to English
    }
  }

  /**
   * Construct detailed system prompt for GPT-4o
   */
  private constructSystemPrompt(merchant: MerchantContext, language: 'en' | 'ar' | 'mixed', sentiment: SentimentAnalysis, knowledgeContext: string): string {
    const businessName = merchant.businessInfo.businessName || 'Our Store';
    const workingHours = merchant.businessInfo.workingHours || 'Contact us for hours';
    const customPrompt = merchant.aiSettings.customPrompt || '';

    // Build product catalog section
    const productsSection = this.buildProductCatalogSection(merchant.productCatalog);

    // Language instruction
    const languageInstruction = this.getLanguageInstruction(language);

    const systemPrompt = `You are a helpful AI assistant for ${businessName}, an e-commerce business on Instagram. Your role is to assist customers with their inquiries about products, orders, and general support.

IMPORTANT INSTRUCTIONS:
${languageInstruction}

BUSINESS INFORMATION:
- Business Name: ${businessName}
- Working Hours: ${workingHours}
${merchant.businessInfo.rules ? `- Business Rules: ${merchant.businessInfo.rules}` : ''}
${merchant.businessInfo.termsAndConditions ? `- Terms & Conditions: ${merchant.businessInfo.termsAndConditions}` : ''}

PRODUCT CATALOG:
${productsSection}

${customPrompt ? `CUSTOM INSTRUCTIONS FROM MERCHANT:\n${customPrompt}\n` : ''}

${knowledgeContext}

RESPONSE GUIDELINES:
1. Be helpful, friendly, and professional
2. Use the product catalog information to answer product questions
3. If asked about products not in the catalog, politely explain you don't have that information
4. For order placement, collect: product name, quantity, size/color (if applicable), customer name, phone, and address
5. For support issues, provide helpful information based on business rules
6. If you can't help with something, politely explain and suggest they contact customer service
7. Keep responses concise but informative
8. Always maintain a positive and encouraging tone

Remember: You represent ${businessName} and should provide accurate information based only on the provided context.

SENTIMENT ANALYSIS:
- Customer Sentiment: ${sentiment?.overall || 'neutral'}
- Confidence: ${sentiment?.confidence || 0.5}
- Emotions: Anger: ${sentiment?.emotions?.anger || 0}, Joy: ${sentiment?.emotions?.joy || 0}

${sentiment?.overall === 'negative' ? 'WARNING: Customer appears frustrated or upset. Respond with extra empathy and consider offering human assistance.' : ''}

TONE ADJUSTMENT:
${sentiment?.overall === 'positive' ? '- Match their positive energy and enthusiasm' : ''}
${sentiment?.overall === 'negative' ? '- Be extra patient, empathetic, and apologetic. Offer immediate assistance.' : ''}
${sentiment?.overall === 'neutral' ? '- Maintain professional, helpful tone' : ''}`;

    return systemPrompt;
  }

  /**
   * Build product catalog section for system prompt
   */
  private buildProductCatalogSection(products: any[]): string {
    if (!products || products.length === 0) {
      return 'No products currently available in catalog.';
    }

    return products
      .map((product, index) => {
        let productInfo = `${index + 1}. ${product.name}`;
        if (product.description) productInfo += `\n   Description: ${product.description}`;
        if (product.price) productInfo += `\n   Price: ${product.price}`;
        if (product.stock !== undefined) productInfo += `\n   Stock: ${product.stock}`;
        if (product.rules) productInfo += `\n   Special Rules: ${product.rules}`;
        return productInfo;
      })
      .join('\n\n');
  }

  /**
   * Get language-specific instructions
   */
  private getLanguageInstruction(language: 'en' | 'ar' | 'mixed'): string {
    switch (language) {
      case 'ar':
        return 'Respond in Arabic (Jordanian dialect preferred when appropriate). Be culturally sensitive and respectful.';
      case 'mixed':
        return 'The customer is using both Arabic and English. Respond in the same language they used, or ask which language they prefer.';
      default:
        return 'Respond in English. If the customer writes in Arabic, you may respond in Arabic (Jordanian dialect preferred).';
    }
  }

  /**
   * Generate AI response using Azure OpenAI GPT-4o
   */
  private async generateAIResponse(
    systemPrompt: string,
    userMessage: string,
    detectedLanguage: 'en' | 'ar' | 'mixed',
    sentiment: SentimentAnalysis,
    intent: IntentClassification,
    requiresHandover: boolean,
  ): Promise<AIResponse> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.openaiModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 500,
          temperature: 0.7,
          top_p: 0.9,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const aiResponseText = response.data.choices[0]?.message?.content?.trim();
      const tokensUsed = response.data.usage?.total_tokens || 0;
      
      if (!aiResponseText) {
        throw new Error('Empty response from OpenAI');
      }

      // Add handover flag to response if required
      let finalResponse = aiResponseText;
      if (requiresHandover) {
        const handoverMessage = detectedLanguage === 'ar' 
          ? '\n\n[يُنصح بالتواصل مع فريق الدعم للمساعدة الإضافية]'
          : '\n\n[Recommend connecting with support team for additional assistance]';
        finalResponse += handoverMessage;
      }

      return {
        text: finalResponse,
        confidence: 0.95, // Default confidence, can be enhanced with actual confidence scoring
        languageDetected: detectedLanguage,
        intent,
        sentiment,
        requiresHandover,
        tokensUsed,
      };
    } catch (error) {
      this.logger.error('Error calling OpenAI API:', error);
      
      // Fallback response
      return {
        text: detectedLanguage === 'ar' 
          ? 'أعتذر، يبدو أن هناك مشكلة فنية. يرجى المحاولة مرة أخرى أو التواصل معنا مباشرة.'
          : 'Sorry, I\'m experiencing technical difficulties. Please try again or contact us directly.',
        confidence: 0.1,
        languageDetected: detectedLanguage,
        intent,
        sentiment,
        requiresHandover: true,
        tokensUsed: 0,
      };
    }
  }

  /**
   * Process incoming webhook message
   */
  async processWebhookMessage(webhookData: WebhookMessage) {
    try {
      for (const entry of webhookData.entry) {
        for (const messaging of entry.messaging) {
          if (messaging.message) {
            await this.handleMessage(messaging);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error processing webhook message:', error);
      throw error;
    }
  }

  /**
   * Handle individual message
   */
  private async handleMessage(messaging: any) {
    try {
      const senderId = messaging.sender.id;
      const pageId = messaging.recipient.id;
      const messageText = messaging.message.text;
      const messageId = messaging.message.mid;
      const timestamp = new Date(messaging.timestamp);

      // Handle voice messages
      let processedText = messageText;
      if (!messageText && messaging.message.attachments) {
        const audioAttachment = messaging.message.attachments.find(
          (att: any) => att.type === 'audio'
        );
        if (audioAttachment) {
          processedText = await this.speechService.transcribeAudio(
            audioAttachment.payload.url
          );
          this.logger.log(`Transcribed audio message: ${processedText}`);
        }
      }

      if (!processedText) {
        this.logger.warn('No text content found in message');
        return;
      }

      // Get merchant information
      const merchant = await this.getMerchantByPageId(pageId);
      if (!merchant) {
        this.logger.warn(`No merchant found for page ID: ${pageId}`);
        return;
      }

      // Create conversation message
      const message: ConversationMessage = {
        id: messageId,
        senderId,
        recipientId: pageId,
        message: processedText,
        timestamp,
        direction: 'inbound',
        messageType: messageText ? 'text' : 'voice',
        platform: 'instagram'
      };

      // Analyze sentiment and intent
      const analysis = await this.analyzeMessage(processedText, merchant);
      message.sentiment = analysis.sentiment;
      message.intent = analysis.intent;

      // Save message to conversation
      await this.conversationService.addMessage(merchant.id, message);

      // Generate AI response
      const aiResponse = await this.generateAIResponse(
        processedText,
        merchant,
        analysis
      );

      // Check for order extraction if intent is order-related
      if (analysis.intent.classification === 'order_placement' && 
          analysis.intent.confidence > 0.7) {
        try {
          const orderExtraction = await this.orderExtractionService.extractOrderData(
            processedText,
            merchant.id
          );

          if (orderExtraction.confidence > 0.6) {
            // Create order if extraction is confident enough
            const order = await this.orderService.createOrder(
              merchant.id,
              pageId,
              senderId,
              orderExtraction
            );

            this.logger.log(`Order created: ${order.orderNumber} (confidence: ${orderExtraction.confidence})`);

            // Modify AI response to acknowledge order creation
            const orderConfirmation = `\n\n✅ I've captured your order details! Order #${order.orderNumber} is now pending confirmation. Our team will review it shortly.`;
            aiResponse.content += orderConfirmation;
          }
        } catch (orderError) {
          this.logger.error('Error extracting order data:', orderError);
          // Continue with normal response even if order extraction fails
        }
      }

      // Handle handover flags
      if (analysis.sentiment.requiresHandover || 
          aiResponse.content.includes('[HUMAN_HANDOVER]')) {
        await this.notifyForHandover(merchant.id, senderId, processedText);
        // Remove handover flag from response
        aiResponse.content = aiResponse.content.replace(/\[HUMAN_HANDOVER\]/g, '');
      }

      // Send AI response
      await this.sendResponse(pageId, senderId, aiResponse.content, merchant);

      // Save AI response to conversation
      const responseMessage: ConversationMessage = {
        id: `ai_${Date.now()}`,
        senderId: pageId,
        recipientId: senderId,
        message: aiResponse.content,
        timestamp: new Date(),
        direction: 'outbound',
        messageType: 'text',
        platform: 'instagram',
        isAIGenerated: true,
        aiMetadata: {
          model: 'gpt-4o',
          confidence: aiResponse.confidence,
          processingTime: aiResponse.processingTime
        }
      };

      await this.conversationService.addMessage(merchant.id, responseMessage);

    } catch (error) {
      this.logger.error('Error handling message:', error);
      throw error;
    }
  }

  /**
   * Analyze message sentiment and intent
   */
  private async analyzeMessage(
    message: string,
    merchant: any
  ): Promise<{ sentiment: SentimentAnalysis; intent: IntentClassification }> {
    try {
      const analysisPrompt = `
        Analyze this customer message for sentiment and intent:
        Message: "${message}"
        
        Respond with JSON in this exact format:
        {
          "sentiment": {
            "score": number between -1 and 1,
            "label": "positive" | "negative" | "neutral",
            "confidence": number between 0 and 1,
            "requiresHandover": boolean
          },
          "intent": {
            "classification": "price_inquiry" | "stock_check" | "order_placement" | "shipping_question" | "complaint" | "general_inquiry" | "other",
            "confidence": number between 0 and 1,
            "entities": string[]
          }
        }
        
        Guidelines:
        - Set requiresHandover to true if sentiment is very negative (< -0.7) or customer is angry/frustrated
        - For order_placement, look for clear purchase intent with specific products/quantities
        - Extract relevant entities (product names, quantities, etc.)
      `;

      const response = await this.callOpenAI(analysisPrompt, 'analysis');
      return JSON.parse(response);
    } catch (error) {
      this.logger.error('Error analyzing message:', error);
      // Return default analysis
      return {
        sentiment: {
          score: 0,
          label: 'neutral',
          confidence: 0.5,
          requiresHandover: false
        },
        intent: {
          classification: 'general_inquiry',
          confidence: 0.5,
          entities: []
        }
      };
    }
  }

  /**
   * Generate AI response
   */
  private async generateAIResponse(
    message: string,
    merchant: any,
    analysis: { sentiment: SentimentAnalysis; intent: IntentClassification }
  ): Promise<{ content: string; confidence: number; processingTime: number }> {
    const startTime = Date.now();

    try {
      // Build context-aware prompt
      const systemPrompt = this.buildSystemPrompt(merchant, analysis);
      
      const userPrompt = `
        Customer message: "${message}"
        Sentiment: ${analysis.sentiment.label} (${analysis.sentiment.score.toFixed(2)})
        Intent: ${analysis.intent.classification} (confidence: ${analysis.intent.confidence.toFixed(2)})
        
        Respond as a helpful Instagram shop assistant. ${analysis.sentiment.requiresHandover ? 'Consider flagging for human handover if the issue is complex or the customer is very upset.' : ''}
      `;

      const response = await this.callOpenAI(`${systemPrompt}\n\n${userPrompt}`, 'conversation');
      
      const processingTime = Date.now() - startTime;

      return {
        content: response,
        confidence: 0.9, // Could be calculated based on response quality
        processingTime
      };
    } catch (error) {
      this.logger.error('Error generating AI response:', error);
      throw error;
    }
  }

  /**
   * Build system prompt with merchant context
   */
  private buildSystemPrompt(merchant: any, analysis: any): string {
    const sentimentAdjustment = this.getSentimentAdjustment(analysis.sentiment);
    
    return `
      You are an AI assistant for ${merchant.business_info?.business_name || 'this Instagram shop'}.
      
      BUSINESS CONTEXT:
      ${merchant.business_info ? `
      - Business: ${merchant.business_info.business_name}
      - Hours: ${merchant.business_info.working_hours}
      - Location: ${merchant.business_info.location || 'Jordan'}
      - Rules: ${merchant.business_info.business_rules}
      ` : ''}
      
      PRODUCTS:
      ${merchant.product_catalog?.map((p: any) => 
        `- ${p.name}: ${p.description} (${p.price} ${p.currency || 'JOD'})`
      ).join('\n') || 'No products configured'}
      
      CUSTOM INSTRUCTIONS:
      ${merchant.ai_settings?.custom_prompt || 'Be helpful and professional'}
      
      TONE ADJUSTMENT:
      ${sentimentAdjustment}
      
      IMPORTANT RULES:
      1. Respond in the same language as the customer (English or Arabic)
      2. Be concise but informative
      3. If customer sentiment is very negative, include [HUMAN_HANDOVER] in your internal thought process
      4. For order-related inquiries, ask for missing details (name, phone, address, quantity)
      5. Always be polite and helpful
      6. Use emojis appropriately for Instagram
      
      Current date: ${new Date().toLocaleDateString()}
    `;
  }

  /**
   * Get tone adjustment based on sentiment
   */
  private getSentimentAdjustment(sentiment: SentimentAnalysis): string {
    if (sentiment.score < -0.5) {
      return 'Customer seems upset. Be extra empathetic and understanding. Consider escalating to human if needed.';
    } else if (sentiment.score > 0.5) {
      return 'Customer seems happy/positive. Match their energy while staying professional.';
    }
    return 'Customer is neutral. Be friendly and helpful.';
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string, type: 'conversation' | 'analysis'): Promise<string> {
    try {
      // Get OpenAI endpoint and key from Key Vault
      const openaiEndpoint = await this.keyVaultService.getSecret('OPENAI-ENDPOINT');
      const openaiKey = await this.keyVaultService.getSecret('OPENAI-KEY');

      const response = await fetch(`${openaiEndpoint}/openai/deployments/gpt-4o/chat/completions?api-version=2024-02-15-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': openaiKey,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: prompt
            }
          ],
          max_tokens: type === 'analysis' ? 500 : 1500,
          temperature: type === 'analysis' ? 0.1 : 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      this.logger.error('OpenAI API call failed:', error);
      throw error;
    }
  }

  /**
   * Send response via Instagram Graph API
   */
  private async sendResponse(
    pageId: string,
    recipientId: string,
    message: string,
    merchant: any
  ): Promise<void> {
    try {
      await this.instagramService.sendMessage(pageId, recipientId, message, merchant.accessToken);
    } catch (error) {
      this.logger.error('Error sending Instagram message:', error);
      throw error;
    }
  }

  /**
   * Get merchant by page ID
   */
  private async getMerchantByPageId(pageId: string): Promise<any> {
    // This would typically query the database
    // For now, return a mock merchant
    return {
      id: 'merchant_123',
      pageId,
      business_info: {
        business_name: 'Test Shop',
        working_hours: '9 AM - 6 PM',
        business_rules: 'Free shipping over 50 JOD'
      },
      product_catalog: [
        {
          name: 'Test Product',
          description: 'A great test product',
          price: 25,
          currency: 'JOD'
        }
      ],
      ai_settings: {
        custom_prompt: 'Be friendly and helpful'
      },
      accessToken: 'test_token'
    };
  }

  /**
   * Notify for human handover
   */
  private async notifyForHandover(
    merchantId: string,
    customerId: string,
    message: string
  ): Promise<void> {
    this.logger.log(`Handover requested for merchant ${merchantId}, customer ${customerId}: ${message}`);
    // In a real implementation, this would send notifications
    // (email, push notification, etc.)
  }

  /**
   * Search knowledge base for relevant context
   */
  private async searchKnowledgeBase(merchantId: string, message: string): Promise<string> {
    try {
      const searchResults = await this.knowledgeBaseService.searchKnowledgeBase(merchantId, message, 3);
      
      if (searchResults.length === 0) {
        return '';
      }

      const contextParts = searchResults.map(result => 
        `Document: ${result.fileName}\nRelevant content: ${result.snippet}`
      );

      return `\n\nKnowledge Base Context:\n${contextParts.join('\n\n')}`;
    } catch (error) {
      this.logger.error('Error searching knowledge base:', error);
      return '';
    }
  }
} 
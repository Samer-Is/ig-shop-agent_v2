import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SentimentAnalysis, IntentClassification, IntentType, ExtractedEntity } from '../database/conversations.schema';
import axios from 'axios';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly openaiApiKey: string;
  private readonly openaiModel: string;

  constructor(private configService: ConfigService) {
    this.openaiApiKey = this.configService.get<string>('openai.apiKey');
    this.openaiModel = this.configService.get<string>('openai.model');
  }

  /**
   * Analyze sentiment of customer message using GPT-4o
   */
  async analyzeSentiment(messageText: string, language: 'en' | 'ar' | 'mixed'): Promise<SentimentAnalysis> {
    try {
      const prompt = this.buildSentimentPrompt(language);
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.openaiModel,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: messageText }
          ],
          max_tokens: 300,
          temperature: 0.1, // Low temperature for consistent analysis
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const analysisText = response.data.choices[0]?.message?.content?.trim();
      return this.parseSentimentResponse(analysisText);
    } catch (error) {
      this.logger.error('Error analyzing sentiment:', error);
      return this.getDefaultSentiment();
    }
  }

  /**
   * Classify intent and extract entities using GPT-4o
   */
  async classifyIntent(messageText: string, language: 'en' | 'ar' | 'mixed'): Promise<IntentClassification> {
    try {
      const prompt = this.buildIntentPrompt(language);
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.openaiModel,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: messageText }
          ],
          max_tokens: 400,
          temperature: 0.1,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const analysisText = response.data.choices[0]?.message?.content?.trim();
      return this.parseIntentResponse(analysisText);
    } catch (error) {
      this.logger.error('Error classifying intent:', error);
      return this.getDefaultIntent();
    }
  }

  /**
   * Build sentiment analysis prompt
   */
  private buildSentimentPrompt(language: 'en' | 'ar' | 'mixed'): string {
    const languageInstruction = language === 'ar' 
      ? 'The message is in Arabic. Consider cultural context and local expressions.'
      : language === 'mixed'
      ? 'The message contains both Arabic and English. Analyze both parts appropriately.'
      : 'The message is in English.';

    return `You are an expert sentiment analyzer for customer service messages. ${languageInstruction}

Analyze the sentiment of the customer message and respond with ONLY a JSON object in this exact format:

{
  "overall": "positive|neutral|negative",
  "confidence": 0.0-1.0,
  "emotions": {
    "joy": 0.0-1.0,
    "anger": 0.0-1.0,
    "sadness": 0.0-1.0,
    "fear": 0.0-1.0,
    "surprise": 0.0-1.0,
    "disgust": 0.0-1.0
  },
  "intensity": "low|medium|high",
  "requiresHumanHandover": true/false
}

Guidelines:
- overall: positive (happy, satisfied), neutral (factual, inquiry), negative (frustrated, angry, disappointed)
- confidence: how certain you are about the sentiment (0.0 = not sure, 1.0 = very sure)
- emotions: score each emotion 0.0-1.0 based on presence in the message
- intensity: how strong the sentiment is
- requiresHumanHandover: true if sentiment is highly negative (>0.8 anger, multiple complaints, threats, extreme frustration)

Consider:
- Sarcasm and implied meanings
- Cultural expressions and context
- Emojis and punctuation patterns
- Urgency indicators`;
  }

  /**
   * Build intent classification prompt
   */
  private buildIntentPrompt(language: 'en' | 'ar' | 'mixed'): string {
    const languageInstruction = language === 'ar' 
      ? 'The message is in Arabic. Consider cultural context and local expressions.'
      : language === 'mixed'
      ? 'The message contains both Arabic and English. Analyze both parts appropriately.'
      : 'The message is in English.';

    return `You are an expert intent classifier for e-commerce customer service. ${languageInstruction}

Classify the customer's intent and extract relevant entities. Respond with ONLY a JSON object in this exact format:

{
  "primary": "intent_type",
  "confidence": 0.0-1.0,
  "entities": [
    {
      "type": "entity_type",
      "value": "extracted_value",
      "confidence": 0.0-1.0
    }
  ],
  "subIntents": ["additional_intent_types"]
}

Intent Types:
- greeting: hello, hi, welcome messages
- product_inquiry: asking about products, features, specifications
- price_inquiry: asking about prices, costs, discounts
- stock_check: availability, in stock questions
- order_placement: wanting to buy, purchase, order
- order_status: checking existing order status
- shipping_question: delivery, shipping time, location
- return_request: want to return, exchange, refund
- complaint: problems, issues, dissatisfaction
- compliment: praise, thanks, positive feedback
- support_request: technical help, assistance needed
- business_hours: when open, contact times
- contact_info: phone, address, how to reach
- goodbye: bye, thanks, ending conversation
- other: doesn't fit above categories

Entity Types:
- product_name: specific product mentioned
- quantity: numbers, amounts
- color: color specifications
- size: size specifications
- price: monetary amounts
- phone: phone numbers
- address: location/address information
- name: person's name

Guidelines:
- Choose the most specific intent that fits
- confidence: how certain you are (0.0 = uncertain, 1.0 = very certain)
- Extract all relevant entities mentioned
- Include subIntents if message has multiple purposes
- Consider context and implied meanings`;
  }

  /**
   * Parse sentiment analysis response from GPT-4o
   */
  private parseSentimentResponse(response: string): SentimentAnalysis {
    try {
      // Clean the response to extract just the JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        overall: parsed.overall || 'neutral',
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
        emotions: {
          joy: Math.max(0, Math.min(1, parsed.emotions?.joy || 0)),
          anger: Math.max(0, Math.min(1, parsed.emotions?.anger || 0)),
          sadness: Math.max(0, Math.min(1, parsed.emotions?.sadness || 0)),
          fear: Math.max(0, Math.min(1, parsed.emotions?.fear || 0)),
          surprise: Math.max(0, Math.min(1, parsed.emotions?.surprise || 0)),
          disgust: Math.max(0, Math.min(1, parsed.emotions?.disgust || 0)),
        },
        intensity: parsed.intensity || 'medium',
        requiresHumanHandover: Boolean(parsed.requiresHumanHandover)
      };
    } catch (error) {
      this.logger.error('Error parsing sentiment response:', error);
      return this.getDefaultSentiment();
    }
  }

  /**
   * Parse intent classification response from GPT-4o
   */
  private parseIntentResponse(response: string): IntentClassification {
    try {
      // Clean the response to extract just the JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        primary: parsed.primary || 'other',
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
        entities: (parsed.entities || []).map((entity: any): ExtractedEntity => ({
          type: entity.type,
          value: entity.value,
          confidence: Math.max(0, Math.min(1, entity.confidence || 0.5)),
          startIndex: entity.startIndex,
          endIndex: entity.endIndex
        })),
        subIntents: parsed.subIntents || []
      };
    } catch (error) {
      this.logger.error('Error parsing intent response:', error);
      return this.getDefaultIntent();
    }
  }

  /**
   * Get default sentiment when analysis fails
   */
  private getDefaultSentiment(): SentimentAnalysis {
    return {
      overall: 'neutral',
      confidence: 0.3,
      emotions: {
        joy: 0,
        anger: 0,
        sadness: 0,
        fear: 0,
        surprise: 0,
        disgust: 0
      },
      intensity: 'low',
      requiresHumanHandover: false
    };
  }

  /**
   * Get default intent when classification fails
   */
  private getDefaultIntent(): IntentClassification {
    return {
      primary: 'other',
      confidence: 0.3,
      entities: [],
      subIntents: []
    };
  }

  /**
   * Determine if sentiment requires human handover
   */
  shouldRequestHandover(sentiment: SentimentAnalysis): boolean {
    // High anger or multiple negative emotions
    if (sentiment.emotions.anger > 0.7) return true;
    if (sentiment.overall === 'negative' && sentiment.intensity === 'high') return true;
    if (sentiment.requiresHumanHandover) return true;
    
    // Multiple negative emotions
    const negativeEmotions = [
      sentiment.emotions.anger || 0,
      sentiment.emotions.sadness || 0,
      sentiment.emotions.fear || 0,
      sentiment.emotions.disgust || 0
    ];
    const negativeCount = negativeEmotions.filter(e => e > 0.5).length;
    
    return negativeCount >= 2;
  }

  /**
   * Calculate sentiment score for analytics (0-100)
   */
  calculateSentimentScore(sentiment: SentimentAnalysis): number {
    const baseScore = sentiment.overall === 'positive' ? 75 : 
                     sentiment.overall === 'neutral' ? 50 : 25;
    
    const emotionAdjustment = (sentiment.emotions.joy || 0) * 25 - 
                             (sentiment.emotions.anger || 0) * 25 -
                             (sentiment.emotions.sadness || 0) * 15;
    
    return Math.max(0, Math.min(100, baseScore + emotionAdjustment));
  }
} 
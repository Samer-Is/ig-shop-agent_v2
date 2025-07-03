import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: 'en' | 'ar' | 'auto';
  duration?: number;
  wordCount?: number;
}

@Injectable()
export class SpeechService {
  private readonly logger = new Logger(SpeechService.name);
  private readonly speechKey: string;
  private readonly speechRegion: string;

  constructor(private configService: ConfigService) {
    this.speechKey = this.configService.get<string>('azure.cognitiveServices.speechKey');
    this.speechRegion = this.configService.get<string>('azure.cognitiveServices.speechRegion');
  }

  /**
   * Transcribe audio file to text using Azure Speech Services
   */
  async transcribeAudio(audioUrl: string, language: 'en' | 'ar' | 'auto' = 'auto'): Promise<TranscriptionResult> {
    try {
      this.logger.log(`Starting audio transcription for: ${audioUrl}`);

      // Step 1: Download audio file
      const audioBuffer = await this.downloadAudioFile(audioUrl);
      
      // Step 2: Determine language code for Azure Speech API
      const languageCode = this.getAzureLanguageCode(language);
      
      // Step 3: Transcribe using Azure Speech Services
      const transcription = await this.callAzureSpeechAPI(audioBuffer, languageCode);
      
      this.logger.log(`Audio transcription completed successfully`);
      return transcription;
    } catch (error) {
      this.logger.error('Error transcribing audio:', error);
      return {
        text: '[Transcription failed - audio message received]',
        confidence: 0,
        language: 'auto'
      };
    }
  }

  /**
   * Download audio file from URL
   */
  private async downloadAudioFile(audioUrl: string): Promise<Buffer> {
    try {
      const response = await axios({
        method: 'GET',
        url: audioUrl,
        responseType: 'arraybuffer',
        timeout: 30000, // 30 seconds timeout
        headers: {
          'User-Agent': 'Instagram-AI-Agent/1.0'
        }
      });

      if (response.status !== 200) {
        throw new Error(`Failed to download audio: HTTP ${response.status}`);
      }

      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error('Error downloading audio file:', error);
      throw new Error('Failed to download audio file for transcription');
    }
  }

  /**
   * Call Azure Speech Services REST API for transcription
   */
  private async callAzureSpeechAPI(audioBuffer: Buffer, languageCode: string): Promise<TranscriptionResult> {
    try {
      const endpoint = `https://${this.speechRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;
      
      const response = await axios({
        method: 'POST',
        url: endpoint,
        data: audioBuffer,
        headers: {
          'Ocp-Apim-Subscription-Key': this.speechKey,
          'Content-Type': 'audio/wav', // Instagram typically sends WAV/OGG format
          'Accept': 'application/json'
        },
        params: {
          language: languageCode,
          format: 'detailed',
          profanityOption: 'masked'
        },
        timeout: 60000 // 60 seconds for transcription
      });

      if (response.status !== 200) {
        throw new Error(`Azure Speech API error: HTTP ${response.status}`);
      }

      const result = response.data;
      
      // Parse Azure Speech API response
      if (result.RecognitionStatus === 'Success' && result.DisplayText) {
        const confidence = result.NBest?.[0]?.Confidence || 0.8;
        const detectedLanguage = this.detectLanguageFromCode(result.NBest?.[0]?.Language || languageCode);
        
        return {
          text: result.DisplayText.trim(),
          confidence: Math.max(0, Math.min(1, confidence)),
          language: detectedLanguage,
          duration: result.Duration ? result.Duration / 10000000 : undefined, // Convert from ticks to seconds
          wordCount: result.DisplayText.split(/\s+/).length
        };
      } else {
        throw new Error(`Speech recognition failed: ${result.RecognitionStatus}`);
      }
    } catch (error) {
      this.logger.error('Error calling Azure Speech API:', error);
      throw error;
    }
  }

  /**
   * Get Azure Speech Services language code
   */
  private getAzureLanguageCode(language: 'en' | 'ar' | 'auto'): string {
    switch (language) {
      case 'en':
        return 'en-US';
      case 'ar':
        return 'ar-JO'; // Jordanian Arabic as specified in requirements
      case 'auto':
      default:
        return 'en-US'; // Default to English, Azure will auto-detect if possible
    }
  }

  /**
   * Detect language from Azure language code
   */
  private detectLanguageFromCode(languageCode: string): 'en' | 'ar' | 'auto' {
    if (languageCode.startsWith('ar')) {
      return 'ar';
    } else if (languageCode.startsWith('en')) {
      return 'en';
    } else {
      return 'auto';
    }
  }

  /**
   * Check if audio transcription is enabled for merchant
   */
  async isTranscriptionEnabled(merchantId: string): Promise<boolean> {
    // This could be enhanced to check merchant subscription tier
    // For now, return true as basic feature
    return true;
  }

  /**
   * Get supported audio formats
   */
  getSupportedFormats(): string[] {
    return [
      'audio/wav',
      'audio/ogg',
      'audio/mp3',
      'audio/mp4',
      'audio/aac',
      'audio/flac'
    ];
  }

  /**
   * Validate audio file format and size
   */
  async validateAudioFile(audioUrl: string): Promise<{
    isValid: boolean;
    reason?: string;
    estimatedSize?: number;
  }> {
    try {
      // Get file headers to check size and type
      const headResponse = await axios({
        method: 'HEAD',
        url: audioUrl,
        timeout: 10000
      });

      const contentType = headResponse.headers['content-type'];
      const contentLength = parseInt(headResponse.headers['content-length'] || '0');

      // Check file type
      if (contentType && !this.getSupportedFormats().includes(contentType)) {
        return {
          isValid: false,
          reason: `Unsupported audio format: ${contentType}`,
          estimatedSize: contentLength
        };
      }

      // Check file size (limit to 25MB)
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (contentLength > maxSize) {
        return {
          isValid: false,
          reason: `Audio file too large: ${(contentLength / 1024 / 1024).toFixed(2)}MB (max 25MB)`,
          estimatedSize: contentLength
        };
      }

      return {
        isValid: true,
        estimatedSize: contentLength
      };
    } catch (error) {
      this.logger.warn('Could not validate audio file:', error);
      return {
        isValid: true, // Allow transcription attempt even if validation fails
        reason: 'Could not validate file'
      };
    }
  }

  /**
   * Get transcription cost estimate (for future billing implementation)
   */
  getTranscriptionCost(durationSeconds: number): number {
    // Azure Speech Services pricing: approximately $1 per hour
    const pricePerSecond = 1.0 / 3600; // $1 per hour = ~$0.000278 per second
    return Math.max(0.01, durationSeconds * pricePerSecond); // Minimum 1 cent
  }
} 
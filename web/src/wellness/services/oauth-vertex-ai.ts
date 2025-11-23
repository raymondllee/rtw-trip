// OAuth-based Vertex AI service for direct browser integration
// This service uses Google OAuth to authenticate and call Vertex AI directly

import { VERTEX_AI_CONFIG } from '../config/vertex-ai';

export interface WellnessResponse {
  question: string;
  response: string;
  ring: string;
  dimension: string;
}

export interface SummarizationRequest {
  responses: WellnessResponse[];
  ringName: string;
  dimensionName: string;
  maxLength?: number;
}

export interface SummarizationResult {
  summary: string;
  confidence: number;
  source: 'ai' | 'fallback';
}

export class OAuthVertexAIService {
  private projectId: string;
  private location: string;
  private model: string;
  private oauthClientId: string;
  private oauthClientSecret: string;
  private accessToken: string | null = null;

  constructor() {
    this.projectId = VERTEX_AI_CONFIG.projectId;
    this.location = VERTEX_AI_CONFIG.location;
    this.model = VERTEX_AI_CONFIG.model;
    this.oauthClientId = VERTEX_AI_CONFIG.oauthClientId;
    this.oauthClientSecret = VERTEX_AI_CONFIG.oauthClientSecret;
  }

  /**
   * Main method to summarize wellness responses using Vertex AI
   */
  async summarizeWellnessResponses(request: SummarizationRequest): Promise<SummarizationResult> {
    try {
      // Ensure we have OAuth credentials
      if (!this.oauthClientId || !this.oauthClientSecret) {
        throw new Error('OAuth client credentials not configured');
      }

      // Get or refresh access token
      await this.ensureAccessToken();

      // Create the prompt for Gemini
      const prompt = this.createSummarizationPrompt(request);
      console.log(`Attempting AI summarization for ${request.ringName} - ${request.dimensionName}`);
      console.log('Prompt:', prompt);
      
      // Call Vertex AI directly
      const summary = await this.callVertexAI(prompt, request.maxLength || 120);
      
      console.log(`AI summary successful for ${request.ringName} - ${request.dimensionName}:`, summary);
      return {
        summary,
        confidence: 0.9,
        source: 'ai'
      };
    } catch (error) {
      console.error(`Error summarizing ${request.ringName} - ${request.dimensionName}:`, error);
      // Fallback to rule-based summarization
      const fallbackSummary = this.fallbackSummarization(request.responses, request.ringName);
      console.log(`Using fallback for ${request.ringName} - ${request.dimensionName}:`, fallbackSummary);
      return {
        summary: fallbackSummary,
        confidence: 0.7,
        source: 'fallback'
      };
    }
  }

  /**
   * Ensure we have a valid access token for API calls
   */
  private async ensureAccessToken(): Promise<void> {
    if (this.accessToken && !this.isTokenExpired()) {
      return;
    }

    // Check if we have a stored token
    const storedToken = localStorage.getItem('google_oauth_token');
    if (storedToken) {
      const tokenData = JSON.parse(storedToken);
      if (tokenData.expires_at > Date.now()) {
        this.accessToken = tokenData.access_token;
        return;
      }
    }

    // Need to authenticate
    await this.authenticate();
  }

  /**
   * Authenticate using OAuth 2.0
   */
  private async authenticate(): Promise<void> {
    // Check if we're in the OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      // Exchange authorization code for access token
      await this.exchangeCodeForToken(code);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Redirect to Google OAuth
      this.redirectToOAuth();
    }
  }

  /**
   * Redirect user to Google OAuth consent screen
   */
  private redirectToOAuth(): void {
    // Use the base origin without pathname for OAuth redirect
    const redirectUri = window.location.origin;
    const scope = 'https://www.googleapis.com/auth/cloud-platform';
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${this.oauthClientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent`;

    window.location.href = authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string): Promise<void> {
    try {
      const redirectUri = window.location.origin;
      
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.oauthClientId,
          client_secret: this.oauthClientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const tokenData = await response.json();
      
      // Store token with expiration
      const tokenInfo = {
        access_token: tokenData.access_token,
        expires_at: Date.now() + (tokenData.expires_in * 1000),
        refresh_token: tokenData.refresh_token,
      };
      
      localStorage.setItem('google_oauth_token', JSON.stringify(tokenInfo));
      this.accessToken = tokenData.access_token;
      
    } catch (error) {
      console.error('Token exchange error:', error);
      throw error;
    }
  }

  /**
   * Check if the current token is expired
   */
  private isTokenExpired(): boolean {
    const storedToken = localStorage.getItem('google_oauth_token');
    if (!storedToken) return true;
    
    const tokenData = JSON.parse(storedToken);
    return tokenData.expires_at <= Date.now();
  }

  /**
   * Call Vertex AI Generative AI API for Gemini models
   */
  private async callVertexAI(prompt: string, maxTokens: number): Promise<string> {
    console.log('=== CALLING VERTEX AI ===');
    console.log('Access token available:', !!this.accessToken);
    console.log('Project ID:', this.projectId);
    console.log('Location:', this.location);
    console.log('Model:', this.model);
    console.log('Max tokens:', maxTokens);
    
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    // Use the Generative AI API endpoint for Gemini models
    const endpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.model}:generateContent`;
    console.log('API Endpoint:', endpoint);

    const requestBody = {
      contents: [
        {
          role: "user", // Specify that this is a user message
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: VERTEX_AI_CONFIG.generationConfig.temperature,
        topP: VERTEX_AI_CONFIG.generationConfig.topP,
        topK: VERTEX_AI_CONFIG.generationConfig.topK,
        // Remove maxOutputTokens to see full response
        // maxOutputTokens: maxTokens,
      },
    };
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(Array.from(response.headers as any)));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Response not OK. Error text:', errorText);
      throw new Error(`Vertex AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Add detailed debugging to see exactly what we're getting back
    console.log('=== VERTEX AI RESPONSE DEBUG ===');
    console.log('Full response:', JSON.stringify(data, null, 2));
    console.log('Response keys:', Object.keys(data));
    
    // Check if we have candidates
    if (data.candidates) {
      console.log('Candidates array length:', data.candidates.length);
      console.log('First candidate:', data.candidates[0]);
    }
    
    // Extract the generated text from Gemini API response
    // The structure is: data.candidates[0].content.parts[0].text
    const candidate = data.candidates?.[0];
    if (!candidate) {
      console.error('No candidates found in response');
      throw new Error('No candidate in response');
    }
    
    console.log('Candidate structure:', candidate);
    console.log('Candidate keys:', Object.keys(candidate));
    
    const content = candidate.content;
    if (!content) {
      console.error('No content in candidate');
      throw new Error('No content in candidate');
    }
    
    console.log('Content structure:', content);
    console.log('Content keys:', Object.keys(content));
    
    const part = content.parts?.[0];
    if (!part || !part.text) {
      console.error('No text in content parts. Part structure:', part);
      throw new Error('No text in content parts');
    }
    
    const summary = part.text;
    console.log('Successfully extracted summary:', summary);
    console.log('=== END DEBUG ===');

    console.log('Final summary:', summary);
    return summary.trim();
  }

  /**
   * Create a specialized prompt for wellness response summarization
   */
  private createSummarizationPrompt(request: SummarizationRequest): string {
    const { responses, ringName, dimensionName, maxLength = 120 } = request;
    
    const ringContext = this.getRingContext(ringName);
    const dimensionContext = this.getDimensionContext(dimensionName);
    
    // Prompt with word limit instruction but no token constraints
    return `You are a wellness coach helping to create concise summaries for a wellness wheel visualization.

CONTEXT:
- Ring: ${ringName} - ${ringContext}
- Dimension: ${dimensionName} - ${dimensionContext}
- Target: Create a summary that fits in a small wheel segment

RESPONSES TO SUMMARIZE:
${responses.map((r, i) => `${i + 1}. ${r.response}`).join('\n')}

INSTRUCTIONS:
1. You MUST respond in LESS THAN 25 WORDS
2. Create a single, coherent summary that captures the key insights
3. Use clear, meaningful language
4. Focus on the most important information for this ring/dimension combination
5. Make it actionable and insightful for the user
6. Be concise but impactful

SUMMARY:`;
  }

  /**
   * Get context about what each ring represents
   */
  private getRingContext(ringName: string): string {
    const contexts: Record<string, string> = {
      'EMPIRICAL': 'Current state, facts, and measurable data about the person',
      'SITUATIONAL': 'Recent changes, current circumstances, and what\'s happening now',
      'ASPIRATIONAL': 'Goals, future vision, and what the person wants to achieve'
    };
    return contexts[ringName] || 'Wellness dimension';
  }

  /**
   * Get context about what each dimension represents
   */
  private getDimensionContext(dimensionName: string): string {
    const contexts: Record<string, string> = {
      'SPIRITUAL': 'Values, beliefs, purpose, and what gives life meaning',
      'PRACTICAL': 'Skills, work, and how things get accomplished',
      'RELATIONAL': 'Relationships with family, friends, and community',
      'MENTAL': 'Thoughts, emotions, and mental wellbeing',
      'PHYSICAL': 'Health, fitness, and body care',
      'BEHAVIORAL': 'Daily habits, routines, and time usage',
      'FINANCIAL': 'Money, resources, and financial situation'
    };
    return contexts[dimensionName] || 'Wellness aspect';
  }

  /**
   * Fallback summarization if AI fails
   */
  private fallbackSummarization(responses: WellnessResponse[], ringName: string): string {
    // Simple fallback that extracts key information
    const allText = responses.map(r => r.response).join(' ');
    
    // Extract key metrics and facts
    const keyInfo: string[] = [];
    
    // Look for financial information
    const money = allText.match(/\$[\d,]+|\d+[k]?[m]?/g);
    if (money) keyInfo.push(money.slice(0, 2).join(', '));
    
    // Look for time periods
    const time = allText.match(/\d+\s*(?:years?|yrs?|months?|days?)/g);
    if (time) keyInfo.push(time[0]);
    
    // Look for numbers/percentages
    const numbers = allText.match(/\d+%?/g);
    if (numbers && numbers.length > 0) keyInfo.push(numbers.slice(0, 2).join(', '));
    
    // If we have key info, use it
    if (keyInfo.length > 0) {
      return keyInfo.join('. ');
    }
    
    // Otherwise, use the first meaningful sentence
    const sentences = allText.split('.');
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 10 && trimmed.length < 80) {
        return trimmed;
      }
    }
    
    return 'No summary available';
  }
}

// Export a singleton instance
export const oauthVertexAIService = new OAuthVertexAIService();


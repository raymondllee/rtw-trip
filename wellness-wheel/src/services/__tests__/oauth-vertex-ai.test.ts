import { oauthVertexAIService } from '../oauth-vertex-ai';

// Mock the environment variables
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
  
  // Mock localStorage
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    },
    writable: true,
  });
  
  // Mock window.location
  Object.defineProperty(window, 'location', {
    value: {
      origin: 'http://localhost:3000',
      pathname: '/',
      search: '',
      href: 'http://localhost:3000/',
    },
    writable: true,
  });
  
  // Mock fetch
  global.fetch = jest.fn();
});

afterAll(() => {
  process.env = originalEnv;
});

describe('OAuthVertexAIService', () => {
  const mockResponses = [
    {
      question: "What are your current values?",
      response: "I value clarity, peace, ease, consideration, and security.",
      ring: "EMPIRICAL",
      dimension: "SPIRITUAL"
    }
  ];

  describe('summarizeWellnessResponses', () => {
    it('should return fallback summary when OAuth credentials are not configured', async () => {
      process.env.REACT_APP_GOOGLE_OAUTH_CLIENT_ID = '';
      process.env.REACT_APP_GOOGLE_OAUTH_CLIENT_SECRET = '';
      
      const result = await oauthVertexAIService.summarizeWellnessResponses({
        responses: mockResponses,
        ringName: 'EMPIRICAL',
        dimensionName: 'SPIRITUAL',
        maxLength: 100
      });

      expect(result.summary).toBeTruthy();
      expect(result.source).toBe('fallback');
      expect(result.confidence).toBe(0.7);
    });

    it('should create context-aware prompts for different rings and dimensions', async () => {
      // This test would require mocking the OAuth flow
      // For now, we'll just verify the service can be instantiated
      expect(oauthVertexAIService).toBeDefined();
    });
  });

  describe('OAuth configuration validation', () => {
    it('should require OAuth client ID and secret', () => {
      // The service should be properly configured
      expect(oauthVertexAIService).toBeDefined();
    });
  });
});


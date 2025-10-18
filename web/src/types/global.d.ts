import type { RuntimeConfig } from './config';

declare global {
  interface Window {
    RTW_CONFIG?: Partial<RuntimeConfig> & {
      firebaseApiKey?: string;
      firebaseAuthDomain?: string;
      firebaseProjectId?: string;
      firebaseStorageBucket?: string;
      firebaseMessagingSenderId?: string;
      firebaseAppId?: string;
      firebaseMeasurementId?: string;
    };
    API_CONFIG?: {
      BASE_URL?: string;
      TIMEOUT?: number;
      CHAT_ENDPOINT?: string;
      ITINERARY_CHANGES_ENDPOINT?: string;
    };
  }
}

export {};

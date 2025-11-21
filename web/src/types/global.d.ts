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
    transportSegmentManager?: {
      segments: any[];
      loadSegments: (scenarioId: string) => Promise<any[]>;
      syncSegments: (scenarioId: string, locations: any[]) => Promise<any>;
      getActiveCost: (segment: any) => number;
      getTotalCost: () => number;
    };
  }
}

export {};

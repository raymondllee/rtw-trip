export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
}

export interface ApiConfig {
  baseUrl: string;
  timeout?: number;
  chatEndpoint?: string;
  itineraryChangesEndpoint?: string;
}

export interface RuntimeConfig {
  apiBaseUrl: string;
  googleMapsApiKey: string;
  googleOAuthClientId?: string;
  googleCloudProjectId?: string;
  googleCloudLocation?: string;
  firebase: FirebaseConfig;
  endpoints: {
    chat: string;
    itineraryChanges: string;
  };
}

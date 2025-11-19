import '../styles.css';
import '../cost-styles.css';

import '../sidebar-resize.js';
import '../transport-segment-manager.js';
import '../cost-tracker.js';
import '../cost-ui.js';
import '../cost-comparison.js';
import '../cost-utils-standalone.js';
import '../place-id-migration.js';

import { getRuntimeConfig } from './config';
import { initMapApp } from './app/initMapApp';
import './chat/travelConciergeChat';

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-source="google-maps"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', (err) => reject(err));
      return;
    }

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.dataset.source = 'google-maps';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places,geometry&loading=async`;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', (err) => reject(err));
    document.head.appendChild(script);
  });
}

async function bootstrap() {
  try {
    const { googleMapsApiKey } = getRuntimeConfig();
    await loadGoogleMaps(googleMapsApiKey);
    await initMapApp();
  } catch (error) {
    console.error('Failed to initialize application', error);
    alert('Failed to initialize map: ' + (error instanceof Error ? error.message : String(error)));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  void bootstrap();
}

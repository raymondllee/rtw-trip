import { initMapApp } from './src/app/initMapApp';

const start = () => {
  if (!window.google || !window.google.maps) {
    setTimeout(start, 50);
    return;
  }

  initMapApp().catch((err) => {
    console.error(err);
    alert(`Failed to initialize map: ${err.message}`);
  });
};

window.addEventListener('load', start);

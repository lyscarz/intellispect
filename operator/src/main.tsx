import { createRoot } from 'react-dom/client';

// Framework7 + icon fonts + Leaflet, then our overrides.
import 'framework7/css/bundle';
import 'framework7-icons/css/framework7-icons.css';
import 'leaflet/dist/leaflet.css';
import './css/app.css';

import { resolveInitialDark } from './lib/theme';
import App from './App';

// Add the dark class before React renders to avoid a light→dark flash.
if (resolveInitialDark()) {
  document.documentElement.classList.add('dark');
}

const container = document.getElementById('app');
if (container) {
  createRoot(container).render(<App />);
}

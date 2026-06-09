import type { MetadataRoute } from 'next';

// Web App Manifest for the /m mobile inspection PWA.
// Icons are intentionally omitted for the PoC — add 192x192 + 512x512 PNGs to
// /public and reference them here before shipping; without icons the
// "Install" prompt is suppressed on most browsers.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Yo Inspect',
    short_name: 'Yo Inspect',
    description: 'Run fleet inspections in the field.',
    start_url: '/m',
    scope: '/m',
    display: 'standalone',
    background_color: '#f1f5f9',
    theme_color: '#0f172a',
    orientation: 'portrait',
    icons: [],
  };
}

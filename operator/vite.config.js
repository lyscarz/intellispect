import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Served under /app/ (the desktop app owns "/"). All asset URLs are base-relative.
export default defineConfig({
  base: '/app/',
  plugins: [
    react(),
    VitePWA({
      // 'prompt' (not 'autoUpdate'): a new SW waits; ReloadPrompt asks the user.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.svg'],
      manifest: {
        name: 'Operator',
        short_name: 'Operator',
        description: 'Operator companion — fleet map, sessions, inbox',
        lang: 'en',
        theme_color: '#0f172a',
        background_color: '#f4f5f7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/app/',
        scope: '/app/',
        icons: [
          { src: 'icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/app/index.html',
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: true,
    port: 5180,
    strictPort: true,
  },
});

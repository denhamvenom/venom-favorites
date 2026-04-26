/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
          if (id.includes('/node_modules/date-fns')) {
            return 'date-vendor';
          }
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['venom-logo.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Worlds Watcher · FRC 8044',
        short_name: 'Worlds',
        description: 'FRC 8044 Denham Venom — Worlds Match Watcher',
        start_url: '/',
        display: 'standalone',
        background_color: '#1A1A1A',
        theme_color: '#461D7C',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Exclude fixture JSON chunks from the precache — they only matter in
        // demo mode and would otherwise bloat the initial SW install.
        globIgnores: ['**/assets/{ARCHIMEDES,CURIE,DALY,GALILEO,HOPPER,JOHNSON,MILSTEIN,NEWTON}-*.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/frc-api\.firstinspires\.org\/v3\.0\/\d{4}\/(events|teams)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'frc-api-static',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 12 },
            },
          },
          {
            urlPattern: /^https:\/\/frc-api\.firstinspires\.org\/v3\.0\/\d{4}\/(schedule|matches|rankings|alliances)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'frc-api-live',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 },
              networkTimeoutSeconds: 4,
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});

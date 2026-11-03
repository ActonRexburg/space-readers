import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Base URL for GitHub Pages deployment
  // Set VITE_BASE_URL=/space-readers/ when building for GitHub Pages
  base: process.env.VITE_BASE_URL || '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'robots.txt', 'rocket.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Space Readers',
        short_name: 'SpaceReaders',
        description: 'A space-mission-themed gamified reading program for early readers',
        theme_color: '#1e1b4b',
        background_color: '#0f0a1a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Include core app assets in precache (not videos - too large)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,jpg}'],
        // Exclude large video files from precache
        globIgnores: ['**/*.mp4', '**/*.webm', '**/*.mp3'],
        // Force new service worker to take control immediately
        skipWaiting: true,
        clientsClaim: true,
        // Navigation fallback for SPA routing. Never serve index.html for
        // media/JSON — a browser GET of /audio/voice/manifest.json was
        // returning the app shell (Workbox navigateFallback).
        navigateFallback: 'index.html',
        navigateFallbackAllowlist: [/^(?!\/__).*/],
        navigateFallbackDenylist: [
          /\/audio\//,
          /\/videos?\//,
          /\/zib-clips\//,
          /\.(?:json|mp3|opus|webm|mp4|png|jpe?g|gif|svg|ico|woff2?)$/i
        ],
        runtimeCaching: [
          // Cache Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Video files: Use NetworkOnly to avoid SW breaking Range requests
          // The SW was intercepting requests but not properly handling Range headers,
          // which caused videos to buffer at 0%. Bypassing SW for video is simpler
          // and more reliable than trying to make Range requests work through SW.
          {
            urlPattern: /\.(mp4|webm)$/i,
            handler: 'NetworkOnly'
          },
          // Voice manifest must stay JSON (never the HTML app shell).
          {
            urlPattern: /\/audio\/.*\.json$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'voice-manifest-cache',
              expiration: {
                maxEntries: 4,
                maxAgeSeconds: 60 * 60 * 24 * 7
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Cache audio files similarly
          {
            urlPattern: /\.mp3$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Cache poster images
          {
            urlPattern: /zib-clips\/poster\/.*\.jpg$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'poster-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        // Keep [speak] clip / fallback-tts logs on production Chromebooks.
        // console.debug is hidden in default DevTools (and some minifiers
        // treat it as droppable); speak() uses console.info instead.
        drop_console: false
      }
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor';
            }
            if (id.includes('zustand')) {
              return 'state';
            }
          }
        }
      }
    }
  }
})

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
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'robots.txt', 'rocket.svg'],
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
        // Navigation fallback for SPA routing
        navigateFallback: 'index.html',
        navigateFallbackAllowlist: [/^(?!\/__).*/],
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
          // Cache video files with NetworkFirst strategy (show latest, fallback to cache)
          {
            urlPattern: /\.(mp4|webm)$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'video-cache',
              expiration: {
                maxEntries: 40,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              rangeRequests: true
            }
          },
          // Cache audio files similarly
          {
            urlPattern: /\.mp3$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'audio-cache',
              expiration: {
                maxEntries: 20,
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
        drop_console: true
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

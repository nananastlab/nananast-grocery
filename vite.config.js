import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// En local : base = '/'  |  Sur GitHub Pages : base = '/nom-du-repo/'
const base = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['GroceryICON.png'],
      manifest: {
        name: 'Nananast Grocery',
        short_name: 'Grocery',
        description: 'Gestion de recettes et liste de courses',
        theme_color: '#07b27b',
        background_color: '#f9fafb',
        display: 'standalone',
        start_url: base,
        icons: [
          { src: 'GroceryICON.png', sizes: '192x192', type: 'image/png' },
          { src: 'GroceryICON.png', sizes: '512x512', type: 'image/png' },
          { src: 'GroceryICON.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/oxqppowhhrfkfficcmnu\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }
            }
          }
        ]
      }
    })
  ]
})

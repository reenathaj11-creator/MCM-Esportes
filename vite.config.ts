import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'MCM Esportes',
        short_name: 'MCM Esportes',
        description: 'Capture suas melhores jogadas com a câmera 70mai',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        background_color: '#030712',
        theme_color: '#030712',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache completo: o app inteiro funciona offline no Wi-Fi da câmera
        globPatterns: ['**/*.{js,css,html,svg,png,ico,txt,woff2}'],
        navigateFallback: '/index.html',
        // Câmera e Supabase NÃO passam pelo cache (sempre rede)
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
})

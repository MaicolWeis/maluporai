import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Webapp instalável (PWA). O service worker só pré-carrega a casca do app
    // (HTML/JS/CSS/ícones). Respostas da /api NUNCA são cacheadas: são dados
    // pessoais autenticados e a API responde com Cache-Control: no-store.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'maluporai',
        short_name: 'maluporai',
        description: 'Gestão de viagens em grupo: inscrições, pagamentos e despesas.',
        lang: 'pt-BR',
        start_url: '/dashboard',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F1F5F9',
        theme_color: '#1C69D4',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Viagens', url: '/viagens', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'Clientes', url: '/clientes', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'fontes', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
});

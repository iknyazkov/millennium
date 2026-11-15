import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves at /millennium/, not domain root. Drop this line
  // if the site ever moves to a custom domain.
  base: '/millennium/',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Millennium',
        short_name: 'Millennium',
        description: 'Фото-редактор на пресетах — фото не покидают устройство',
        lang: 'ru',
        display: 'standalone',
        background_color: '#111111',
        theme_color: '#111111',
        icons: [
          // No leading slash: resolved relative to base (works on subpath)
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})

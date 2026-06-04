import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'remove-crossorigin-for-capacitor',
      transformIndexHtml(html) {
        // Capacitor 本地 scheme handler 不支持 CORS
        // crossorigin 会导致 JS/CSS 加载失败 → 白屏
        return html.replace(/\s+crossorigin\b/g, '');
      },
    },
  ],
  envPrefix: 'VITE_',
  build: {
    assetsDir: 'assets',
  },
  server: {
    host: true,
    port: 5173,
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
// @ts-expect-error local ESM stream helper (no package types)
import { createExplainStreamMiddleware } from './scripts/arkExplainStream.mjs';

export default defineConfig(({ mode }) => {
  // 加载 .env 中的非 VITE_ 前缀变量（仅 server 端可用）
  const env = loadEnv(mode, process.cwd(), '');
  const arkKey = env.ARK_API_KEY || '';

  return {
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
      // 开发环境 ARK 鉴权代理中间件：注入 ARK_API_KEY → Authorization 头
      {
        name: 'ark-auth-injector',
        configureServer(server) {
          server.middlewares.use('/api/ark', (req, _res, next) => {
            if (arkKey && req.headers) {
              req.headers['authorization'] = `Bearer ${arkKey}`;
            }
            next();
          });
          // AI讲解 SSE：边生成边推送
          server.middlewares.use(createExplainStreamMiddleware(arkKey));
        },
        configurePreviewServer(server) {
          server.middlewares.use(createExplainStreamMiddleware(arkKey));
        },
      },
    ],
    envPrefix: 'VITE_',
    assetsInclude: ['**/*.gmdl', '**/*.wasm'],
    optimizeDeps: {
      exclude: ['garu-ko'],
    },
    build: {
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('printFontBase64.generated')) {
              return 'print-fonts';
            }
          },
        },
      },
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        // ARK Chat 代理（开发环境避免跨域 + 隐藏 API Key）
        '/api/ark': {
          target: 'https://ark.cn-beijing.volces.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ark/, ''),
        },
      },
    },
  };
});

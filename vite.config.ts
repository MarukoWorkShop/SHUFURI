import { defineConfig, loadEnv, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

function createArkProxy(mode: string): ProxyOptions {
  return {
    target: 'https://ark.cn-beijing.volces.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/ark/, ''),
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        const env = loadEnv(mode, process.cwd(), '');
        const key = env.ARK_API_KEY || env.VITE_ARK_API_KEY;
        if (key) {
          proxyReq.setHeader('Authorization', `Bearer ${key}`);
        } else {
          console.warn('[vite proxy] 警告：未设置 ARK_API_KEY 或 VITE_ARK_API_KEY');
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const arkProxy = createArkProxy(mode);

  return {
    plugins: [react()],
    envPrefix: ['VITE_', 'ARK_'],
    server: {
      proxy: {
        '/api/ark': arkProxy,
      },
    },
    preview: {
      proxy: {
        '/api/ark': arkProxy,
      },
    },
  };
});

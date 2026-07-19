import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 手机联调 AI 流式：构建前设 CAP_SERVER_URL=http://<电脑局域网IP>:5173
 * 并保持 npm run dev，则 App 与电脑共用 Vite /api/explain-stream。
 * 正式包勿设 CAP_SERVER_URL，改配 VITE_EXPLAIN_STREAM_URL（CloudBase HTTP 云函数）。
 */
const liveUrl = (process.env.CAP_SERVER_URL || '').trim();

const config: CapacitorConfig = {
  appId: 'com.shufuri',
  appName: 'Japanese Kana',
  webDir: 'dist',
  server: {
    iosScheme: 'capacitor',
    cleartext: true,
    ...(liveUrl
      ? {
          url: liveUrl,
          cleartext: true,
        }
      : {}),
  },
  ios: {
    scrollEnabled: false,
    contentInset: 'never',
    allowsLinkPreview: false,
    preferredContentMode: 'mobile',
  },
};

export default config;

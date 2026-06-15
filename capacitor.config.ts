import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shufuri',
  appName: 'Japanese Kana',
  webDir: 'dist',
  server: {
    // 启用 Capacitor 内置 HTTP server，正确处理 ES module 的 MIME 类型
    iosScheme: 'capacitor',
    cleartext: true,
  },
  ios: {
    // 禁用 WebView 弹簧效果
    scrollEnabled: false,
    // 禁用 WebView 弹性过滚（iOS 橡皮筋效果）
    contentInset: 'never',
    // 禁止长按链接预览 / 系统菜单
    allowsLinkPreview: false,
    // 启用安全区域适配
    preferredContentMode: 'mobile',
  },
};

export default config;

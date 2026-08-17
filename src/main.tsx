import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { getAppSettings } from './services/appSettings';
import { applyColorTheme } from './utils/applyColorTheme';
import { hideAppBootLoader } from './utils/hideAppBootLoader';
import './index.css';

/** 浏览器与原生壳均保持 index.html 的 user-scalable=no，禁止点击/双击放大 */
applyColorTheme(getAppSettings().colorTheme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 尽早收起 boot：勿等 rAF（慢设备上易出现「内容已出仍转圈」）
hideAppBootLoader();
// 再补一帧，覆盖 StrictMode 双挂 / 首帧样式变量未就绪
requestAnimationFrame(() => hideAppBootLoader());

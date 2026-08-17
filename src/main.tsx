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

// React 已挂上即收起 boot（不等待首页 effect），减少「有内容但仍转圈」错觉
requestAnimationFrame(() => hideAppBootLoader());

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { getAppSettings } from './services/appSettings';
import { applyColorTheme } from './utils/applyColorTheme';
import './index.css';

/** 浏览器与原生壳均保持 index.html 的 user-scalable=no，禁止点击/双击放大 */
applyColorTheme(getAppSettings().colorTheme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

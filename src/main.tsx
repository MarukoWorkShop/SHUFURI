import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import { getAppSettings } from './services/appSettings';
import { applyColorTheme } from './utils/applyColorTheme';
import './index.css';

/** 浏览器允许缩放；原生壳保持 index.html 的 user-scalable=no */
if (!Capacitor.isNativePlatform()) {
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    meta.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, viewport-fit=cover',
    );
  }
}

applyColorTheme(getAppSettings().colorTheme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

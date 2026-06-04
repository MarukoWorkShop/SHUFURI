import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { getAppSettings } from './services/appSettings';
import { applyColorTheme } from './utils/applyColorTheme';
import './index.css';

applyColorTheme(getAppSettings().colorTheme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

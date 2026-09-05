import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './theme/ThemeContext';
import { registerServiceWorker } from './utils/pwaHelper';
import './styles/app.css';

// Daftarkan PWA Service Worker untuk auto-update instan dan Web Push Notifications
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);

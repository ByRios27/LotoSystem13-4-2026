import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { db } from './firebase';
import { doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';

// Test connection to Firestore
async function testConnection() {
  try {
    // Try to get a non-existent doc to test connectivity
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
    // Ignore other errors like "permission denied" for this specific test doc
  }
}

testConnection();

if ('serviceWorker' in navigator) {
  let hasRefreshedForNewSw = false;
  console.info('[LottoPro] build_loaded', {
    buildId: __APP_BUILD_ID__,
    timestamp: new Date().toISOString(),
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hasRefreshedForNewSw) return;
    hasRefreshedForNewSw = true;
    console.info('[LottoPro] sw_controller_changed_reloading', {
      buildId: __APP_BUILD_ID__,
      timestamp: new Date().toISOString(),
    });
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.info('[LottoPro] sw_registered', {
          scope: registration.scope,
          hasWaiting: !!registration.waiting,
          buildId: __APP_BUILD_ID__,
        });

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            console.info('[LottoPro] sw_update_state', {
              state: installing.state,
              hasController: !!navigator.serviceWorker.controller,
              buildId: __APP_BUILD_ID__,
            });

            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              installing.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        setInterval(() => {
          registration.update().catch((err) => {
            console.error('[LottoPro] sw_update_check_failed', err);
          });
        }, 60 * 1000);
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

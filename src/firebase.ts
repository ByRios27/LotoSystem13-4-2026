import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
} from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
enableIndexedDbPersistence(db).catch((err) => {
  // `failed-precondition` can happen with multiple tabs; `unimplemented` on unsupported browsers.
  if (err?.code !== 'failed-precondition' && err?.code !== 'unimplemented') {
    console.error('Firestore persistence error:', err);
  }
});
export const auth = initializeAuth(app, {
  // Try durable IndexedDB first, then localStorage as fallback.
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});

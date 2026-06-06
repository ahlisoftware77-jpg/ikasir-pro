import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Default configuration from environment variables
const defaultFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Check for dynamic override in localStorage (set by SuperAdmin)
const getDynamicConfig = () => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem('infra_config_fb');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validate that it's a complete config
      if (parsed.apiKey && parsed.projectId) return parsed;
    }
  } catch (e) {
    console.error("Failed to parse dynamic firebase config", e);
  }
  return null;
};


// Initialize Primary App for Central Authentication
const primaryApp = !getApps().find(a => a.name === '[DEFAULT]') 
  ? initializeApp(defaultFirebaseConfig)
  : getApp();

// Check for dynamic override (Data Tenancy)
const dynamicConfig = getDynamicConfig();
const dataConfig = dynamicConfig || defaultFirebaseConfig;

// Initialize Data App (can be same as primary or separate)
// If separate project, we give it a name to avoid conflict
const dataApp = dynamicConfig && dynamicConfig.projectId !== defaultFirebaseConfig.projectId
  ? (getApps().find(a => a.name === 'DataApp') || initializeApp(dataConfig, 'DataApp'))
  : primaryApp;

export const activeFirebaseConfig = dataConfig;
export const isDynamicConfig = !!dynamicConfig;

// Export AUTH from PRIMARY project (Central Auth - Opsi B)
export const auth = getAuth(primaryApp);

// Export DB and STORAGE from DATA project (Dynamic Tenancy)
export const db: Firestore = initializeFirestore(dataApp, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  experimentalForceLongPolling: true // Jauh lebih stabil untuk jaringan selular/mobiles agar tidak telat notifikasi
});

// HARUS SELALU MENUJU KE PRIMARY DB UNTUK AUTH & SUBSCRIPTION
export const primaryDb: Firestore = dataApp === primaryApp ? db : getFirestore(primaryApp);

export const storage = getStorage(dataApp);

export default primaryApp;


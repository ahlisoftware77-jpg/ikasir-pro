import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, CACHE_SIZE_UNLIMITED, Firestore, getFirestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAzmifpFOz0asKVDjLJDXVAvfTPNmOEiUw',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'kasir-3d12b.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'kasir-3d12b',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'kasir-3d12b.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '468553316772',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:468553316772:web:fc5251a1ac9b842d6f6931'
};

// Initialize Primary App for Authentication
const primaryApp = !getApps().find(a => a.name === '[DEFAULT]') 
  ? initializeApp(firebaseConfig) 
  : getApp();

// Configure React Native Persistence
let initializedAuth: Auth;
try {
  initializedAuth = initializeAuth(primaryApp, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (error) {
  initializedAuth = getAuth(primaryApp);
}
export const auth = initializedAuth;

// Dynamic Data App references
let dataApp: FirebaseApp = primaryApp;

// _primaryFirestore is a CONSTANT reference to the MAIN project's DB.
// It NEVER changes — used for reading 'stores' collection and cross-tenant lookups.
let _primaryFirestore: Firestore;
try {
  _primaryFirestore = initializeFirestore(primaryApp, {
    localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED })
  });
} catch {
  _primaryFirestore = getFirestore(primaryApp);
}

// db can be mutated by initDynamicFirebase to point to a tenant DB
export let db: Firestore = _primaryFirestore;

// primaryDb always resolves back to the MAIN project DB via the constant reference
export const primaryDb: Firestore = _primaryFirestore;

export let storage: FirebaseStorage;
try {
  storage = getStorage(primaryApp);
} catch {
  storage = getStorage(primaryApp);
}

// Function to initialize dynamic Firebase connection based on tenancy
export const initDynamicFirebase = async () => {
  try {
    const saved = await AsyncStorage.getItem('infra_config_fb');
    let config = firebaseConfig;
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.apiKey && parsed.projectId) {
        config = parsed;
      }
    }

    const appName = `DataApp_${config.projectId}`;
    dataApp = config.projectId !== firebaseConfig.projectId
      ? (getApps().find(a => a.name === appName) || initializeApp(config, appName))
      : primaryApp;

    // Only mutate `db` (not primaryDb) to point to the active tenant
    try {
      db = initializeFirestore(dataApp, {
        localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED })
      });
    } catch {
      db = getFirestore(dataApp);
    }

    // Initialize Storage from tenant app
    storage = getStorage(dataApp);
    
    return true;
  } catch (error) {
    console.error("Failed to init dynamic firebase", error);
    return false;
  }
};

// Helper for Federated Queries: get Firestore instance for any tenant config
// Always uses _primaryFirestore as fallback to ensure correct DB lookup
export const getTenantDb = (config: any): Firestore => {
  const projectId = config?.projectId || config?.fb_project_id;
  if (!config || !projectId) return _primaryFirestore;
  
  const appName = `DataApp_${projectId}`;
  let tApp = getApps().find(a => a.name === appName);
  
  if (!tApp) {
    if (projectId === firebaseConfig.projectId) {
      tApp = primaryApp;
    } else {
      // Normalize config keys for initializeApp if it uses fb_ prefix
      const normalizedConfig = {
        apiKey: config.apiKey || config.fb_api_key,
        authDomain: config.authDomain || config.fb_auth_domain,
        projectId: projectId,
        storageBucket: config.storageBucket || config.fb_storage_bucket,
        messagingSenderId: config.messagingSenderId || config.fb_messaging_sender_id,
        appId: config.appId || config.fb_app_id
      };
      tApp = initializeApp(normalizedConfig, appName);
    }
  }

  try {
    return getFirestore(tApp);
  } catch {
    return initializeFirestore(tApp, {});
  }
};

export default primaryApp;

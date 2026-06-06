import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export interface InfraConfig {
  cloudinary_cloud_name: string;
  cloudinary_upload_preset: string;
  fb_api_key?: string;
  fb_auth_domain?: string;
  fb_project_id?: string;
  fb_storage_bucket?: string;
  fb_messaging_sender_id?: string;
  fb_app_id?: string;
}

// Memory cache to avoid excessive Firestore reads
let cachedConfig: InfraConfig | null = null;

export const getInfraConfig = async (forceRefresh = false): Promise<InfraConfig> => {
  if (cachedConfig && !forceRefresh) return cachedConfig;

  try {
    const docRef = doc(db, 'system_settings', 'infrastructure');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      cachedConfig = docSnap.data() as InfraConfig;
    } else {
      // Return defaults if not configured in DB yet
      cachedConfig = {
        cloudinary_cloud_name: 'dkcjfwbvc',
        cloudinary_upload_preset: 'kasirpos'
      };
    }
    return cachedConfig;
  } catch (err) {
    console.error("Error fetching infra config:", err);
    return {
      cloudinary_cloud_name: 'dkcjfwbvc',
      cloudinary_upload_preset: 'kasirpos'
    };
  }
};

// Real-time listener version for React components
export const subscribeToInfraConfig = (callback: (config: InfraConfig) => void) => {
  return onSnapshot(doc(db, 'system_settings', 'infrastructure'), (docSnap) => {
    if (docSnap.exists()) {
      cachedConfig = docSnap.data() as InfraConfig;
      callback(cachedConfig);
    } else {
      const defaults = {
        cloudinary_cloud_name: 'dkcjfwbvc',
        cloudinary_upload_preset: 'kasirpos'
      };
      cachedConfig = defaults;
      callback(defaults);
    }
  });
};

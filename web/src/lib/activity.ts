import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type ActivityAction = 
  | 'LOGIN' 
  | 'LOGOUT' 
  | 'REGISTER_STORE'
  | 'CREATE_PRODUCT' 
  | 'UPDATE_PRODUCT' 
  | 'DELETE_PRODUCT' 
  | 'IMPORT_PRODUCT' 
  | 'ADD_USER'
  | 'EDIT_USER'
  | 'DELETE_USER'
  | 'MANAGE_USER' 
  | 'SETTINGS_CHANGE'
  | 'SECURITY'
  | 'TRANSACTION'
  | 'CHECKOUT'
  | 'UPDATE_PROFILE';

export interface LogEntry {
  userId: string;
  userName: string;
  userEmail: string;
  storeId: string;
  action: ActivityAction;
  description: string;
  metadata?: any;
}

export const logActivity = async (data: LogEntry) => {
  // Defensive check: Ensure we don't log to 'default-store' if we can avoid it
  if (!data.storeId || data.storeId === 'default-store') {
    console.warn('Attempted to log activity with missing or default storeId:', data.action);
    if (data.action !== 'LOGIN' && data.action !== 'REGISTER_STORE') {
       return; // Block potentially leaking logs if not a login or registration event
    }
  }

  try {
    await addDoc(collection(db, 'activity_logs'), {
      ...data,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
};

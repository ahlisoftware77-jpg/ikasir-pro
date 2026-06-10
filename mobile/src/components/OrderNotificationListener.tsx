import React, { useEffect, useRef } from 'react';
import { Vibration, Alert, Platform, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundService from 'react-native-background-actions';
import { onIdTokenChanged } from 'firebase/auth';
import { doc, setDoc, updateDoc, arrayUnion, collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

// Configure notification behavior for when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldVibrate: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const STORAGE_KEY = 'notified_transaction_ids';
const MAX_STORED_IDS = 100;

// ─── Background Task Configuration ───────────────────────────────
const bgTaskOptions = {
  taskName: 'OrderListener',
  taskTitle: 'iKasir Pro',
  taskDesc: 'Mendengarkan pesanan baru...',
  taskIcon: { name: 'ic_launcher', type: 'mipmap' },
  color: '#0f172a',
  foregroundServiceType: ['dataSync'] as Array<'dataSync'>,
  parameters: { delay: 5000 },
};

// ─── Helpers ─────────────────────────────────────────────────────
async function loadNotifiedIds(): Promise<Set<string>> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch (e) {
    console.error('[BG] Error loading notified IDs:', e);
  }
  return new Set();
}

async function saveNotifiedIds(ids: Set<string>): Promise<void> {
  try {
    const arr = Array.from(ids);
    if (arr.length > MAX_STORED_IDS) arr.splice(0, arr.length - MAX_STORED_IDS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {
    console.error('[BG] Error saving notified IDs:', e);
  }
}

async function getStoreId(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem('auth-storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.state?.storeId || null;
    }
  } catch (e) {
    console.error('[BG] Error reading storeId:', e);
  }
  return null;
}

// Parse Firestore REST value format to standard JS object
function parseFirestoreValue(valueObj: any): any {
  if (!valueObj) return undefined;
  if ('stringValue' in valueObj) return valueObj.stringValue;
  if ('integerValue' in valueObj) return parseInt(valueObj.integerValue, 10);
  if ('doubleValue' in valueObj) return parseFloat(valueObj.doubleValue);
  if ('booleanValue' in valueObj) return valueObj.booleanValue;
  if ('timestampValue' in valueObj) return valueObj.timestampValue;
  if ('mapValue' in valueObj) {
    const res: any = {};
    const fields = valueObj.mapValue.fields || {};
    for (const k of Object.keys(fields)) {
      res[k] = parseFirestoreValue(fields[k]);
    }
    return res;
  }
  if ('arrayValue' in valueObj) {
    const values = valueObj.arrayValue.values || [];
    return values.map((v: any) => parseFirestoreValue(v));
  }
  return undefined;
}

// ─── Core: The Firestore REST listener that runs INSIDE the bg task ───
const orderListenerTask = async (_taskData?: { delay: number }) => {
  console.log('[BG-SERVICE] Background order listener started (REST Polling Mode)');

  // Setup notification channel (safe to call multiple times)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Pesanan Baru',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500, 250, 500],
      lightColor: '#ff0000',
      sound: 'default',
      showBadge: true,
    });
  }

  let storeId = await getStoreId();
  let notifiedIds = await loadNotifiedIds();
  let isInitial = true;

  const checkNewOrders = async (sid: string) => {
    try {
      console.log(`[BG-SERVICE] Polling orders for store: ${sid} via REST API`);
      const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'kasir-3d12b';
      const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAzmifpFOz0asKVDjLJDXVAvfTPNmOEiUw';
      const token = await AsyncStorage.getItem('firebase_id_token');

      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'transactions' }],
            where: {
              compositeFilter: {
                op: 'AND',
                filters: [
                  {
                    fieldFilter: {
                      field: { fieldPath: 'storeId' },
                      op: 'EQUAL',
                      value: { stringValue: sid }
                    }
                  },
                  {
                    fieldFilter: {
                      field: { fieldPath: 'orderStatus' },
                      op: 'EQUAL',
                      value: { stringValue: 'new' }
                    }
                  }
                ]
              }
            }
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[BG-SERVICE] REST Query failed (${response.status}):`, errText);
        return;
      }

      const data = await response.json();
      let updated = false;

      if (Array.isArray(data)) {
        for (const item of data) {
          if (!item.document) continue;

          const docId = item.document.name.split('/').pop();
          if (!docId) continue;

          if (notifiedIds.has(docId)) continue;

          // Parse fields
          const fields = item.document.fields || {};
          const tx: any = {};
          for (const k of Object.keys(fields)) {
            tx[k] = parseFirestoreValue(fields[k]);
          }

          const txTime = tx.timestamp ? new Date(tx.timestamp) : new Date();
          const diffMs = Date.now() - txTime.getTime();
          const isRecent = diffMs <= 15 * 60 * 1000;

          if (!isInitial || isRecent) {
            const totalStr = tx.total ? `Rp ${tx.total.toLocaleString('id-ID')}` : '';

            // Fire native notification (works in background!)
            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: '🚨 PESANAN ONLINE BARU!',
                  body: `Ada pesanan baru masuk senilai ${totalStr}. Ketuk untuk melihat detail.`,
                  sound: 'default',
                  vibrate: [0, 500, 250, 500],
                  priority: Notifications.AndroidNotificationPriority.MAX,
                  data: { transactionId: docId },
                },
                trigger: {
                  channelId: 'orders',
                },
              });
              console.log(`[BG-SERVICE] Notification sent for order: ${docId}`);
            } catch (err) {
              console.error('[BG-SERVICE] Notification error:', err);
            }

            // Save to notification store via AsyncStorage directly
            try {
              const raw = await AsyncStorage.getItem('kasir-pro-mobile-notifications');
              const store = raw ? JSON.parse(raw) : { state: { notifications: [] } };
              const notifications = store.state?.notifications || [];
              notifications.unshift({
                id: Math.random().toString(36).substring(2, 9),
                title: '🚨 PESANAN ONLINE BARU!',
                body: `Ada pesanan baru masuk senilai ${totalStr}.`,
                timestamp: new Date().toISOString(),
                isRead: false,
                data: { transactionId: docId },
              });
              store.state.notifications = notifications.slice(0, 50);
              await AsyncStorage.setItem('kasir-pro-mobile-notifications', JSON.stringify(store));
            } catch (e) {
              // Ignore
            }
          }

          notifiedIds.add(docId);
          updated = true;
        }
      }

      if (updated) {
        await saveNotifiedIds(notifiedIds);
      }
    } catch (err) {
      console.error('[BG-SERVICE] Polling error:', err);
    }
  };

  // Immediate initial check
  if (storeId) {
    await checkNewOrders(storeId);
    isInitial = false;
  }

  const sleep = (time: number) => new Promise<void>((resolve) => setTimeout(resolve, time));

  // Keep the task alive forever using an async while loop (setInterval is paused in background)
  await new Promise<void>(async (resolve) => {
    BackgroundService.on('expiration', () => {
      resolve();
    });

    while (BackgroundService.isRunning()) {
      await sleep(_taskData?.delay || 10000);
      
      const currentStoreId = await getStoreId();

      // If storeId changed (login/logout), reset
      if (currentStoreId !== storeId) {
        storeId = currentStoreId;
        if (storeId) {
          notifiedIds = await loadNotifiedIds();
          isInitial = true;
        }
      }

      if (storeId) {
        await checkNewOrders(storeId);
        if (isInitial) isInitial = false;
      }
    }
  });
};

// ─── React Component ─────────────────────────────────────────────
// Handles: foreground alerts, vibration, starting/stopping bg service
export default function OrderNotificationListener() {
  const { storeId, role } = useAuthStore();
  const addNotification = useNotificationStore(state => state.addNotification);
  const appState = useRef(AppState.currentState);

  // Listen to new subscription requests if user is a superadmin
  useEffect(() => {
    if (role !== 'superadmin' && role !== 'super-admin') return;

    const q = query(
      collection(db, 'subscription_requests'),
      where('status', '==', 'pending')
    );

    let isInitial = true;

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          
          if (!isInitial) {
            // Trigger local/system push notification
            try {
              Notifications.scheduleNotificationAsync({
                content: {
                  title: '🚨 Pengajuan Langganan Baru!',
                  body: `Toko ${data.ownerEmail || ''} mengajukan paket ${data.packageTitle || ''}.`,
                  sound: 'default',
                  priority: Notifications.AndroidNotificationPriority.MAX,
                },
                trigger: null,
              });
            } catch (err) {
              console.error('[Notification] Error triggering local notification:', err);
            }

            // Add to notification store history
            try {
              addNotification({
                title: '🚨 Pengajuan Langganan Baru!',
                body: `Toko ${data.ownerEmail || ''} mengajukan paket ${data.packageTitle || ''}.`,
              });
            } catch (err) {
              console.error('[Notification] Error adding to store:', err);
            }
          }
        }
      });
      
      isInitial = false;
    });

    return () => unsubscribe();
  }, [role, addNotification]);

  // 1. Request notification permissions and listen to Firebase ID Token changes
  useEffect(() => {
    async function requestPerms() {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('orders', {
          name: 'Pesanan Baru',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 250, 500, 250, 500],
          lightColor: '#ff0000',
          sound: 'default',
          showBadge: true,
        });
      }
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    }
    requestPerms();

    // Keep AsyncStorage 'firebase_id_token' synced for background fetch usage
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      try {
        if (user) {
          const token = await user.getIdToken();
          await AsyncStorage.setItem('firebase_id_token', token);
          console.log('[FG] Saved fresh firebase_id_token to AsyncStorage');
        } else {
          await AsyncStorage.removeItem('firebase_id_token');
          console.log('[FG] Cleared firebase_id_token from AsyncStorage');
        }
      } catch (err) {
        console.error('[FG] Error managing firebase_id_token:', err);
      }
    });

    return () => unsubscribe();
  }, []);

  // 1.5 Get FCM Device Token and save to Firestore
  useEffect(() => {
    async function registerFCMToken() {
      const targetStoreId = (role === 'superadmin' || role === 'super-admin') ? 'superadmin' : storeId;
      if (!targetStoreId) return;
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;

        // Try getting FCM device token (will fail if google-services.json is missing or invalid)
        const tokenData = await Notifications.getDevicePushTokenAsync();
        if (tokenData && tokenData.data) {
          const token = tokenData.data;
          console.log('[FG] FCM Device Token:', token);
          
          // Save to Firestore settings document
          const storeSettingsRef = doc(db, 'settings', `store_${targetStoreId}`);
          await setDoc(storeSettingsRef, {
            fcmTokens: arrayUnion(token)
          }, { merge: true });
        }
      } catch (err) {
        console.warn('[FG] Failed to get/save FCM token. Please ensure google-services.json is configured:', err);
      }
    }
    
    // Slight delay to ensure auth state is ready
    setTimeout(registerFCMToken, 2000);
  }, [storeId, role]);

  // 2. Start/stop the Android foreground service based on storeId
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const manageService = async () => {
      try {
        if (storeId) {
          if (!BackgroundService.isRunning()) {
            await BackgroundService.start(orderListenerTask, bgTaskOptions);
            console.log('[FG] Background order listener service started');
          }
        } else {
          if (BackgroundService.isRunning()) {
            await BackgroundService.stop();
            console.log('[FG] Background order listener service stopped (user logged out)');
          }
        }
      } catch (err) {
        console.warn('[FG] Failed to manage background service:', err);
      }
    };

    manageService();

    // CRITICAL: Do NOT stop the background service on component unmount
    // so that it persists in the background when the app is minimized or closed.
  }, [storeId]);

  // 3. Foreground-only: vibrate + show alert when notification is received
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.transactionId && appState.current === 'active') {
        Vibration.vibrate([100, 300, 100, 300, 100, 500]);
        Alert.alert(
          '🚨 Pesanan Baru Masuk!',
          notification.request.content.body || 'Ada pesanan online baru!',
          [{ text: 'OK', style: 'default' }]
        );
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      appState.current = next;
    });

    return () => {
      subscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  return null;
}

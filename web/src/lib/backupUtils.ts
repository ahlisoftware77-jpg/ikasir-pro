import { db } from './firebase';
import { collection, query, where, getDocs, getDoc, doc, setDoc, writeBatch } from 'firebase/firestore';

/**
 * Centrally managed JSON import/restore logic.
 * Imports data from a backup JSON file back into Firestore.
 */
export const handleImportJSON = async (file: File) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const backupData = JSON.parse(content);
        
        if (!backupData.data || !backupData.metadata) {
          throw new Error("Format file backup tidak valid.");
        }

        const collections = Object.keys(backupData.data);
        let totalRestored = 0;

        for (const collName of collections) {
          const docs = backupData.data[collName];
          if (!Array.isArray(docs)) continue;

          // Split into batches of 500 (Firestore limit)
          for (let i = 0; i < docs.length; i += 500) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + 500);
            
            chunk.forEach((docData: any) => {
              const { id, ...data } = docData;
              const ref = doc(db, collName, id);
              batch.set(ref, data, { merge: true });
              totalRestored++;
            });

            await batch.commit();
          }
        }

        resolve({ success: true, totalRestored, metadata: backupData.metadata });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
};

/**
 * Centrally managed JSON import/restore logic for a specific store.
 * Imports data from a backup JSON file back into Firestore, with store ID remapping if needed.
 */
export const handleImportStoreJSON = async (file: File, targetStoreId: string) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const backupData = JSON.parse(content);
        
        if (!backupData.data || !backupData.metadata) {
          throw new Error("Format file backup tidak valid.");
        }

        const sourceStoreId = backupData.metadata.storeId;
        if (sourceStoreId === 'GLOBAL') {
          throw new Error("File backup GLOBAL tidak dapat dipulihkan ke toko tunggal.");
        }

        const needsMapping = sourceStoreId !== targetStoreId;
        const collections = Object.keys(backupData.data);
        let totalRestored = 0;

        for (const collName of collections) {
          const docs = backupData.data[collName];
          if (!Array.isArray(docs)) continue;

          // Split into batches of 500 (Firestore limit)
          for (let i = 0; i < docs.length; i += 500) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + 500);
            
            chunk.forEach((docData: any) => {
              const { id, ...data } = docData;
              let targetDocId = id;
              
              // Map settings document ID if different
              if (needsMapping && collName === 'settings' && id === `store_${sourceStoreId}`) {
                targetDocId = `store_${targetStoreId}`;
              }
              // Map stores document ID if different
              else if (needsMapping && collName === 'stores' && id === sourceStoreId) {
                targetDocId = targetStoreId;
              }

              const dataToSave = { ...data };
              if (needsMapping) {
                // Map storeId field inside collection documents if it exists
                if ('storeId' in dataToSave) {
                  dataToSave.storeId = targetStoreId;
                }
              }

              const ref = doc(db, collName, targetDocId);
              batch.set(ref, dataToSave, { merge: true });
              totalRestored++;
            });

            await batch.commit();
          }
        }

        resolve({ success: true, totalRestored, metadata: backupData.metadata });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
};


/**
 * Centrally managed JSON backup logic.
 * Exports settings and all core collections for a specific store.
 */
export const handleExportJSON = async (storeId: string) => {
  if (!storeId) throw new Error("Store ID is required for backup.");
  
  const isGlobal = storeId === 'GLOBAL';
  const settingsRef = isGlobal ? null : doc(db, 'stores', storeId);
  const collectionsToExport = [
    'products', 
    'transactions', 
    'customers', 
    'users', 
    'expenses', 
    'discounts', 
    'categories',
    'product_extras'
  ];
  
  const backupData: any = {
    metadata: {
      storeId,
      timestamp: new Date().toISOString(),
      version: '1.2'
    },
    data: {}
  };

  try {
    // 1. Export Settings Document(s)
    if (isGlobal) {
      const storesSnap = await getDocs(collection(db, 'stores'));
      const storesData: any[] = [];
      storesSnap.forEach(d => storesData.push({ id: d.id, ...d.data() }));
      backupData.data['stores'] = storesData;

      const settingsSnap = await getDocs(collection(db, 'settings'));
      const settingsData: any[] = [];
      settingsSnap.forEach(d => settingsData.push({ id: d.id, ...d.data() }));
      backupData.data['settings'] = settingsData;
    } else if (settingsRef) {
      const storeSnap = await getDoc(settingsRef);
      if (storeSnap.exists()) {
        backupData.data['stores'] = [{ id: storeSnap.id, ...storeSnap.data() }];
      }
      
      const specificSettings = await getDoc(doc(db, 'settings', `store_${storeId}`));
      if (specificSettings.exists()) {
        backupData.data['settings'] = [{ id: specificSettings.id, ...specificSettings.data() }];
      }
    }

    // 2. Export Collections
    for (const collName of collectionsToExport) {
        try {
            let snap;
            if (isGlobal) {
              snap = await getDocs(collection(db, collName));
            } else {
              const q = query(collection(db, collName), where('storeId', '==', storeId));
              snap = await getDocs(q);
            }
            
            const docs: any[] = [];
            snap.forEach(d => {
                const data = d.data();
                // Convert Firestore timestamps to ISO strings for JSON compatibility if they exist
                const serializedData = { ...data };
                Object.keys(serializedData).forEach(key => {
                    if (serializedData[key]?.toDate && typeof serializedData[key].toDate === 'function') {
                        serializedData[key] = serializedData[key].toDate().toISOString();
                    }
                });
                docs.push({ id: d.id, ...serializedData });
            });
            backupData.data[collName] = docs;
        } catch (colErr) {
            console.warn(`Could not export collection ${collName}:`, colErr);
            // Continue with other collections
        }
    }

    // 3. Download Logic
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = isGlobal ? `backup_global_all_stores_${dateStr}.json` : `backup_${storeId}_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);

    return backupData;
  } catch (err: any) {
    console.error("Backup Utility error:", err);
    throw err;
  }
};

import { doc, getDoc, writeBatch, Firestore } from 'firebase/firestore';

export interface SmartRestoreResult {
  totalDocs: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  details: {
    collName: string;
    inserted: number;
    updated: number;
    skipped: number;
    failed: number;
  }[];
}

/**
 * Parses timestamp value into numeric epoch milliseconds
 */
const getMillis = (obj: any): number => {
  if (!obj) return 0;
  const ts = obj.updatedAt || obj.timestamp || obj.updated_at || obj.createdAt || obj.date;
  if (!ts) return 0;
  if (typeof ts === 'object' && ts.toDate && typeof ts.toDate === 'function') {
    return ts.toDate().getTime();
  }
  if (typeof ts === 'number') return ts;
  const parsed = new Date(ts).getTime();
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Deep or strict shallow comparison of object properties
 */
const areValuesEqual = (v1: any, v2: any): boolean => {
  if (v1 === v2) return true;
  if (v1 === null || v1 === undefined || v2 === null || v2 === undefined) {
    return v1 == v2;
  }
  if (typeof v1 === 'object' && typeof v2 === 'object') {
    return JSON.stringify(v1) === JSON.stringify(v2);
  }
  return String(v1) === String(v2);
};

/**
 * Smart Non-Destructive Restore for Firestore collections.
 * Rules:
 * 1. Data sama -> Dilewati (Skip)
 * 2. Data tidak sama -> Ditambahkan / Diubah
 * 3. Data baru -> Ditambahkan
 * 4. Data lama di backup tidak menimpa data yang lebih baru di database.
 */
export const smartRestoreCollection = async (
  targetDb: Firestore,
  collName: string,
  backupDocs: any[],
  transformDoc?: (docId: string, docData: any) => { targetId: string; payload: any }
): Promise<{ inserted: number; updated: number; skipped: number; failed: number }> => {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  if (!Array.isArray(backupDocs) || backupDocs.length === 0) {
    return { inserted, updated, skipped, failed };
  }

  // Process in chunks to handle batch commits
  const CHUNK_SIZE = 100; // Small chunk size so we can fetch existing docs and batch write cleanly
  for (let i = 0; i < backupDocs.length; i += CHUNK_SIZE) {
    const chunk = backupDocs.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(targetDb);
    let batchHasOperations = false;

    for (const d of chunk) {
      try {
        const { id, ...rawContent } = d;
        let targetId = id;
        let payload = { ...rawContent };

        if (transformDoc) {
          const transformed = transformDoc(id, payload);
          targetId = transformed.targetId;
          payload = transformed.payload;
        }

        if (!targetId) {
          failed++;
          continue;
        }

        const docRef = doc(targetDb, collName, targetId);
        const existingSnap = await getDoc(docRef);

        if (!existingSnap.exists()) {
          // 1. DATA BARU -> Tambahkan (Insert)
          batch.set(docRef, payload, { merge: true });
          inserted++;
          batchHasOperations = true;
        } else {
          // 2. DATA SUDAH ADA -> Bandingkan
          const existingData = existingSnap.data();
          const existingTime = getMillis(existingData);
          const backupTime = getMillis(payload);

          // Cek apakah data di DB lebih BARU daripada file backup
          const isDbNewer = existingTime > 0 && backupTime > 0 && existingTime > backupTime;

          if (isDbNewer) {
            // Data di DB lebih baru -> Jangan timpa field yang sudah ada!
            // Hanya tambahkan field baru jika ada di backup tapi belum ada di DB
            const missingFieldsPayload: Record<string, any> = {};
            let hasMissingFields = false;

            Object.keys(payload).forEach(key => {
              if (existingData[key] === undefined) {
                missingFieldsPayload[key] = payload[key];
                hasMissingFields = true;
              }
            });

            if (hasMissingFields) {
              batch.set(docRef, missingFieldsPayload, { merge: true });
              updated++;
              batchHasOperations = true;
            } else {
              skipped++;
            }
          } else {
            // Data di DB seumur / lebih lama -> Cek apakah ada perbedaan
            const updateFieldsPayload: Record<string, any> = {};
            let isDifferent = false;

            Object.keys(payload).forEach(key => {
              const bVal = payload[key];
              const eVal = existingData[key];

              if (!areValuesEqual(bVal, eVal)) {
                updateFieldsPayload[key] = bVal;
                isDifferent = true;
              }
            });

            if (isDifferent) {
              // Ada perbedaan -> Perbarui (Update)
              batch.set(docRef, updateFieldsPayload, { merge: true });
              updated++;
              batchHasOperations = true;
            } else {
              // Data sama persis -> Dilewati (Skip)
              skipped++;
            }
          }
        }
      } catch (err) {
        console.error(`Error in smartRestore for ${collName}:`, err);
        failed++;
      }
    }

    if (batchHasOperations) {
      await batch.commit();
    }
  }

  return { inserted, updated, skipped, failed };
};

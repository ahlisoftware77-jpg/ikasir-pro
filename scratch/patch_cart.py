import sys
import re

file_path = r'e:\yadiapp-project\KASIR\web\src\components\CartDrawer.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the imports
content = content.replace(
    "import { auth, db } from '@/lib/firebase';",
    "import { auth, db, primaryDb, getTenantDb } from '@/lib/firebase';"
)

# Replace the runTransaction block start
target_block_start = """      for (const [storeId, storeItems] of Object.entries(itemsByStore)) {
        const result = await runTransaction(db, async (transaction) => {
          const settingsRef = doc(db, 'settings', `store_${storeId}`);
          const settingsSnap = await transaction.get(settingsRef);
          
          const productReads = [];
          for (const item of storeItems) {
            const pRef = doc(db, 'products', item.productId);"""

replacement_block_start = """      for (const [storeId, storeItems] of Object.entries(itemsByStore)) {
        let tDb = db;
        try {
          const sRefPrimary = doc(primaryDb, 'stores', storeId);
          const sSnapPrimary = await getDoc(sRefPrimary);
          if (sSnapPrimary.exists()) {
            const cfg = sSnapPrimary.data().infraConfig;
            tDb = cfg ? getTenantDb(cfg) : primaryDb;
          }
        } catch (e) {
          console.warn("Failed to fetch tenant config", e);
        }

        const result = await runTransaction(tDb, async (transaction) => {
          const settingsRef = doc(tDb, 'settings', `store_${storeId}`);
          const settingsSnap = await transaction.get(settingsRef);
          
          const productReads = [];
          for (const item of storeItems) {
            const pRef = doc(tDb, 'products', item.productId);"""

content = content.replace(target_block_start, replacement_block_start)

# Replace the newOrderRef line
target_line = "          const newOrderRef = doc(db, 'transactions', finalId);"
replacement_line = "          const newOrderRef = doc(tDb, 'transactions', finalId);"
content = content.replace(target_line, replacement_line)

with open(file_path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print("Patch applied to CartDrawer.tsx")

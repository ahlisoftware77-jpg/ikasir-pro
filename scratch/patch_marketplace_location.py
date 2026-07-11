import sys

file_path = r'e:\yadiapp-project\KASIR\mobile\src\screens\MarketplaceScreen.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the users loop
target_users_fetch = """      // Fetch users to get latitude & longitude
      const usersQ = query(collection(primaryDb, 'users'));
      const usersSnap = await getDocs(usersQ);
      const storeLocations: Record<string, { lat: number, lng: number }> = {};
      usersSnap.forEach(doc => {
        const u = doc.data();
        if (u.latitude && u.longitude) {
           storeLocations[doc.id] = { lat: u.latitude, lng: u.longitude };
        }
      });"""

content = content.replace(target_users_fetch, "      // Coordinates are now fetched from store settings concurrently later.")

# 2. Update list push inside tenant fetch
target_list_push = """            const loc = storeLocations[data.storeId];
            list.push({
              id: d.id,
              name: data.name || '',
              storeLatitude: loc?.lat,
              storeLongitude: loc?.lng,"""

replacement_list_push = """            // Coordinates will be injected later
            list.push({
              id: d.id,
              name: data.name || '',
              storeLatitude: undefined,
              storeLongitude: undefined,"""

content = content.replace(target_list_push, replacement_list_push)

# 3. Add locMap extraction
target_store_details = """      // Fetch store details concurrently
      const logoMap: Record<string, string> = {};
      const hiddenCatMap: Record<string, string[]> = {};
      await Promise.all(
        Array.from(uniqueStoreIds).map(async (storeId) => {
          try {
            const cfg = storeToConfigMap[storeId] || { projectId: 'kasir-3d12b' };
            const tDb = getTenantDb(cfg);
            const sRef = doc(tDb, 'settings', `store_${storeId}`);
            const sSnap = await getDoc(sRef);
            if (sSnap.exists()) {
              const sData = sSnap.data();
              if (sData.logoUrl) logoMap[storeId] = sData.logoUrl;
              if (sData.hiddenMarketplaceCategories) hiddenCatMap[storeId] = sData.hiddenMarketplaceCategories;
            }
          } catch (e) {}
        })
      );

      setStoreLogos(logoMap);"""

replacement_store_details = """      // Fetch store details concurrently
      const logoMap: Record<string, string> = {};
      const hiddenCatMap: Record<string, string[]> = {};
      const locMap: Record<string, { lat: number, lng: number }> = {};
      await Promise.all(
        Array.from(uniqueStoreIds).map(async (storeId) => {
          try {
            const cfg = storeToConfigMap[storeId] || { projectId: 'kasir-3d12b' };
            const tDb = getTenantDb(cfg);
            const sRef = doc(tDb, 'settings', `store_${storeId}`);
            const sSnap = await getDoc(sRef);
            if (sSnap.exists()) {
              const sData = sSnap.data();
              if (sData.logoUrl) logoMap[storeId] = sData.logoUrl;
              if (sData.hiddenMarketplaceCategories) hiddenCatMap[storeId] = sData.hiddenMarketplaceCategories;
              if (sData.latitude && sData.longitude) {
                 locMap[storeId] = { lat: sData.latitude, lng: sData.longitude };
              }
            }
          } catch (e) {}
        })
      );

      setStoreLogos(logoMap);

      // Map latitude and longitude to products
      list.forEach(p => {
         if (locMap[p.storeId]) {
            p.storeLatitude = locMap[p.storeId].lat;
            p.storeLongitude = locMap[p.storeId].lng;
         }
      });"""

content = content.replace(target_store_details, replacement_store_details)

with open(file_path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Patch applied to MarketplaceScreen.tsx")

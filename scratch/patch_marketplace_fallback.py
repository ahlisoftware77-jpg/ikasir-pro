import sys

file_path = r'e:\yadiapp-project\KASIR\mobile\src\screens\MarketplaceScreen.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target1 = """      const tenantConfigs = new Map<string, any>();
      const storeToConfigMap: Record<string, any> = {};
      
      storesSnap.forEach(doc => {
        const sData = doc.data();
        const cfg = sData.infraConfig || { projectId: 'kasir-3d12b' }; // fallback
        const pId = cfg.projectId || cfg.fb_project_id;
        if (pId) tenantConfigs.set(pId, cfg);
        storeToConfigMap[doc.id] = cfg;
      });"""

replacement1 = """      const tenantConfigs = new Map<string, any>();
      const storeToConfigMap: Record<string, any> = {};
      const storeOwnerMap: Record<string, string> = {};
      const primaryStoreLocMap: Record<string, {lat: number, lng: number}> = {};
      
      storesSnap.forEach(doc => {
        const sData = doc.data();
        const cfg = sData.infraConfig || { projectId: 'kasir-3d12b' }; // fallback
        const pId = cfg.projectId || cfg.fb_project_id;
        if (pId) tenantConfigs.set(pId, cfg);
        storeToConfigMap[doc.id] = cfg;
        
        if (sData.ownerId) storeOwnerMap[doc.id] = sData.ownerId;
        if (sData.latitude && sData.longitude) {
           primaryStoreLocMap[doc.id] = { lat: sData.latitude, lng: sData.longitude };
        }
      });
      
      // Fetch users collection as a fallback source for GPS
      const usersQ = query(collection(primaryDb, 'users'));
      const usersSnap = await getDocs(usersQ);
      const userLocMap: Record<string, { lat: number, lng: number }> = {};
      usersSnap.forEach(doc => {
        const u = doc.data();
        if (u.latitude && u.longitude) {
           userLocMap[doc.id] = { lat: u.latitude, lng: u.longitude };
        }
      });"""

content = content.replace(target1, replacement1)

target2 = """      // Map latitude and longitude to products
      list.forEach(p => {
         if (locMap[p.storeId]) {
            p.storeLatitude = locMap[p.storeId].lat;
            p.storeLongitude = locMap[p.storeId].lng;
         }
      });"""

replacement2 = """      // Map latitude and longitude to products with robust fallback across databases
      list.forEach(p => {
         // Priority 1: Tenant settings
         if (locMap[p.storeId]) {
            p.storeLatitude = locMap[p.storeId].lat;
            p.storeLongitude = locMap[p.storeId].lng;
         } 
         // Priority 2: Primary stores collection
         else if (primaryStoreLocMap[p.storeId]) {
            p.storeLatitude = primaryStoreLocMap[p.storeId].lat;
            p.storeLongitude = primaryStoreLocMap[p.storeId].lng;
         } 
         // Priority 3: Primary users collection (using store's ownerId)
         else if (storeOwnerMap[p.storeId] && userLocMap[storeOwnerMap[p.storeId]]) {
            const ownerId = storeOwnerMap[p.storeId];
            p.storeLatitude = userLocMap[ownerId].lat;
            p.storeLongitude = userLocMap[ownerId].lng;
         } 
         // Priority 4: Primary users collection (using storeId directly as fallback)
         else if (userLocMap[p.storeId]) {
            p.storeLatitude = userLocMap[p.storeId].lat;
            p.storeLongitude = userLocMap[p.storeId].lng;
         }
      });"""

content = content.replace(target2, replacement2)

with open(file_path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Patch applied to MarketplaceScreen.tsx")

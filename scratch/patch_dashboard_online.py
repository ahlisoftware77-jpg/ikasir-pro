import sys

file_path = r'e:\yadiapp-project\KASIR\mobile\src\screens\DashboardScreen.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace states
target_states = """  const [showCategorySettings, setShowCategorySettings] = useState(false);
  const [storeCategories, setStoreCategories] = useState<string[]>([]);
  const [hiddenMarketplaceCategories, setHiddenMarketplaceCategories] = useState<string[]>([]);
  const [hiddenOnlineStoreCategories, setHiddenOnlineStoreCategories] = useState<string[]>([]);
  const [categorySettingsTab, setCategorySettingsTab] = useState<'marketplace' | 'online'>('marketplace');

  const toggleCategorySettings = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowCategorySettings(!showCategorySettings);
  };"""

replacement_states = """  const [showCategorySettings, setShowCategorySettings] = useState(false);
  const [showOnlineCategorySettings, setShowOnlineCategorySettings] = useState(false);
  const [storeCategories, setStoreCategories] = useState<string[]>([]);
  const [hiddenMarketplaceCategories, setHiddenMarketplaceCategories] = useState<string[]>([]);
  const [hiddenOnlineStoreCategories, setHiddenOnlineStoreCategories] = useState<string[]>([]);

  const toggleCategorySettings = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowCategorySettings(!showCategorySettings);
  };

  const toggleOnlineCategorySettings = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowOnlineCategorySettings(!showOnlineCategorySettings);
  };"""

content = content.replace(target_states, replacement_states)

# Replace the online store panel bottom
target_panel = """            {isOnlineStoreActive && (
              <View className="flex-row gap-2.5 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <TouchableOpacity
                  onPress={() => {
                    Vibration.vibrate(10);
                    Clipboard.setString(`https://ikasir.my.id/tr?s=${storeId}`);
                    Alert.alert('Sukses', 'Link Toko Online berhasil disalin!');
                  }}
                  className="flex-1 py-2.5 bg-white rounded-xl items-center justify-center flex-row gap-1.5 border border-slate-200 shadow-sm"
                >
                  <Copy size={12} color="#1e293b" />
                  <Text className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                    Salin Link
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => {
                    Vibration.vibrate(10);
                    Linking.openURL(`https://ikasir.my.id/tr?s=${storeId}`);
                  }}
                  className="flex-1 py-2.5 bg-blue-500 rounded-xl items-center justify-center flex-row gap-1.5 shadow-lg shadow-blue-500/10"
                >
                  <ShoppingBag size={12} color="#ffffff" />
                  <Text className="text-[10px] font-black uppercase tracking-wider text-white">
                    Buka Toko
                  </Text>
                </TouchableOpacity>
              </View>
            )}"""

replacement_panel = """            {isOnlineStoreActive && (
              <View className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 gap-2.5">
                <View className="flex-row gap-2.5">
                  <TouchableOpacity
                    onPress={() => {
                      Vibration.vibrate(10);
                      Clipboard.setString(`https://ikasir.my.id/tr?s=${storeId}`);
                      Alert.alert('Sukses', 'Link Toko Online berhasil disalin!');
                    }}
                    className="flex-1 py-2.5 bg-white rounded-xl items-center justify-center flex-row gap-1.5 border border-slate-200 shadow-sm"
                  >
                    <Copy size={12} color="#1e293b" />
                    <Text className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                      Salin Link
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() => {
                      Vibration.vibrate(10);
                      Linking.openURL(`https://ikasir.my.id/tr?s=${storeId}`);
                    }}
                    className="flex-1 py-2.5 bg-blue-500 rounded-xl items-center justify-center flex-row gap-1.5 shadow-lg shadow-blue-500/10"
                  >
                    <ShoppingBag size={12} color="#ffffff" />
                    <Text className="text-[10px] font-black uppercase tracking-wider text-white">
                      Buka Toko
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    Vibration.vibrate(10);
                    toggleOnlineCategorySettings();
                  }}
                  className="w-full py-2.5 rounded-xl items-center justify-center flex-row gap-2 border shadow-sm"
                  style={{ backgroundColor: showOnlineCategorySettings ? colors.surface : colors.accent, borderColor: showOnlineCategorySettings ? colors.border : colors.accent }}
                >
                  <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: showOnlineCategorySettings ? colors.text : 'white' }}>
                    🛍️ Atur Visibilitas Kategori
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {showOnlineCategorySettings && storeCategories.length > 0 && (
              <View className="mt-4 p-4 rounded-2xl border" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
                <Text className="text-[10px] font-black uppercase tracking-widest mb-3 pl-1" style={{ color: colors.accent }}>Pilih Kategori yang Ditampilkan</Text>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {storeCategories.map((cat, idx) => {
                    const isHidden = hiddenOnlineStoreCategories.includes(cat);
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => {
                          Vibration.vibrate(5);
                          handleToggleOnlineCategory(cat);
                        }}
                        className="flex-row items-center px-3 py-1.5 rounded-full border"
                        style={{
                          backgroundColor: isHidden ? colors.surface : colors.accent,
                          borderColor: isHidden ? colors.border : colors.accent
                        }}
                      >
                        <Text className="text-[10px] font-bold" style={{ color: isHidden ? colors.text : '#fff' }}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}"""

content = content.replace(target_panel, replacement_panel)

with open(file_path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print("Patch applied to DashboardScreen.tsx")

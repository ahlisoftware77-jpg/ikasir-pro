import sys

file_path = r'e:\yadiapp-project\KASIR\mobile\src\screens\StoreSettingsScreen.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add MapPin to imports
target_lucide = "from 'lucide-react-native';"
if "MapPin" not in content:
    # We will just replace one of the lucide-react-native imports or just add it
    # Find the line with lucide-react-native
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if "from 'lucide-react-native';" in line:
            lines[i] = line.replace("} from 'lucide-react-native';", ", MapPin } from 'lucide-react-native';")
            break
    content = '\n'.join(lines)

# Add the UI button
target_address = """                    {/* Address Input */}
                    <View className="space-y-1">
                      <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Alamat Lengkap</Text>
                      <TextInput
                        value={storeSettings.address}
                        onChangeText={(txt) => setStoreSettings(prev => ({ ...prev, address: txt }))}
                        placeholder="Alamat Toko..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={3}
                        className="p-4 rounded-2xl border font-bold text-xs min-h-[80px]"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, textAlignVertical: 'top' }}
                      />
                    </View>"""

replacement_address = """                    {/* Address Input */}
                    <View className="space-y-1">
                      <Text className="text-[9px] font-black uppercase tracking-wider pl-1" style={{ color: colors.textMuted }}>Alamat Lengkap</Text>
                      <TextInput
                        value={storeSettings.address}
                        onChangeText={(txt) => setStoreSettings(prev => ({ ...prev, address: txt }))}
                        placeholder="Alamat Toko..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={3}
                        className="p-4 rounded-2xl border font-bold text-xs min-h-[80px]"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, textAlignVertical: 'top' }}
                      />
                      <TouchableOpacity
                        onPress={handleGetLocation}
                        disabled={isGettingLocation}
                        className="flex-row items-center justify-center p-3 rounded-xl border mt-2"
                        style={{ backgroundColor: storeSettings.latitude ? 'rgba(16, 185, 129, 0.1)' : colors.surface, borderColor: storeSettings.latitude ? '#10b981' : colors.border }}
                      >
                        <MapPin size={16} color={storeSettings.latitude ? '#10b981' : colors.textMuted} style={{ marginRight: 8 }} />
                        <Text className="text-[10px] font-black uppercase tracking-wider" style={{ color: storeSettings.latitude ? '#10b981' : colors.text }}>
                          {isGettingLocation ? 'Mencari Lokasi...' : (storeSettings.latitude ? 'Kordinat GPS Tersimpan (Perbarui)' : 'Ambil Kordinat GPS Saat Ini')}
                        </Text>
                      </TouchableOpacity>
                    </View>"""

content = content.replace(target_address, replacement_address)

with open(file_path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Patch applied to StoreSettingsScreen.tsx")

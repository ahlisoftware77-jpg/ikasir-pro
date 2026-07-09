import sys

file_path = 'mobile/src/screens/SuperAdminScreen.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add validateGeminiApiKey import
if 'validateGeminiApiKey' not in content:
    content = content.replace("import { generateProductInfoFromImage } from '../utils/geminiHelper';",
                              "import { generateProductInfoFromImage, validateGeminiApiKey } from '../utils/geminiHelper';")
    if 'validateGeminiApiKey' not in content: # Fallback if not found
        content = "import { validateGeminiApiKey } from '../utils/geminiHelper';\n" + content

# 2. Add handleUpdateGemini
gemini_handler = """  const handleUpdateGemini = async () => {
    if (!infraData.gemini_api_key) {
      Alert.alert('Gagal', 'API Key tidak boleh kosong.');
      return;
    }
    setIsSaving(true);
    try {
      const isValid = await validateGeminiApiKey(infraData.gemini_api_key);
      if (!isValid) {
        Alert.alert('API Key Tidak Valid', 'API Key Gemini yang dimasukkan tidak valid atau kuota telah habis.');
        setIsSaving(false);
        return;
      }

      await setDoc(doc(primaryDb, 'system_settings', 'infrastructure'), {
        gemini_api_key: infraData.gemini_api_key,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      
      Alert.alert('Sukses', 'API Key Gemini valid dan berhasil disimpan secara terpisah!');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal', 'Terjadi kesalahan: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateFirebase = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(primaryDb, 'system_settings', 'infrastructure'), {
        fb_api_key: infraData.fb_api_key || '',
        fb_auth_domain: infraData.fb_auth_domain || '',
        fb_project_id: infraData.fb_project_id || '',
        fb_storage_bucket: infraData.fb_storage_bucket || '',
        fb_messaging_sender_id: infraData.fb_messaging_sender_id || '',
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      Alert.alert('Sukses', 'Konfigurasi Firebase Utama berhasil diperbarui!');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal', 'Terjadi kesalahan: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateInfra = async () => {"""

if 'handleUpdateGemini = async () =>' not in content:
    content = content.replace("  const handleUpdateInfra = async () => {", gemini_handler)

# 3. Update the UI for Gemini to use handleUpdateGemini
ui_gemini_target = """                {/* Gemini AI Config */}
                <View className="mt-4 p-4 rounded-2xl border bg-purple-500/5 border-purple-500/20">
                  <View className="flex-row items-center gap-2 mb-3">
                    <Sparkles size={16} color="#a855f7" />
                    <Text className="font-black text-xs uppercase tracking-widest text-purple-500">Konfigurasi Gemini AI</Text>
                  </View>
                  <View className="space-y-1">
                    <Text className="text-[8px] font-black uppercase tracking-wider text-slate-400">Gemini API Key</Text>
                    <TextInput
                      value={infraData.gemini_api_key || ''}
                      onChangeText={(txt) => setInfraData({ ...infraData, gemini_api_key: txt })}
                      secureTextEntry
                      placeholder="AIzaSy..."
                      placeholderTextColor={colors.textMuted}
                      className="p-3 border rounded-xl font-bold text-xs"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleUpdateInfra}
                  disabled={isSaving}
                  className="py-4 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: colors.accent }}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="font-black text-white text-xs uppercase tracking-wider">Simpan Kredensial</Text>
                  )}
                </TouchableOpacity>"""

ui_gemini_replacement = """                <TouchableOpacity
                  onPress={handleUpdateInfra}
                  disabled={isSaving}
                  className="py-4 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: colors.accent }}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="font-black text-white text-xs uppercase tracking-wider">Simpan Kredensial Cloudinary</Text>
                  )}
                </TouchableOpacity>

                {/* Gemini AI Config */}
                <View className="mt-6 p-4 rounded-2xl border bg-purple-500/5 border-purple-500/20">
                  <View className="flex-row items-center gap-2 mb-3">
                    <Sparkles size={16} color="#a855f7" />
                    <Text className="font-black text-xs uppercase tracking-widest text-purple-500">Konfigurasi Gemini AI</Text>
                  </View>
                  <View className="space-y-1 mb-4">
                    <Text className="text-[8px] font-black uppercase tracking-wider text-slate-400">Gemini API Key</Text>
                    <TextInput
                      value={infraData.gemini_api_key || ''}
                      onChangeText={(txt) => setInfraData({ ...infraData, gemini_api_key: txt })}
                      secureTextEntry
                      placeholder="AIzaSy..."
                      placeholderTextColor={colors.textMuted}
                      className="p-3 border rounded-xl font-bold text-xs"
                      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
                    />
                  </View>
                  
                  <TouchableOpacity
                    onPress={handleUpdateGemini}
                    disabled={isSaving}
                    className="py-3.5 rounded-xl items-center justify-center bg-purple-500 active:scale-95"
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text className="font-black text-white text-xs uppercase tracking-wider">Simpan & Validasi API Key</Text>
                    )}
                  </TouchableOpacity>
                </View>"""

if 'Simpan Kredensial Cloudinary' not in content:
    content = content.replace(ui_gemini_target, ui_gemini_replacement)

# 4. Update the Firebase button to use handleUpdateFirebase
ui_fb_target = """                <TouchableOpacity
                  onPress={handleUpdateInfra}
                  disabled={isSaving}
                  className="py-4 rounded-2xl items-center justify-center mt-2"
                  style={{ backgroundColor: colors.accent }}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="font-black text-white text-xs uppercase tracking-wider">Simpan Firebase Utama</Text>
                  )}
                </TouchableOpacity>"""

ui_fb_replacement = """                <TouchableOpacity
                  onPress={handleUpdateFirebase}
                  disabled={isSaving}
                  className="py-4 rounded-2xl items-center justify-center mt-2"
                  style={{ backgroundColor: colors.accent }}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="font-black text-white text-xs uppercase tracking-wider">Simpan Firebase Utama</Text>
                  )}
                </TouchableOpacity>"""

if 'onPress={handleUpdateFirebase}' not in content:
    content = content.replace(ui_fb_target, ui_fb_replacement)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("SuperAdminScreen patched successfully!")

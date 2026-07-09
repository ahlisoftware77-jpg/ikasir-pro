import sys
import re

file_path = 'mobile/src/screens/FeatureScreen.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import
import_target = "import { printReceipt, printA4, printServiceReceipt, printServiceA4, shareReceiptPDF, printServiceLabel } from '../utils/ReceiptHelper';"
if "generateProductInfoFromImage" not in content:
    content = content.replace(import_target, import_target + "\nimport { generateProductInfoFromImage } from '../utils/geminiHelper';")

# 2. Add state inside FeatureScreen
state_target = "const [search, setSearch] = useState('');"
if "isAutoFilling" not in content:
    content = content.replace(state_target, "const [isAutoFilling, setIsAutoFilling] = useState(false);\n  " + state_target)

# 3. Add handleAutoFill function before renderFormContent
handler_str = """
  const handleAutoFillWithAI = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Ditolak', 'Akses kamera dibutuhkan untuk memfoto barang.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (result.canceled || !result.assets[0].base64) {
        return;
      }

      setIsAutoFilling(true);
      const productInfo = await generateProductInfoFromImage(result.assets[0].base64);
      
      if (productInfo.name) setFormName(productInfo.name);
      if (productInfo.baseCost) setFormBaseCost(String(productInfo.baseCost));
      if (productInfo.price) setFormPrice(String(productInfo.price));
      // if category exists, try to map it or create it if needed, but for now we just use a generic 'Barang' or leave formCategory.
      Alert.alert('Sukses', 'AI berhasil menebak data produk!');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal Auto-Fill', err.message || 'Terjadi kesalahan saat memproses gambar.');
    } finally {
      setIsAutoFilling(false);
    }
  };

  const renderFormContent = () => {
"""
if "handleAutoFillWithAI" not in content:
    content = content.replace("  const renderFormContent = () => {", handler_str)

# 4. Insert Auto-Fill button into case 'estimasi' (which is the POS product form)
ui_target = """      case 'estimasi':
        return (
          <>
            {renderTextInput('Nama Menu / Resep', formName, setFormName, 'e.g. Nasi Goreng Spesial')}"""
ui_replacement = """      case 'estimasi':
        return (
          <>
            <TouchableOpacity 
              onPress={handleAutoFillWithAI}
              disabled={isAutoFilling}
              className="flex-row items-center justify-center gap-2 mb-4 py-3 rounded-xl border border-purple-500/20 bg-purple-500/10"
            >
              {isAutoFilling ? (
                <ActivityIndicator size="small" color="#a855f7" />
              ) : (
                <>
                  <Camera size={18} color="#a855f7" />
                  <Text className="text-xs font-black text-purple-500 uppercase tracking-widest">Auto-Fill via Foto (AI)</Text>
                </>
              )}
            </TouchableOpacity>
            {renderTextInput('Nama Menu / Resep', formName, setFormName, 'e.g. Nasi Goreng Spesial')}"""

if "Auto-Fill via Foto" not in content:
    content = content.replace(ui_target, ui_replacement)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched FeatureScreen for Auto-Fill")

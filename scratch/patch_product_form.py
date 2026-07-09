import sys

file_path = 'mobile/src/screens/ProductFormScreen.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
import_target = "import { collection, addDoc, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';"
if "generateProductInfoFromImage" not in content:
    content = content.replace(import_target, import_target + "\nimport { generateProductInfoFromImage } from '../utils/geminiHelper';")
    
if "Camera" not in content:
    content = content.replace("import { Trash2, Image as ImageIcon, Search, Tag, Box, Info, X, MapPin, Layers, DollarSign, UploadCloud, ChevronDown } from 'lucide-react-native';", "import { Trash2, Image as ImageIcon, Search, Tag, Box, Info, X, MapPin, Layers, DollarSign, UploadCloud, ChevronDown, Camera } from 'lucide-react-native';")
    
if "import * as ImagePicker" not in content:
    content = content.replace("import * as ImagePicker from 'expo-image-picker';", "")
    # Add it manually if not exists
    content = "import * as ImagePicker from 'expo-image-picker';\n" + content

# 2. Add state
state_target = "const [isSubmitting, setIsSubmitting] = useState(false);"
if "isAutoFilling" not in content:
    content = content.replace(state_target, state_target + "\n  const [isAutoFilling, setIsAutoFilling] = useState(false);")

# 3. Add handleAutoFill function
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
      
      setFormData(prev => ({
        ...prev,
        name: productInfo.name || prev.name,
        baseCost: productInfo.baseCost ? String(productInfo.baseCost) : prev.baseCost,
        price: productInfo.price ? String(productInfo.price) : prev.price,
        category: productInfo.category || prev.category
      }));
      
      Alert.alert('Sukses', 'AI berhasil menebak data produk!');
    } catch (err: any) {
      console.error(err);
      Alert.alert('Gagal Auto-Fill', err.message || 'Terjadi kesalahan saat memproses gambar.');
    } finally {
      setIsAutoFilling(false);
    }
  };

  const validateForm = () => {
"""
if "handleAutoFillWithAI" not in content:
    content = content.replace("  const validateForm = () => {", handler_str)

# 4. Insert UI button before "Nama Barang"
ui_target = """            {/* General Fields */}
            <View>"""
ui_replacement = """            {/* General Fields */}
            <View>
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
              </TouchableOpacity>"""

if "Auto-Fill via Foto" not in content:
    content = content.replace(ui_target, ui_replacement)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched ProductFormScreen for Auto-Fill")

import sys
import re

file_path = 'mobile/src/screens/FeatureScreen.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update filter logic
filter_target = "            (t.ticketNo || '').toLowerCase().includes(search.toLowerCase()) ||"
filter_replacement = "            (t.id || '').toLowerCase().includes(search.toLowerCase()) ||\n            (t.ticketNo || '').toLowerCase().includes(search.toLowerCase()) ||"

if "t.id" not in filter_target:
    content = content.replace(filter_target, filter_replacement)

# 2. Update TextInput onChangeText and add Scanner button
# First find the TextInput area
text_input_target = """                <TextInput
                  placeholder="Cari nama pelanggan, nomor tiket, S/N..."
                  placeholderTextColor={colors.textMuted}
                  value={search}
                  onChangeText={setSearch}
                  className="flex-1 font-bold text-xs"
                  style={{ color: colors.text }}
                />"""

text_input_replacement = """                <TextInput
                  placeholder="Cari nama pelanggan, nomor tiket, S/N..."
                  placeholderTextColor={colors.textMuted}
                  value={search}
                  onChangeText={(val) => {
                    let queryStr = val;
                    if (queryStr.includes('t=')) {
                      const match = queryStr.match(/[?&]t=([^&]+)/);
                      if (match && match[1]) {
                        queryStr = match[1];
                      }
                    }
                    setSearch(queryStr);
                  }}
                  className="flex-1 font-bold text-xs"
                  style={{ color: colors.text }}
                />
                <TouchableOpacity
                  onPress={async () => {
                    if (!cameraPermission?.granted) {
                      const res = await requestCameraPermission();
                      if (!res.granted) {
                        Alert.alert("Izin Ditolak", "Akses kamera dibutuhkan untuk scan QR code.");
                        return;
                      }
                    }
                    setShowServiceScanner(true);
                  }}
                  className="ml-2 w-8 h-8 rounded-lg items-center justify-center"
                  style={{ backgroundColor: colors.primary + '20' }}
                >
                  <Scan size={16} color={colors.primary} />
                </TouchableOpacity>"""

if "queryStr.includes('t=')" not in content:
    content = content.replace(text_input_target, text_input_replacement)

# 3. Add imports if needed
if "from 'expo-camera'" not in content:
    content = content.replace("import { View, Text", "import { CameraView, useCameraPermissions } from 'expo-camera';\nimport { View, Text")

if ", Scan" not in content.split("from 'lucide-react'")[0]:
    content = content.replace("from 'lucide-react'", ", Scan } from 'lucide-react'")

# 4. Add states if needed
if "showServiceScanner" not in content:
    content = content.replace(
        "const [search, setSearch] = useState('');",
        "const [search, setSearch] = useState('');\n  const [showServiceScanner, setShowServiceScanner] = useState(false);\n  const [cameraPermission, requestCameraPermission] = useCameraPermissions();"
    )

# 5. Add scanner modal
scanner_modal = """
      <Modal
        visible={showServiceScanner}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowServiceScanner(false)}
      >
        <View className="flex-1 bg-black/90 justify-center">
          <View className="absolute top-10 right-4 z-50">
            <TouchableOpacity 
              onPress={() => setShowServiceScanner(false)}
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
            >
              <X size={24} color="white" />
            </TouchableOpacity>
          </View>
          
          <View className="items-center mb-10 mt-20">
            <Text className="text-white font-bold text-lg mb-2">Scan QR Tiket Servis</Text>
            <Text className="text-slate-300 text-xs text-center px-10">Arahkan kamera ke QR code yang tertera pada label servis</Text>
          </View>

          <View className="h-[400px] w-full items-center justify-center overflow-hidden">
            <CameraView
              style={{ width: '100%', height: '100%' }}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'code128', 'ean13', 'ean8', 'upc_e'],
              }}
              onBarcodeScanned={(result) => {
                if (result.data) {
                  let queryStr = result.data;
                  if (queryStr.includes('t=')) {
                    const match = queryStr.match(/[?&]t=([^&]+)/);
                    if (match && match[1]) {
                      queryStr = match[1];
                    }
                  }
                  setSearch(queryStr);
                  setShowServiceScanner(false);
                }
              }}
            />
            <View className="absolute w-[250px] h-[250px] border-2 border-emerald-500 rounded-3xl" />
          </View>
        </View>
      </Modal>
"""

# Insert right before export default FeatureScreen;
if "Scan QR Tiket Servis" not in content:
    content = content.replace("export default FeatureScreen;", scanner_modal + "\nexport default FeatureScreen;")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated successfully")

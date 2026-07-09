import sys
import re

file_path = 'mobile/src/screens/FeatureScreen.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import for CameraView
if "from 'expo-camera'" not in content:
    content = content.replace("import { View, Text", "import { CameraView, useCameraPermissions } from 'expo-camera';\nimport { View, Text")

# 2. Add state for scanner and permissions
if "showServiceScanner" not in content:
    content = content.replace(
        "const [serviceSearch, setServiceSearch] = useState('');",
        "const [serviceSearch, setServiceSearch] = useState('');\n  const [showServiceScanner, setShowServiceScanner] = useState(false);\n  const [cameraPermission, requestCameraPermission] = useCameraPermissions();"
    )

# 3. Add the scanner button next to the TextInput
# Find the specific TextInput for service search
# <TextInput
#   className="flex-1 text-xs font-bold text-slate-800 dark:text-slate-200"
#   placeholder="Cari nama pelanggan, nomor tiket, S/N..."
search_input = """<TextInput
                  className="flex-1 text-xs font-bold text-slate-800 dark:text-slate-200"
                  placeholder="Cari nama pelanggan, nomor tiket, S/N..."
                  placeholderTextColor="#94a3b8"
                  value={serviceSearch}
                  onChangeText={setServiceSearch}
                />"""

scanner_btn = """
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
                  className="w-10 h-10 items-center justify-center bg-emerald-500/10 rounded-xl border border-emerald-500/20 ml-2"
                >
                  <Scan size={18} className="text-emerald-500" />
                </TouchableOpacity>
"""

content = content.replace(search_input, search_input + scanner_btn)

# Add Scan to lucide-react imports if not there
if "Scan" not in content.split("from 'lucide-react'")[0]:
    content = content.replace("from 'lucide-react'", ", Scan } from 'lucide-react'")

# 4. Add the Scanner Modal at the end of the file (before export default FeatureScreen;)
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
                  // If it's a URL, extract the t parameter
                  let queryStr = result.data;
                  if (queryStr.includes('t=')) {
                    const match = queryStr.match(/[?&]t=([^&]+)/);
                    if (match && match[1]) {
                      queryStr = match[1];
                    }
                  }
                  setServiceSearch(queryStr);
                  setShowServiceScanner(false);
                }
              }}
            />
            <View className="absolute w-[250px] h-[250px] border-2 border-emerald-500 rounded-3xl" />
          </View>
        </View>
      </Modal>
"""

content = content.replace("    </KeyboardAvoidingView>", scanner_modal + "\n    </KeyboardAvoidingView>")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

# Now fix ReceiptHelper.ts
receipt_path = 'mobile/src/utils/ReceiptHelper.ts'
with open(receipt_path, 'r', encoding='utf-8') as f:
    r_content = f.read()

r_content = r_content.replace(
    '  return `\n    <html>',
    '  const trackLink = `https://ikasir.my.id/tr/service?t=${ticket.id}&s=${ticket.storeId || \'\'}`;\n  return `\n    <html>'
)

r_content = r_content.replace(
    'src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(ticket.id)}"',
    'src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(trackLink)}"'
)

with open(receipt_path, 'w', encoding='utf-8') as f:
    f.write(r_content)

print("Updated FeatureScreen and ReceiptHelper!")

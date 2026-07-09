import sys
import re

file_path = 'mobile/src/screens/FeatureScreen.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

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

# Insert right before </SafeAreaView>
if "Scan QR Tiket Servis" not in content:
    content = content.replace("    </SafeAreaView>\n  );\n}", scanner_modal + "\n    </SafeAreaView>\n  );\n}")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Added missing scanner modal")

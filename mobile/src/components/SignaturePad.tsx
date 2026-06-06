import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import SignatureScreen from 'react-native-signature-canvas';

interface Props {
  onOK: (signature: string) => void;
  onCancel: () => void;
}

export default function SignaturePad({ onOK, onCancel }: Props) {
  const ref = useRef<any>(null);

  const handleOK = (signature: string) => {
    // Return base64 string
    onOK(signature);
  };

  const handleClear = () => {
    ref.current?.clearSignature();
  };

  const handleConfirm = () => {
    ref.current?.readSignature();
  };

  const style = `
    .m-signature-pad {
      box-shadow: none; border: none;
    } 
    .m-signature-pad--body { border: none; }
    .m-signature-pad--footer { display: none; margin: 0px; }
    body,html {
      width: 100%; height: 100%; margin: 0; padding: 0;
    }
  `;

  return (
    <View style={styles.container}>
      <View style={styles.canvasContainer}>
        <SignatureScreen
          ref={ref}
          onOK={handleOK}
          webStyle={style}
          backgroundColor="#ffffff"
          penColor="#0f172a"
        />
      </View>
      <View style={styles.actionContainer}>
        <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={onCancel}>
          <Text style={styles.btnTextCancel}>BATAL</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnClear]} onPress={handleClear}>
          <Text style={styles.btnTextClear}>BERSIHKAN</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnConfirm]} onPress={handleConfirm}>
          <Text style={styles.btnTextConfirm}>SIMPAN</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    overflow: 'hidden',
  },
  canvasContainer: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    gap: 8,
    backgroundColor: '#ffffff'
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  btnCancel: {
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  btnTextCancel: {
    color: '#64748b',
    fontWeight: 'bold',
    fontSize: 12,
  },
  btnClear: {
    borderColor: '#fbbf24',
    backgroundColor: '#fffbeb',
  },
  btnTextClear: {
    color: '#d97706',
    fontWeight: 'bold',
    fontSize: 12,
  },
  btnConfirm: {
    borderColor: '#10b981',
    backgroundColor: '#10b981',
  },
  btnTextConfirm: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  }
});

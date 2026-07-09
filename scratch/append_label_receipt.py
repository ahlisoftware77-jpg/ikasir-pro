import sys

code = """
export const printServiceLabelViaBluetooth = async (ticket: any, storeSettings?: any) => {
  if (!BluetoothEscposPrinter) {
    throw new Error('Bluetooth printer module is not available');
  }

  const storeName = storeSettings?.storeName || 'KASIR PRO';
  const cleanStoreName = storeName.includes('@') ? storeName.split('@')[0] : storeName;
  const is80mm = storeSettings?.paperSize === '80mm';

  let dateStr = '';
  if (ticket.createdAt?.seconds) {
    const d = new Date(ticket.createdAt.seconds * 1000);
    dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  } else {
    const d = new Date();
    dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  const W = is80mm ? 48 : 32;
  const divider = '-'.repeat(W);
  const lr = (left: string, right: string) => {
    let spaces = W - left.length - right.length;
    if (spaces < 1) spaces = 1;
    return left + ' '.repeat(spaces) + right;
  };

  await BluetoothEscposPrinter.printerInit();
  await BluetoothEscposPrinter.printerLeftSpace(0);
  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
  await BluetoothEscposPrinter.setBlob(0);
  
  await BluetoothEscposPrinter.printText(`\\n\\r`, {});
  await BluetoothEscposPrinter.printText(`${divider}\\n\\r`, {});
  await BluetoothEscposPrinter.printText(`LABEL SERVIS\\n\\r`, { fonttype: 1 });
  await BluetoothEscposPrinter.printText(`${divider}\\n\\r`, {});
  
  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
  await BluetoothEscposPrinter.printText(lr('Tiket:', ticket.ticketNo || `ST-${ticket.id.substring(0,8).toUpperCase()}`) + '\\n\\r', {});
  await BluetoothEscposPrinter.printText(lr('Tgl:', dateStr) + '\\n\\r', {});
  await BluetoothEscposPrinter.printText(lr('Cust:', ticket.customerName || 'Umum') + '\\n\\r', {});
  await BluetoothEscposPrinter.printText(lr('Brg:', ticket.deviceModel || '-') + '\\n\\r', {});
  await BluetoothEscposPrinter.printText(`${divider}\\n\\r`, {});

  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
  try {
    const trackLink = `https://ikasir.my.id/tr/service?t=${ticket.id}&s=${ticket.storeId || ''}`;
    await BluetoothEscposPrinter.printQRCode(trackLink, is80mm ? 250 : 180, 1);
    await BluetoothEscposPrinter.printText('\\n\\r', {});
  } catch (qrErr) {
    console.warn("Bluetooth QR code print failed:", qrErr);
  }
  
  await BluetoothEscposPrinter.printText(`${divider}\\n\\r`, {});
  await BluetoothEscposPrinter.printText(`\\n\\r\\n\\r\\n\\r`, {});
};

export const printServiceLabel = async (ticket: any, storeSettings?: any) => {
  let settings = storeSettings;

  if (ticket?.storeId) {
    try {
      const { db } = require('../lib/firebase');
      const { doc, getDoc } = require('firebase/firestore');
      const docSnap = await getDoc(doc(db, 'settings', `store_${ticket.storeId}`));
      if (docSnap.exists()) {
        settings = { ...settings, ...docSnap.data() };
      }
    } catch (err) {
      console.warn("Failed to fetch settings from Firestore in printServiceLabel:", err);
    }
  }

  if (hasBluetoothNativeModule && BluetoothEscposPrinter) {
    try {
      const activePrinterAddress = await AsyncStorage.getItem('selected_printer_address');
      const activePrinter = await AsyncStorage.getItem('selected_printer');
      
      if (activePrinterAddress && BluetoothManager) {
        if (Platform.OS === 'android') {
          ToastAndroid.show('Menghubungkan & mencetak label...', ToastAndroid.SHORT);
        }
        try {
          await BluetoothManager.connect(activePrinterAddress);
          await new Promise((res) => setTimeout(res, 500));
        } catch (connErr) {
          console.warn('Bluetooth auto-connection failed, trying to print anyway:', connErr);
        }
        await printServiceLabelViaBluetooth(ticket, settings);
        if (Platform.OS === 'android') {
          ToastAndroid.show('Label berhasil dicetak!', ToastAndroid.SHORT);
        } else {
          Alert.alert('Sukses', 'Label berhasil dicetak!');
        }
        return;
      } else if (activePrinter) {
        if (Platform.OS === 'android') {
          ToastAndroid.show('Mencetak label...', ToastAndroid.SHORT);
        }
        await printServiceLabelViaBluetooth(ticket, settings);
        if (Platform.OS === 'android') {
          ToastAndroid.show('Label berhasil dicetak!', ToastAndroid.SHORT);
        } else {
          Alert.alert('Sukses', 'Label berhasil dicetak!');
        }
        return;
      }
    } catch (error) {
      console.error('Direct Bluetooth service label print failed:', error);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Cetak langsung gagal. Pastikan printer terhubung.', ToastAndroid.LONG);
      } else {
        Alert.alert('Info', 'Cetak langsung gagal. Pastikan printer terhubung.');
      }
    }
  } else {
    Alert.alert('Info', 'Fitur cetak label QR saat ini hanya mendukung printer Bluetooth langsung dari aplikasi.');
  }
};
"""

with open('mobile/src/utils/ReceiptHelper.ts', 'a', encoding='utf-8') as f:
    f.write(code)
print("done")

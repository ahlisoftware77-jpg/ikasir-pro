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

  await BluetoothEscposPrinter.printerInit();
  await BluetoothEscposPrinter.printerLeftSpace(0);
  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
  await BluetoothEscposPrinter.setBlob(0);
  
  await BluetoothEscposPrinter.printText(`\\n\\r`, {});
  await BluetoothEscposPrinter.printText(`${cleanStoreName}\\n\\r`, { fonttype: 1 });
  await BluetoothEscposPrinter.printText(`ID: ${ticket.ticketNo || `ST-${ticket.id.substring(0,8).toUpperCase()}`}\\n\\r`, {});
  await BluetoothEscposPrinter.printText(`Tgl: ${dateStr}\\n\\r`, {});
  await BluetoothEscposPrinter.printText(`Plg: ${ticket.customerName || 'Umum'}\\n\\r`, {});
  await BluetoothEscposPrinter.printText(`Unit: ${ticket.deviceModel}\\n\\r`, {});
  
  try {
    await BluetoothEscposPrinter.printQRCode(ticket.id, is80mm ? 250 : 200, 1);
    await BluetoothEscposPrinter.printText('\\n\\r', {});
  } catch (qrErr) {
    console.warn("Bluetooth QR code print failed:", qrErr);
  }
  
  await BluetoothEscposPrinter.printText(`\\n\\r\\n\\r\\n\\r`, {});
};

export const generateServiceLabelHtml = (ticket: any, storeSettings?: any) => {
  const storeName = storeSettings?.storeName || 'KASIR PRO';
  const cleanStoreName = storeName.includes('@') ? storeName.split('@')[0] : storeName;
  
  let dateStr = '';
  if (ticket.createdAt?.seconds) {
    const d = new Date(ticket.createdAt.seconds * 1000);
    dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  } else {
    const d = new Date();
    dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }
  
  return `
    <html>
      <head>
        <style>
          body { font-family: monospace; text-align: center; margin: 0; padding: 10px; }
          h2 { margin: 5px 0; font-size: 16px; }
          p { margin: 2px 0; font-size: 12px; }
          .qr-container { margin: 10px 0; }
          img { width: 150px; height: 150px; }
        </style>
      </head>
      <body>
        <h2>${cleanStoreName}</h2>
        <p>ID: ${ticket.ticketNo || `ST-${ticket.id.substring(0,8).toUpperCase()}`}</p>
        <p>Tgl: ${dateStr}</p>
        <p>Plg: ${ticket.customerName || 'Umum'}</p>
        <p>Unit: ${ticket.deviceModel}</p>
        <div class="qr-container">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(ticket.id)}" />
        </div>
      </body>
    </html>
  `;
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
      console.error('Direct Bluetooth service label print failed, falling back to PDF preview:', error);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Cetak langsung gagal, mengalihkan ke cetak HTML...', ToastAndroid.LONG);
      } else {
        Alert.alert('Info', 'Cetak langsung gagal, mengalihkan ke cetak HTML...');
      }
    }
  }

  try {
    const html = generateServiceLabelHtml(ticket, settings);
    await Print.printAsync({ html });
  } catch (error) {
    console.error('Error printing service label:', error);
  }
};
"""

with open('mobile/src/utils/ReceiptHelper.ts', 'a', encoding='utf-8') as f:
    f.write(code)
print("done")

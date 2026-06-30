import { Transaction } from '@/types';
import toast from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuthStore } from '@/store/auth';

const checkSubscriptionExpired = async (storeId: string | null | undefined): Promise<boolean> => {
  if (!storeId) return true;
  try {
    const q = query(collection(db, 'users'), where('storeId', '==', storeId));
    const userSnaps = await getDocs(q);
    
    if (userSnaps.empty) {
      return true;
    }
    
    const now = new Date();
    let hasActiveSub = false;
    userSnaps.forEach((userDoc) => {
      const uData = userDoc.data();
      if (uData.validUntil) {
        const d = new Date(uData.validUntil);
        if (!isNaN(d.getTime()) && d > now) {
          hasActiveSub = true;
        }
      }
    });
    
    return !hasActiveSub;
  } catch (err) {
    console.warn("Failed to check subscription from Firestore:", err);
    try {
      return useAuthStore.getState().isSubscriptionExpired;
    } catch (storeErr) {
      return true;
    }
  }
};

const fetchProductsMap = async (storeId: string | null | undefined): Promise<Record<string, any>> => {
  if (!storeId) return {};
  const pMap: Record<string, any> = {};
  try {
    const qProds = query(collection(db, 'products'), where('storeId', '==', storeId));
    const prodsSnap = await getDocs(qProds);
    prodsSnap.forEach((d) => {
      const data = d.data();
      pMap[d.id] = data;
      if (data.name) {
        pMap[data.name] = data;
      }
    });
  } catch (err) {
    console.warn("Failed to fetch products for dynamic warranty:", err);
  }
  return pMap;
};

const urlToBase64 = (url: string): Promise<string> => {
  return new Promise((resolve) => {
    if (!url || url.startsWith('data:')) return resolve(url);
    
    let finalUrl = url;
    if (url.startsWith('/')) {
       finalUrl = window.location.origin + url;
    }

    const img = new Image();
    img.crossOrigin = "anonymous"; 
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Fill background with WHITE (essential for thermal printers to avoid transparency issues)
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          // PURE BLACK & WHITE THRESHOLDING
          // Thermal printers can't handle colors well. We force everything to black or white.
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
             const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
             // If brightness > 180, make it pure white, otherwise pure black
             const color = avg > 180 ? 255 : 0;
             data[i] = data[i+1] = data[i+2] = color;
             data[i+3] = 255; // Force opacity
          }
          ctx.putImageData(imageData, 0, 0);
          
          // Use JPEG to ensure no Alpha channel
          resolve(canvas.toDataURL("image/jpeg", 0.9));
        } else {
          resolve(url);
        }
      } catch (e) {
        resolve(url);
      }
    };
    img.onerror = () => resolve(url);
    img.src = finalUrl;
  });
};

export const printReceipt = async (trx: Transaction, storeSettings: any, branding?: any) => {
  const productsMap = await fetchProductsMap(trx.storeId);
  
  let wStartDate: Date | null = null;
  const trxDate = trx.timestamp?.toDate ? trx.timestamp.toDate() : new Date();
  if (trx.paymentHistory && trx.paymentHistory.length > 0) {
    const sorted = [...trx.paymentHistory].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    wStartDate = new Date(sorted[0].date);
  } else if ((trx.paidAmount ?? trx.cashReceived ?? 0) > 0 || trx.paymentStatus === 'paid') {
    wStartDate = trxDate;
  }

  const isExpired = await checkSubscriptionExpired(trx.storeId);
  const is80mm = storeSettings.paperSize === '80mm';
  const paperWidth = is80mm ? '300px' : '220px'; // Approx width for browser
  const fontSize = is80mm ? '14px' : '12px';
  
  // 0. Pre-convert images to Base64 to avoid CORS/Load issues in print window
  let logoData = storeSettings.thermalLogoUrl || storeSettings.logoUrl || '';
  let signatureData = storeSettings.signatureUrl || '';

  if (storeSettings.showLogoOnReceipt !== false && logoData && logoData.startsWith('http')) {
     logoData = await urlToBase64(logoData);
  }
  if (storeSettings.showSignature && signatureData && signatureData.startsWith('http')) {
     signatureData = await urlToBase64(signatureData);
  }

  // Format date
  const formatDate = (date: Date) => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${d}/${m}/${y} ${h}:${min}:${s}`;
  };
  const dateStr = trx.timestamp?.toDate 
    ? formatDate(trx.timestamp.toDate())
    : formatDate(new Date());

  // Android Device detection for specialized fallbacks
  const isAndroid = /Android/i.test(navigator.userAgent);

  // Helper to wrap text into multiple lines and center each
  const wrapCenter = (str: string, length: number) => {
    if (!str) return '';
    
    // Split into lines first based on existing newlines
    const inputLines = str.split('\n');
    const resultLines: string[] = [];

    inputLines.forEach(inputLine => {
        const words = inputLine.trim().split(/\s+/);
        let currentLine = '';

        words.forEach(word => {
            if (!word) return;
            const newContent = currentLine ? currentLine + ' ' + word : word;
            if (newContent.length <= length) {
                currentLine = newContent;
            } else {
                if (currentLine) resultLines.push(currentLine);
                // If a single word is longer than the limit, we have to break it or just let it be
                currentLine = word;
            }
        });
        if (currentLine) resultLines.push(currentLine);
    });

    // Center each line with exact padding
    return resultLines.map(line => {
      const trimmed = line.trim();
      if (trimmed.length >= length) return trimmed.substring(0, length);
      const totalPad = length - trimmed.length;
      const leftPad = Math.floor(totalPad / 2);
      const rightPad = totalPad - leftPad;
      return ' '.repeat(leftPad) + trimmed + ' '.repeat(rightPad);
    }).join('\n');
  };

  // 1. Create plain text for Thermal Printers (ESC/POS style)
  const width = is80mm ? 42 : 32;
  const hr = '-'.repeat(width) + '\n';
  let text = '';
  
  // Clean store name from email if needed
  const rawStoreName = storeSettings.storeName || branding?.appName || 'IKASIR PRO';
  const cleanStoreName = rawStoreName.includes('@') ? rawStoreName.split('@')[0] : rawStoreName;
  
  // ESC/POS Commands for Bold (Works on most thermal printers)
  const BOLD_ON = '\x1B\x45\x01';
  const BOLD_OFF = '\x1B\x45\x00';
  const DOUBLE_HEIGHT = '\x1B\x21\x10'; // Double height
  const RESET = '\x1B\x21\x00'; // Normal

  const isEstimation = (trx as any).isEstimation;

  // Use Bold for thermal title
  text += `${BOLD_ON}${wrapCenter(isEstimation ? 'ESTIMASI BIAYA' : cleanStoreName.toUpperCase(), width)}${BOLD_OFF}\n`;
  if (isEstimation) {
    text += `${wrapCenter(cleanStoreName, width)}\n`;
  }
  if (storeSettings.showReceiptAddress !== false && storeSettings.address) text += `${wrapCenter(storeSettings.address, width)}\n`;
  if (storeSettings.showReceiptPhone !== false && storeSettings.phone) text += `${wrapCenter(storeSettings.phone, width)}\n`;
  text += `${hr}`;
  
  text += `Wkt: ${dateStr}\n`;
  text += `ID : ${trx.id?.substring(0, 12)}\n`;
  if (isEstimation && (trx as any).validUntil) {
    const vDate = new Date((trx as any).validUntil).toLocaleDateString('id-ID', {day: '2-digit', month: '2-digit', year: '2-digit'});
    text += `Berlaku s/d: ${vDate}\n`;
  }
  
  if (storeSettings.showReceiptCashier !== false) {
    const rawCashier = trx.cashierName || 'Online';
    const cleanCashier = rawCashier.includes('@') ? rawCashier.split('@')[0] : rawCashier;
    text += `Ksr: ${cleanCashier}\n`;
  }
  
  if (storeSettings.showReceiptCustomer !== false && trx.customerName && trx.customerName !== 'Tanpa Nama') {
    text += `Pmsn: ${trx.customerName}\n`;
  }
  if (trx.queueNumber) {
    text += `Antr: #${trx.queueNumber}\n`;
  }

  text += `${hr}`;
  
  trx.items.forEach(item => {
    text += `${item.productName}\n`;
    if (item.selectedExtras?.length) {
      item.selectedExtras.forEach(ext => {
         text += ` + ${ext.optionName} ${ext.price > 0 ? `(Rp${ext.price})` : ''}\n`;
      });
    }
    // Resolve dynamic warranty duration/unit from catalog
    const prodId = item.productId;
    const prodName = item.productName || (item as any).name;
    let catalogProduct = null;
    if (prodId && productsMap[prodId]) {
      catalogProduct = productsMap[prodId];
    } else if (prodName && productsMap[prodName]) {
      catalogProduct = productsMap[prodName];
    }

    let duration = 0;
    let unit = 'months';
    if (catalogProduct && catalogProduct.warrantyDuration) {
      duration = catalogProduct.warrantyDuration;
      unit = catalogProduct.warrantyUnit || 'months';
    } else {
      duration = (item as any).warrantyDuration || 0;
      unit = (item as any).warrantyUnit || 'months';
    }

    let expiryStr = '';
    if (item.warrantyExpiry) {
      expiryStr = new Date(item.warrantyExpiry).toLocaleDateString('id-ID', {day: '2-digit', month: '2-digit', year: '2-digit'});
    } else if (duration > 0 && wStartDate) {
      const expDate = new Date(wStartDate);
      if (unit === 'days') expDate.setDate(expDate.getDate() + duration);
      else if (unit === 'months') expDate.setMonth(expDate.getMonth() + duration);
      else if (unit === 'years') expDate.setFullYear(expDate.getFullYear() + duration);
      expiryStr = expDate.toLocaleDateString('id-ID', {day: '2-digit', month: '2-digit', year: '2-digit'});
    }

    if (expiryStr) {
      text += ` [Garansi s/d: ${expiryStr}]\n`;
    } else if (duration > 0) {
      text += ` [Garansi: ${duration} ${unit === 'days' ? 'Hr' : unit === 'months' ? 'Bln' : 'Thn'} (Non-aktif)]\n`;
    }
    if (item.note) text += `${wrapCenter(`( ${item.note} )`, width)}\n`;
    
    const left = `${item.qty}x${item.price.toLocaleString('id-ID')}`;
    const right = item.subtotal.toLocaleString('id-ID');
    
    if (item.discountName) {
      text += ` (PROMO: ${item.discountName.toUpperCase()})\n`;
      const origL = ` Harga Normal: Rp${(item.originalPrice || item.price).toLocaleString('id-ID')}`;
      text += `${origL}\n`;
    }

    const spaces = width - left.length - right.length;
    text += left + (spaces > 0 ? ' '.repeat(spaces) : ' ') + right + '\n';
  });
  
  text += `${hr}`;
  
  if (storeSettings.showReceiptSubtotal !== false) {
    const subL = 'Subtotal:';
    const subR = (trx.total - (trx.tax || 0)).toLocaleString('id-ID');
    text += subL + ' '.repeat(width - subL.length - subR.length) + subR + '\n';
  }
  
  if (trx.tax) {
     const taxL = 'PPN:';
     const taxR = trx.tax.toLocaleString('id-ID');
     text += taxL + ' '.repeat(width - taxL.length - taxR.length) + taxR + '\n';
  }
  text += `${hr}`;
  const totL = 'TOTAL:';
  const totR = `Rp ${trx.total.toLocaleString('id-ID')}`;
  text += totL + ' '.repeat(width - totL.length - totR.length) + totR + '\n';
  
  const cashVal = (trx as any).cashReceived || ((trx as any).change !== undefined ? (trx as any).change + trx.total : 0);
  const changeVal = (trx as any).change !== undefined ? (trx as any).change : (cashVal > trx.total ? cashVal - trx.total : 0);

  if (!isEstimation) {
    if (trx.paymentCategory === 'debt' || trx.paymentStatus === 'partially_paid' || (trx.paymentHistory && trx.paymentHistory.length > 0)) {
      text += wrapCenter("RIWAYAT PEMBAYARAN", width) + "\n";
      trx.paymentHistory?.forEach((hist: any) => {
         const dateStr = new Date(hist.date).toLocaleDateString('id-ID', {day: '2-digit', month: '2-digit'});
         const left = `${dateStr} ${hist.note || 'Bayar'}`;
         const right = hist.amount.toLocaleString('id-ID');
         const spaces = width - left.length - right.length;
         text += left + (spaces > 0 ? ' '.repeat(spaces) : ' ') + right + '\n';
      });
      
      text += `${hr}`;
      const paidL = 'TOTAL BAYAR:';
      const paidR = (trx.paidAmount ?? trx.cashReceived ?? 0).toLocaleString('id-ID');
      text += paidL + ' '.repeat(Math.max(1, width - paidL.length - paidR.length)) + paidR + '\n';
      
      const remaining = trx.total - (trx.paidAmount ?? trx.cashReceived ?? 0);
      if (remaining > 0) {
        const sisaL = 'SISA PIUTANG:';
        const sisaR = remaining.toLocaleString('id-ID');
        text += sisaL + ' '.repeat(Math.max(1, width - sisaL.length - sisaR.length)) + sisaR + '\n';
      }
    } else if (trx.paymentMethod?.toUpperCase() === 'CASH' && cashVal > 0) {
      const cashL = 'Tunai:';
      const cashR = cashVal.toLocaleString('id-ID');
      text += cashL + ' '.repeat(width - cashL.length - cashR.length) + cashR + '\n';
      
      const changeL = 'Kembali:';
      const changeR = changeVal.toLocaleString('id-ID').replace('-', '');
      text += changeL + ' '.repeat(width - changeL.length - changeR.length) + changeR + '\n';
    }
  }
  
  text += `\n${wrapCenter(isEstimation ? '[ DOKUMEN PENAWARAN ]' : `[ ${trx.paymentStatus === 'paid' ? 'LUNAS' : 'BELUM LUNAS'} - ${trx.paymentMethod || '-'} ]`, width)}\n`;
  text += `${hr}`;
  text += `${wrapCenter(storeSettings.receiptMessage || 'Terima Kasih', width)}\n`;
  if (isExpired && branding?.receiptWatermark) {
    text += `\n${wrapCenter(branding.receiptWatermark, width)}\n`;
  }

  // 2. ATTEMPT WEB BLUETOOTH (ALL PLATFORMS)
  try {
    // @ts-ignore
    if (navigator.bluetooth) {
      let device: any = (window as any)._kasirProBTDevice || null;
      let server: any = (window as any)._kasirProBTServer || null;

      if (device && server && server.connected) {
         console.log("Using active Bluetooth connection");
      } else {
         server = null;
      }

      if (!server) {
        const connectToast = toast.loading("Menyambungkan printer...");
        try {
           if (device && device.gatt) {
               server = await device.gatt.connect();
           } else if (typeof (navigator as any).bluetooth.getDevices === 'function') {
               const devices = await (navigator as any).bluetooth.getDevices();
               for (const d of devices) {
                 try {
                   server = await d.gatt?.connect();
                   device = d;
                   break;
                 } catch(ex) {}
               }
           }
           toast.dismiss(connectToast);
        } catch(e) {
          toast.dismiss(connectToast);
        }
      }

      if (!device || !server) {
        const connectToast = toast.loading("Memindai Printer Bluetooth...");
        try {
          // @ts-ignore
          device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [
              '000018f0-0000-1000-8000-00805f9b34fb',
              'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
              '0000fee7-0000-1000-8000-00805f9b34fb',
              '49535343-fe7d-4ae5-8fa9-9fafd205e455'
            ]
          });
          toast.loading("Menyambungkan...", { id: connectToast });
          server = await device.gatt?.connect();
          toast.dismiss(connectToast);
        } catch (err) {
          toast.dismiss(connectToast);
          if ((err as Error).name === 'NotFoundError') {
             console.log("User cancelled bluetooth scan");
          } else {
             throw err;
          }
        }
      }

      if (server && server.connected) {
        (window as any)._kasirProBTDevice = device;
        (window as any)._kasirProBTServer = server;

        const services = await server.getPrimaryServices();
        let printChar: any = null;

        for (const service of services) {
          try {
            const characteristics = await service.getCharacteristics();
            for (const char of characteristics) {
              if (char.properties.write || char.properties.writeWithoutResponse) {
                printChar = char;
                break;
              }
            }
          } catch(e) {}
          if (printChar) break;
        }

        if (printChar) {
          const printToast = toast.loading("Mencetak Struk...");
          try {
            const encoder = new TextEncoder();
            const initCmd = new Uint8Array([0x1B, 0x40]);
            await printChar.writeValue(initCmd);
            const data = encoder.encode(text + '\n\n\n\n');
            const CHUNK_SIZE = 100;
            for (let i = 0; i < data.length; i += CHUNK_SIZE) {
              const chunk = data.slice(i, i + CHUNK_SIZE);
              await printChar.writeValue(chunk);
            }
            toast.success("Berhasil Dicetak!", { id: printToast });
            return; 
          } catch (e) {
            toast.error("Gagal Mencetak", { id: printToast });
          }
        }
      }
    }
  } catch (e) {
    console.error('Bluetooth flow failed:', e);
  }

  // 3. ANDROID SHARE FALLBACK
  if (isAndroid && navigator.share) {
    try {
      await navigator.share({
        title: `Struk_${trx.id}`,
        text: text
      });
      return; 
    } catch(err) {}
  }

  // Helper to split multi-line text into centered div blocks
  const renderCenteredLines = (str: string, className = '') => {
    if (!str) return '';
    return str.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `<div class="${className} text-center" style="width: 100%; text-align: center; white-space: pre-wrap; word-wrap: break-word;">${line}</div>`)
      .join('');
  };

  // Fallback to traditional Browser html Print for Windows/Mac/iOS
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Cetak Struk #${trx.id}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Playfair+Display:wght@700;900&family=Oswald:wght@700&family=Outfit:wght@700;900&display=swap" rel="stylesheet">
      <style>
        @font-face {
          font-family: 'Railey';
          src: url('/fonts/Railey-PersonalUse.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
        @font-face {
          font-family: 'Lovelo';
          src: url('/fonts/Lovelo-LineBold.ttf') format('truetype');
          font-weight: 700;
          font-style: normal;
        }
        @font-face {
          font-family: 'Lovelo';
          src: url('/fonts/Lovelo-Black.ttf') format('truetype');
          font-weight: 900;
          font-style: normal;
        }
        @font-face {
          font-family: 'Cheque';
          src: url('/fonts/Cheque-Regular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
        @font-face {
          font-family: 'Cheque';
          src: url('/fonts/Cheque-Black.ttf') format('truetype');
          font-weight: 900;
          font-style: normal;
        }

        @media print {
          @page { margin: 0; }
          body { margin: 0; }
        }
        body {
          font-family: 'Courier New', Courier, monospace;
          width: ${paperWidth};
          margin: 0 auto;
          color: #000;
          font-size: ${fontSize};
          line-height: 1.4;
          padding: 10px;
        }
        .text-center { text-align: center; width: 100%; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
        .flex { display: flex; justify-content: space-between; }
        table { width: 100%; border-collapse: collapse; }
        td { vertical-align: top; }
        .mb-1 { margin-bottom: 4px; }
        .mt-2 { margin-top: 8px; }
        .store-name { 
          font-size: calc(${fontSize} + 6px); 
          margin-bottom: 4px; 
          text-align: center; 
          width: 100%;
          line-height: 1.2;
          font-family: ${(() => {
            switch(storeSettings.storeNameFont) {
              case 'serif': return "'Playfair Display', Georgia, serif";
              case 'mono': return "'Courier New', Courier, monospace";
              case 'elegant': return "'Outfit', sans-serif";
              case 'bold': return "'Oswald', sans-serif";
              case 'railey': return "'Railey', cursive";
              case 'cheque': return "'Cheque', sans-serif";
              case 'lovelo': return "'Lovelo', sans-serif";
              default: return "'Inter', sans-serif";
            }
          })()};
          ${(() => {
            switch(storeSettings.storeNameFont) {
              case 'railey':
                return "font-weight: normal; text-transform: none; font-size: calc(" + fontSize + " + 8px);";
              case 'elegant':
                return "font-weight: 300; text-transform: uppercase; letter-spacing: 0.05em;";
              case 'bold':
                return "font-weight: 900; text-transform: uppercase; letter-spacing: -0.02em;";
              case 'lovelo':
                return "font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;";
              case 'cheque':
                return "font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em;";
              default:
                return "font-weight: 900; text-transform: uppercase;";
            }
          })()};
        }
        .store-info { font-size: ${fontSize}; text-align: center; width: 100%; margin-bottom: 2px; white-space: pre-wrap; }
        .item-note { font-size: calc(${fontSize} - 2px); color: #555; text-align: center; font-style: italic; padding: 2px 0; white-space: pre-wrap; }
      </style>
    </head>
    <body>
      <div class="text-center" style="margin-bottom: 8px; width: 100%; text-align: center;">
        ${storeSettings.showLogoOnReceipt !== false ? `
          <div style="margin-bottom: 10px; width: 100%; text-align: center;">
            <img src="${logoData || '/logo.png'}" style="width: 100px; height: auto; display: inline-block; filter: grayscale(100%) contrast(1.8) brightness(1.1);" />
          </div>
        ` : ''}
        ${renderCenteredLines(cleanStoreName.toUpperCase(), 'store-name')}
        ${storeSettings.showReceiptAddress !== false ? renderCenteredLines(storeSettings.address || '', 'store-info') : ''}
        ${storeSettings.showReceiptPhone !== false ? renderCenteredLines(storeSettings.phone || '', 'store-info') : ''}
      </div>
      
      <div class="divider"></div>
      
      <div>
        <div class="flex"><span>Waktu:</span><span>${dateStr}</span></div>
        <div class="flex"><span>ID:</span><span>${trx.id?.substring(0, 12)}</span></div>
        ${isEstimation && (trx as any).validUntil ? `
          <div class="flex"><span>Berlaku s/d:</span><span>${new Date((trx as any).validUntil).toLocaleDateString('id-ID', {day: '2-digit', month: 'long', year: 'numeric'})}</span></div>
        ` : ''}
        ${storeSettings.showReceiptCashier !== false ? `
          <div class="flex"><span>Kasir:</span><span>${(trx.cashierName || 'Online (Sistem)').split('@')[0]}</span></div>
        ` : ''}
        ${storeSettings.showReceiptCustomer !== false && trx.customerName && trx.customerName !== 'Tanpa Nama' ? `
          <div class="flex"><span>Pemesan:</span><span>${trx.customerName}</span></div>
        ` : ''}
        ${trx.queueNumber ? `
          <div class="flex font-bold" style="margin-top: 2px; font-size: calc(${fontSize} + 2px);">
            <span>ANTRIAN:</span><span>#${trx.queueNumber}</span>
          </div>
        ` : ''}
      </div>
      
      <div class="divider"></div>
      
      <table>
        ${trx.items.map(item => `
          <tr>
            <td colspan="2" class="font-bold">${item.productName}</td>
          </tr>
          ${item.selectedExtras?.map(ext => `
            <tr>
              <td colspan="2" style="font-size: calc(${fontSize} - 2px); color: #444; padding-left: 10px;">
                + ${ext.optionName} ${ext.price > 0 ? `(Rp ${ext.price.toLocaleString('id-ID')})` : ''}
              </td>
            </tr>
          `).join('') || ''}
          ${(() => {
            const prodId = item.productId;
            const prodName = item.productName || (item as any).name;
            let catalogProduct = null;
            if (prodId && productsMap[prodId]) {
              catalogProduct = productsMap[prodId];
            } else if (prodName && productsMap[prodName]) {
              catalogProduct = productsMap[prodName];
            }

            let duration = 0;
            let unit = 'months';
            if (catalogProduct && catalogProduct.warrantyDuration) {
              duration = catalogProduct.warrantyDuration;
              unit = catalogProduct.warrantyUnit || 'months';
            } else {
              duration = (item as any).warrantyDuration || 0;
              unit = (item as any).warrantyUnit || 'months';
            }

            let expiryStr = '';
            if (item.warrantyExpiry) {
              expiryStr = new Date(item.warrantyExpiry).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'});
            } else if (duration > 0 && wStartDate) {
              const expDate = new Date(wStartDate);
              if (unit === 'days') expDate.setDate(expDate.getDate() + duration);
              else if (unit === 'months') expDate.setMonth(expDate.getMonth() + duration);
              else if (unit === 'years') expDate.setFullYear(expDate.getFullYear() + duration);
              expiryStr = expDate.toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'});
            }

            if (expiryStr) {
              return `
                <tr>
                  <td colspan="2" style="font-size: calc(${fontSize} - 3px); color: #000; padding-left: 10px; font-style: italic;">
                    🛡 Garansi s/d: ${expiryStr}
                  </td>
                </tr>
              `;
            } else if (duration > 0) {
              return `
                <tr>
                  <td colspan="2" style="font-size: calc(${fontSize} - 3px); color: #666; padding-left: 10px; font-style: italic;">
                    🛡 Garansi: ${duration} ${unit === 'days' ? 'Hari' : unit === 'months' ? 'Bulan' : 'Tahun'} (Belum Aktif)
                  </td>
                </tr>
              `;
            }
            return '';
          })()}
          ${item.note ? `
            <tr>
              <td colspan="2" class="item-note">
                ✏ ${item.note}
              </td>
            </tr>
          ` : ''}
          <tr>
            <td>
              ${item.discountName ? `
                <div style="font-size: calc(${fontSize} - 4px); text-decoration: line-through; opacity: 0.6;">
                  Rp ${((item.originalPrice || item.price) * item.qty).toLocaleString('id-ID')}
                </div>
                <div style="font-size: calc(${fontSize} - 4px); color: #008000; font-weight: bold;">
                  PROMO: ${item.discountName}
                </div>
              ` : ''}
              ${item.qty} x ${item.price.toLocaleString('id-ID')}
            </td>
            <td class="text-right">${item.subtotal.toLocaleString('id-ID')}</td>
          </tr>
        `).join('')}
      </table>
      
      <div class="divider"></div>
      
      ${storeSettings.showReceiptSubtotal !== false ? `
        <div class="flex"><span>Subtotal:</span><span>${(trx.total - (trx.tax || 0)).toLocaleString('id-ID')}</span></div>
      ` : ''}
      ${trx.tax ? `<div class="flex"><span>PPN:</span><span>${trx.tax.toLocaleString('id-ID')}</span></div>` : ''}
      <div class="divider"></div>
      <div class="flex font-bold" style="font-size: calc(${fontSize} + 2px);">
        <span>TOTAL:</span><span>Rp ${trx.total.toLocaleString('id-ID')}</span>
      </div>

      ${!isEstimation ? (() => {
        const cashValue = (trx as any).cashReceived || ((trx as any).change !== undefined ? (trx as any).change + trx.total : 0);
        const changeValue = (trx as any).change !== undefined ? (trx as any).change : (cashValue > trx.total ? cashValue - trx.total : 0);
        
        if (trx.paymentMethod?.toUpperCase() === 'CASH' && cashValue > 0) {
          return `
            <div class="flex" style="margin-top: 4px;"><span>Tunai:</span><span>${cashValue.toLocaleString('id-ID')}</span></div>
            <div class="flex"><span>Kembali:</span><span>${changeValue.toLocaleString('id-ID').replace('-', '')}</span></div>
          `;
        }
        return '';
      })() : ''}
      
      <div class="mt-2 text-center" style="margin-top: 15px;">
        <div style="font-weight:bold; text-transform:uppercase;">
          ${isEstimation ? '[ DOKUMEN PENAWARAN ]' : `[ ${trx.paymentStatus === 'paid' ? 'LUNAS' : 'BELUM LUNAS'} - ${trx.paymentMethod} ]`}
        </div>
      </div>

      <div class="divider" style="margin-top: 15px;"></div>

      ${storeSettings.showSignature && signatureData ? `
        <div class="text-center" style="margin-top: 10px; margin-bottom: 20px;">
           <img src="${signatureData}" style="max-height: 50px; max-width: 100px; object-fit: contain; mix-blend-multiply;" />
        </div>
      ` : ''}

      <div class="text-center" style="margin-top: 10px;">
        ${renderCenteredLines(storeSettings.receiptMessage || 'Terima Kasih')}
      </div>
      
      ${isExpired && branding?.receiptWatermark ? `
        <div class="text-center" style="margin-top: 20px; font-size: 8px; font-weight: bold; text-transform: uppercase; opacity: 0.5; border-top: 1px solid #eee; padding-top: 5px;">
           ${renderCenteredLines(branding.receiptWatermark)}
        </div>
      ` : ''}
      
      <script>
        window.onload = function() { window.print(); window.close(); }
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '', `width=${paperWidth},height=600`);
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    alert("Pop-up diblokir. Izinkan pop-up untuk mencetak struk.");
  }
};

export const printServiceReceipt = async (ticket: any, storeSettings: any, branding?: any) => {
  const isExpired = await checkSubscriptionExpired(ticket.storeId);
  const is80mm = storeSettings?.paperSize === '80mm';
  const paperWidth = is80mm ? '300px' : '220px';
  const fontSize = is80mm ? '14px' : '12px';

  let logoData = storeSettings?.thermalLogoUrl || storeSettings?.logoUrl || '';
  if (storeSettings?.showLogoOnReceipt !== false && logoData && logoData.startsWith('http')) {
     logoData = await urlToBase64(logoData);
  }

  // Generate QR Code Link using a reliable free service
  const trackLink = `https://ikasir.my.id/services/track?id=${ticket.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(trackLink)}`;
  const qrBase64 = await urlToBase64(qrUrl);

  const formatDate = (date: Date) => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${d}/${m}/${y} ${h}:${min}`;
  };

  const dateStr = ticket.createdAt?.toDate 
    ? formatDate(ticket.createdAt.toDate())
    : ticket.createdAt instanceof Date 
    ? formatDate(ticket.createdAt)
    : ticket.createdAt?.seconds 
    ? formatDate(new Date(ticket.createdAt.seconds * 1000))
    : formatDate(new Date());

  const rawStoreName = storeSettings?.storeName || branding?.appName || 'IKASIR PRO';
  const cleanStoreName = rawStoreName.includes('@') ? rawStoreName.split('@')[0] : rawStoreName;

  const renderCenteredLines = (str: string, className = '') => {
    if (!str) return '';
    return str.split('\n').map(line => `<div class="${className}" style="text-align: center;">${line.trim()}</div>`).join('');
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Tanda Terima Servis #${ticket.ticketNo || ticket.id.substring(0,8).toUpperCase()}</title>
      <style>
        body { font-family: 'Courier New', Courier, monospace; font-size: ${fontSize}; color: black; background: white; margin: 0; padding: 10px; width: ${is80mm ? '280px' : '200px'}; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .divider { border-top: 1px dashed black; margin: 6px 0; }
        .flex { display: flex; justify-content: space-between; }
        .store-name {
          font-size: calc(${fontSize} + 2px);
          font-weight: 900;
          text-transform: uppercase;
          text-align: center;
        }
        .store-info { font-size: calc(${fontSize} - 1px); text-align: center; }
        table { width: 100%; border-collapse: collapse; margin: 5px 0; }
        td { font-size: ${fontSize}; padding: 2px 0; vertical-align: top; }
        .section-title { font-weight: bold; text-transform: uppercase; text-align: center; margin: 10px 0 5px 0; font-size: calc(${fontSize} - 1px); }
        .signature-box { margin-top: 20px; display: flex; justify-content: space-between; text-align: center; }
        .signature-line { margin-top: 40px; border-top: 1px solid black; width: 85px; display: inline-block; font-size: calc(${fontSize} - 2px); }
      </style>
    </head>
    <body>
      <div class="text-center" style="margin-bottom: 6px;">
        ${storeSettings?.showLogoOnReceipt !== false && logoData ? `
          <div style="margin-bottom: 6px; width: 100%;">
            <img src="${logoData}" style="width: 80px; height: auto; display: inline-block; filter: grayscale(100%) contrast(1.8) brightness(1.1);" />
          </div>
        ` : ''}
        ${renderCenteredLines(cleanStoreName.toUpperCase(), 'store-name')}
        ${storeSettings?.showReceiptAddress !== false ? renderCenteredLines(storeSettings?.address || '', 'store-info') : ''}
        ${storeSettings?.showReceiptPhone !== false ? renderCenteredLines(storeSettings?.phone || '', 'store-info') : ''}
      </div>

      <div class="divider"></div>
      <div class="text-center font-bold" style="margin: 4px 0; font-size: calc(${fontSize} + 1px);">
        TANDA TERIMA SERVIS
      </div>
      <div class="divider"></div>

      <div>
        <div class="flex"><span>No Tiket:</span><span class="font-bold">${ticket.ticketNo || `ST-${ticket.id.substring(0, 8).toUpperCase()}`}</span></div>
        <div class="flex"><span>Tanggal:</span><span>${dateStr}</span></div>
        <div class="flex"><span>Pelanggan:</span><span>${ticket.customerName}</span></div>
        <div class="flex"><span>No HP:</span><span>${ticket.customerPhone}</span></div>
      </div>

      <div class="divider"></div>
      <div class="section-title">- DETAIL PERANGKAT -</div>
      <div>
        <div class="flex"><span>Unit:</span><span class="font-bold">${ticket.deviceModel}</span></div>
        <div class="flex"><span>S/N atau IMEI:</span><span>${ticket.serialNumber || '-'}</span></div>
        <div style="margin-top: 4px;">
          <div class="font-bold" style="font-size: calc(${fontSize} - 1px);">Keluhan / Masalah:</div>
          <div style="white-space: pre-wrap; font-style: italic; margin-top: 2px;">${ticket.damageDescription}</div>
        </div>
      </div>

      <div class="divider"></div>
      <div class="section-title">- BIAYA & GARANSI -</div>
      <div>
        <div class="flex font-bold"><span>Estimasi Biaya:</span><span>Rp ${(ticket.estimatedCost || 0).toLocaleString('id-ID')}</span></div>
        ${ticket.downPayment > 0 ? `
          <div class="flex"><span>Uang Muka (DP):</span><span>Rp ${Number(ticket.downPayment).toLocaleString('id-ID')}</span></div>
          <div class="flex font-bold"><span>Sisa Pembayaran:</span><span>Rp ${(Number(ticket.estimatedCost) - Number(ticket.downPayment)).toLocaleString('id-ID')}</span></div>
        ` : ''}
        ${ticket.warrantyDuration ? `
          <div class="flex"><span>Garansi Toko:</span><span>${ticket.warrantyDuration} ${ticket.warrantyUnit === 'months' ? 'Bulan' : ticket.warrantyUnit === 'days' ? 'Hari' : 'Tahun'}</span></div>
        ` : ''}
        ${ticket.notes ? `
          <div style="margin-top: 5px; font-size: calc(${fontSize} - 2px); font-style: italic; white-space: pre-wrap;">
            Catatan: ${ticket.notes}
          </div>
        ` : ''}
      </div>

      <div class="divider"></div>
      <div class="text-center" style="margin: 12px 0 5px 0;">
        <div class="font-bold" style="font-size: calc(${fontSize} - 2px); text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">Live Status Tracking</div>
        <img src="${qrBase64}" style="width: 100px; height: 100px; display: inline-block; image-rendering: pixelated;" />
        <div style="font-size: calc(${fontSize} - 3px); margin-top: 6px; font-weight: bold; line-height: 1.2;">
          Pindai QR Code untuk melacak status servis secara real-time
        </div>
      </div>

      <div class="divider"></div>
      
      <div class="signature-box">
        <div>
          <div>Pelanggan</div>
          <div class="signature-line"></div>
        </div>
        <div>
          <div>Teknisi</div>
          <div class="signature-line"></div>
        </div>
      </div>

      <div class="text-center" style="margin-top: 20px; font-size: calc(${fontSize} - 3.5px); font-style: italic; line-height: 1.3;">
        * Unit yang tidak diambil dalam waktu 30 hari di luar tanggung jawab toko kami.
      </div>
      
      ${isExpired && branding?.receiptWatermark ? `
        <div class="text-center" style="margin-top: 15px; font-size: 8px; font-weight: bold; text-transform: uppercase; opacity: 0.5; border-top: 1px solid #eee; padding-top: 5px;">
           ${renderCenteredLines(branding.receiptWatermark)}
        </div>
      ` : ''}
      
      <script>
        window.onload = function() { window.print(); window.close(); }
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '', `width=${paperWidth},height=650`);
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    alert("Pop-up diblokir. Izinkan pop-up untuk mencetak struk.");
  }
};

export const printServiceA4 = async (ticket: any, storeSettings: any, branding?: any) => {
  const isExpired = await checkSubscriptionExpired(ticket.storeId);

  let logoData = storeSettings?.logoUrl || storeSettings?.thermalLogoUrl || '';
  if (logoData && logoData.startsWith('http')) {
     logoData = await urlToBase64(logoData);
  }

  let sigData = storeSettings?.signatureUrl || '';
  if (storeSettings?.showSignature !== false && sigData && sigData.startsWith('http')) {
     sigData = await urlToBase64(sigData);
  }

  const trackLink = `https://ikasir.my.id/services/track?id=${ticket.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(trackLink)}`;
  const qrBase64 = await urlToBase64(qrUrl);

  const formatDate = (date: Date) => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${d}/${m}/${y} ${h}:${min}`;
  };

  const dateStr = ticket.createdAt?.toDate 
    ? formatDate(ticket.createdAt.toDate())
    : ticket.createdAt instanceof Date 
    ? formatDate(ticket.createdAt)
    : ticket.createdAt?.seconds 
    ? formatDate(new Date(ticket.createdAt.seconds * 1000))
    : formatDate(new Date());

  const storeName = storeSettings?.storeName || branding?.appName || 'IKASIR PRO STORE';
  const cleanStoreName = storeName.includes('@') ? storeName.split('@')[0] : storeName;
  const address = storeSettings?.address || '';
  const phone = storeSettings?.phone || '';
  const storeNpwp = storeSettings?.npwp ? `<p class="store-info" style="font-size: 11px; color: #475569; margin: 2px 0;">NPWP: ${storeSettings.npwp}</p>` : '';

  const warrantyText = ticket.warrantyDuration 
    ? `${ticket.warrantyDuration} ${ticket.warrantyUnit === 'months' ? 'Bulan' : ticket.warrantyUnit === 'days' ? 'Hari' : 'Tahun'}`
    : 'Tidak Ada';

  const docNote = storeSettings?.a4ServiceNote || "* Simpan tanda terima ini secara baik sebagai bukti pengambilan barang yang sah.\n* Barang yang tidak diambil dalam waktu 30 hari di luar tanggung jawab toko kami.\n* Garansi servis berlaku untuk kendala/masalah kerusakan yang sama.";
  const docNoteHtml = docNote.replace(/\n/g, '<br/>');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Nota Penerimaan Servis #${ticket.ticketNo || ticket.id.substring(0,8).toUpperCase()}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 30px; background-color: #fff; }
        .invoice-container { max-width: 800px; margin: 0 auto; }
        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .header-logo { width: 120px; vertical-align: top; text-align: right; }
        .header-store { text-align: left; vertical-align: top; }
        .store-title { 
          font-size: 18px; 
          color: #0f172a; 
          margin: 0 0 5px 0; 
          line-height: 1.2;
          font-family: ${(() => {
            switch(storeSettings?.storeNameFont) {
              case 'serif': return "'Playfair Display', Georgia, serif";
              case 'mono': return "'Courier New', Courier, monospace";
              case 'elegant': return "'Outfit', sans-serif";
              case 'bold': return "'Oswald', sans-serif";
              case 'railey': return "'Railey', cursive";
              case 'cheque': return "'Cheque', sans-serif";
              case 'lovelo': return "'Lovelo', sans-serif";
              case 'sancreek': return "'Sancreek', sans-serif";
              default: return "'Inter', sans-serif";
            }
          })()};
          ${(() => {
            switch(storeSettings?.storeNameFont) {
              case 'railey':
                return "font-weight: normal; text-transform: none; font-size: 26px;";
              case 'sancreek':
                return "font-weight: normal; text-transform: none; font-size: 26px;";
              case 'elegant':
                return "font-weight: 300; text-transform: uppercase; letter-spacing: 0.05em;";
              case 'bold':
                return "font-weight: 900; text-transform: uppercase; letter-spacing: -0.02em;";
              case 'lovelo':
                return "font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;";
              case 'cheque':
                return "font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em;";
              default:
                return "font-weight: 900; text-transform: uppercase;";
            }
          })()};
        }
        .store-info { font-size: 11px; color: #475569; margin: 2px 0; }
        .title-section { text-align: center; margin-bottom: 20px; }
        .main-title { font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: 1px; text-transform: uppercase; margin: 0 0 5px 0; }
        .sub-title { font-size: 13px; font-weight: 700; color: #0f172a; margin: 0; }
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; }
        .info-cell { padding: 12px; width: 50%; vertical-align: top; }
        .info-label { font-size: 9px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .info-val { font-size: 12px; font-weight: 700; color: #0f172a; }
        .detail-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .detail-table th { padding: 10px 8px; background-color: #0f172a; color: #fff; font-size: 10px; font-weight: 900; text-transform: uppercase; text-align: left; }
        .detail-table td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
        .summary-container { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; gap: 20px; }
        .terms-box { flex: 1.3; font-size: 10px; color: #64748b; line-height: 1.6; }
        .terms-title { font-weight: bold; color: #0f172a; margin-bottom: 6px; text-transform: uppercase; font-size: 10px; }
        .cost-box { flex: 1; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
        .cost-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
        .cost-row.grand-total { font-size: 14px; font-weight: 900; color: #10b981; border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 6px; margin-bottom: 0; }
        .qr-section { text-align: center; padding: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: inline-block; }
        .signature-section { width: 100%; border-collapse: collapse; margin-top: 30px; text-align: center; }
        .signature-cell { width: 50%; vertical-align: top; font-size: 12px; }
        .signature-line { margin-top: 50px; border-top: 1px solid #94a3b8; width: 150px; display: inline-block; }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- HEADER -->
        <table class="header-table" style="width: auto; margin-bottom: 20px;">
          <tr>
            <td class="header-logo" style="width: auto; padding-right: 15px; vertical-align: middle; text-align: left;">
              ${logoData ? `
                <img src="${logoData}" style="max-width: 120px; max-height: 80px; object-fit: contain;" />
              ` : ''}
            </td>
            <td class="header-store" style="text-align: left; vertical-align: middle;">
              <h3 class="store-title" style="margin: 0 0 3px 0;">${cleanStoreName}</h3>
              ${address ? `<p class="store-info" style="margin: 1px 0;">${address}</p>` : ''}
              ${phone ? `<p class="store-info" style="margin: 1px 0;">Telp: ${phone}</p>` : ''}
              ${storeNpwp}
            </td>
          </tr>
        </table>

        <!-- TITLE -->
        <div class="title-section">
          <h2 class="main-title">NOTA PENERIMAAN SERVIS</h2>
          <p class="sub-title">No. Tiket: #${ticket.ticketNo || `ST-${ticket.id.substring(0,8).toUpperCase()}`}</p>
        </div>

        <!-- INFO -->
        <table class="info-table">
          <tr>
            <td class="info-cell" style="border-right: 1px solid #e2e8f0;">
              <div class="info-label">Informasi Pelanggan</div>
              <div class="info-val" style="font-size: 13px; margin-bottom: 2px;">${ticket.customerName}</div>
              <div class="store-info" style="font-size: 12px; font-weight: bold; color: #475569;">HP: ${ticket.customerPhone || '-'}</div>
            </td>
            <td class="info-cell">
              <div class="info-label">Informasi Dokumen</div>
              <div class="store-info" style="font-size: 12px;">Tanggal Diterima: <b>${dateStr}</b></div>
              <div class="store-info" style="font-size: 12px;">Teknisi: <b>${ticket.history?.[0]?.userEmail?.split('@')?.[0] || 'Admin'}</b></div>
            </td>
          </tr>
        </table>

        <!-- TABLE -->
        <table class="detail-table">
          <thead>
            <tr>
              <th style="width: 35%;">Perangkat / Unit</th>
              <th style="width: 25%;">S/N atau IMEI</th>
              <th style="width: 40%;">Diagnosa Kerusakan / Masalah</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight: bold; color: #0f172a; font-size: 12px;">${ticket.deviceModel}</td>
              <td style="font-family: monospace; font-size: 11px;">${ticket.serialNumber || '-'}</td>
              <td style="white-space: pre-wrap; color: #333; font-size: 11px;">${ticket.damageDescription}</td>
            </tr>
          </tbody>
        </table>

        <!-- SUMMARY SECTION -->
        <div class="summary-container">
          <!-- Terms and QR -->
          <div style="display: flex; flex-direction: column; gap: 15px; flex: 1.3;">
            <div class="terms-box">
              <div class="terms-title">Syarat & Ketentuan Servis:</div>
              <div>${docNoteHtml}</div>
            </div>
            
            <div>
              <div class="qr-section">
                <div style="font-weight: bold; font-size: 9px; text-transform: uppercase; margin-bottom: 6px; color: #0f172a; letter-spacing: 0.5px;">Live Status Tracking</div>
                <img src="${qrBase64}" style="width: 80px; height: 80px; border: 1px solid #e2e8f0; padding: 2px; background: #fff;" />
                <div style="font-size: 8px; color: #64748b; margin-top: 4px; font-weight: bold; max-width: 140px; line-height: 1.3;">Pindai QR ini untuk melacak status servis secara langsung</div>
              </div>
            </div>
          </div>

          <!-- Costs -->
          <div class="cost-box">
            <div class="terms-title" style="margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Rincian Biaya</div>
            <div class="cost-row">
              <span style="color: #64748b;">Estimasi Biaya:</span>
              <span style="font-weight: bold;">Rp ${(ticket.estimatedCost || 0).toLocaleString('id-ID')}</span>
            </div>
            <div class="cost-row">
              <span style="color: #64748b;">Uang Muka (DP):</span>
              <span style="font-weight: bold;">Rp ${Number(ticket.downPayment || 0).toLocaleString('id-ID')}</span>
            </div>
            <div class="cost-row">
              <span style="color: #64748b;">Garansi Toko:</span>
              <span style="font-weight: bold;">${warrantyText}</span>
            </div>
            
            <div class="cost-row grand-total">
              <span>Sisa Pembayaran:</span>
              <span>Rp ${(Number(ticket.estimatedCost || 0) - Number(ticket.downPayment || 0)).toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>

        <!-- SIGNATURES -->
        <table class="signature-section">
          <tr>
            <td class="signature-cell">
              <div>Pelanggan / Pemilik</div>
              ${ticket.signatureBase64 ? `
                <div style="margin-top: 10px; margin-bottom: 10px; height: 60px; display: flex; align-items: center; justify-content: center;">
                  <img src="${ticket.signatureBase64}" style="max-height: 60px; max-width: 140px; object-fit: contain;" />
                </div>
              ` : `
                <div class="signature-line" style="margin-top: 50px;"></div>
              `}
              <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${ticket.customerName}</div>
            </td>
            <td class="signature-cell">
              <div>Penerima / Teknisi</div>
              ${storeSettings?.showSignature !== false && sigData ? `
                <div style="margin-top: 10px; margin-bottom: 10px; height: 60px; display: flex; align-items: center; justify-content: center;">
                  <img src="${sigData}" style="max-height: 60px; max-width: 140px; object-fit: contain;" />
                </div>
              ` : `
                <div class="signature-line"></div>
              `}
              <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${cleanStoreName}</div>
            </td>
          </tr>
        </table>

        <!-- Watermark -->
        ${isExpired && branding?.receiptWatermark ? `
          <div style="text-align: center; margin-top: 50px; font-size: 8px; font-weight: bold; text-transform: uppercase; opacity: 0.4; border-top: 1px dashed #cbd5e1; padding-top: 10px; color: #475569; letter-spacing: 2px;">
            ${branding.receiptWatermark}
          </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '', `width=850,height=800`);
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    alert("Pop-up diblokir. Izinkan pop-up untuk mencetak nota A4.");
  }
};

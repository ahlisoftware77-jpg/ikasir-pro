import { Transaction } from '@/types';
import toast from 'react-hot-toast';

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
    if (item.warrantyExpiry) {
      const wDate = new Date(item.warrantyExpiry).toLocaleDateString('id-ID', {day: '2-digit', month: '2-digit', year: '2-digit'});
      text += ` [Garansi s/d: ${wDate}]\n`;
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
  if (branding?.receiptWatermark) {
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
          font-family: ${(() => {
            switch(storeSettings.storeNameFont) {
              case 'serif': return "'Playfair Display', serif";
              case 'mono': return "'Courier New', monospace";
              case 'elegant': return "'Outfit', sans-serif";
              case 'bold': return "'Oswald', sans-serif";
              default: return "'Inter', sans-serif";
            }
          })()};
          font-size: calc(${fontSize} + 6px); 
          font-weight: 900; 
          margin-bottom: 4px; 
          text-align: center; 
          width: 100%;
          letter-spacing: -0.02em;
          text-transform: uppercase;
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
          ${item.warrantyExpiry ? `
            <tr>
              <td colspan="2" style="font-size: calc(${fontSize} - 3px); color: #000; padding-left: 10px; font-style: italic;">
                🛡 Garansi s/d: ${new Date(item.warrantyExpiry).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'})}
              </td>
            </tr>
          ` : ''}
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
      
      ${branding?.receiptWatermark ? `
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

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { NativeModules, Platform, ToastAndroid, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Transaction } from '../types';

const getMimeTypeFromBase64 = (base64Str: string): string => {
  if (base64Str.startsWith('iVBORw0KGgo')) return 'image/png';
  if (base64Str.startsWith('/9j/')) return 'image/jpeg';
  if (base64Str.startsWith('UklGR')) return 'image/webp';
  if (base64Str.startsWith('R0lGOD')) return 'image/gif';
  if (base64Str.startsWith('PHN2Zy') || base64Str.startsWith('PD94bWw')) return 'image/svg+xml';
  return 'image/jpeg'; // default fallback
};

const convertUrlToBase64 = async (url: string, prefixName: string): Promise<string> => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  
  try {
    // 1. Auto-upgrade http ke https untuk kecocokan kebijakan cleartext traffic Android APK
    let secureUrl = url;
    if (url.startsWith('http://')) {
      secureUrl = 'https://' + url.substring(7);
    }

    const uniqueId = Math.random().toString(36).substring(7);
    // 2. Tambahkan ekstensi file .tmp untuk memastikan sistem operasi Android membuat file dengan benar
    const tempFile = `${FileSystem.cacheDirectory}${prefixName}_${uniqueId}.tmp`;
    
    const { uri } = await FileSystem.downloadAsync(secureUrl, tempFile);
    const base64Image = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const mimeType = getMimeTypeFromBase64(base64Image);
    const base64DataUri = `data:${mimeType};base64,${base64Image}`;

    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (delErr) {}
    
    return base64DataUri;
  } catch (err: any) {
    console.warn(`Failed to convert image url to base64 for ${prefixName}:`, err);
    // Tampilkan Alert untuk membantu mengidentifikasi pesan error eksak di perangkat mobile
    Alert.alert(
      "Gagal Cetak Gambar",
      `Gagal memproses gambar ${prefixName} ke format cetak.\n\nDetail Error: ${err?.message || String(err)}\nURL: ${url}`
    );
    return url; // Fallback ke URL asli
  }
};

const getBaseUrl = (storeSettings: any): string => {
  let baseUrl = storeSettings?.webBaseUrl || 'https://ikasir.my.id';
  if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1') || baseUrl.includes('192.168.')) {
    baseUrl = 'https://ikasir.my.id';
  }
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  return baseUrl;
};

const checkSubscriptionExpired = async (storeId: string | null): Promise<boolean> => {
  if (!storeId) return true;
  try {
    const { db } = require('../lib/firebase');
    const { collection, query, where, getDocs } = require('firebase/firestore');
    const q = query(collection(db, 'users'), where('storeId', '==', storeId));
    const userSnaps = await getDocs(q);
    
    if (userSnaps.empty) {
      return true;
    }
    
    const now = new Date();
    let hasActiveSub = false;
    userSnaps.forEach((userDoc: any) => {
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
      const { useAuthStore } = require('../store/authStore');
      return useAuthStore.getState().isSubscriptionExpired;
    } catch (storeErr) {
      return true;
    }
  }
};

export const generateReceiptHtml = (transaction: any, storeSettings?: any, branding?: any, isExpired = true) => {
  const baseUrl = getBaseUrl(storeSettings);
  let date: Date;
  if (transaction.timestamp?.seconds) {
    date = new Date(transaction.timestamp.seconds * 1000);
  } else if (transaction.timestamp?.toDate) {
    date = transaction.timestamp.toDate();
  } else if (transaction.timestamp instanceof Date) {
    date = transaction.timestamp;
  } else if (transaction.timestamp) {
    date = new Date(transaction.timestamp);
  } else {
    date = new Date();
  }
  const dateStr = date.toLocaleString('id-ID');
  const isEstimation = !transaction.paymentMethod && !transaction.paymentCategory && transaction.status === 'active';
  
  const storeName = storeSettings?.storeName || 'KASIR PRO';
  const cleanStoreName = storeName.includes('@') ? storeName.split('@')[0] : storeName;
  const address = storeSettings?.address || '';
  const phone = storeSettings?.phone || '';

  const itemsHtml = (transaction.items || []).map((item: any) => `
    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
      <div style="flex: 1;">
        <div style="font-weight: bold;">${item.productName || item.name}</div>
        <div style="font-size: 10px; color: #666;">${item.qty || 1} x Rp ${(item.price || 0).toLocaleString('id-ID')}</div>
        ${item.selectedExtras?.map((e: any) => `<div style="font-size: 9px; margin-left: 10px;">+ ${e.optionName || e.name} (Rp ${(e.price || 0).toLocaleString('id-ID')})</div>`).join('') || ''}
        ${item.warrantyExpiry ? `
          <div style="font-size: 9px; color: #10b981; font-weight: bold; margin-top: 2px;">
            🛡️ Garansi s/d: ${new Date(item.warrantyExpiry).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        ` : ''}
      </div>
      <div style="font-weight: bold;">Rp ${(item.subtotal || ((item.price || 0) * (item.qty || 1))).toLocaleString('id-ID')}</div>
    </div>
  `).join('');

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Playfair+Display:wght@700;900&family=Oswald:wght@700&family=Outfit:wght@700;900&display=swap" rel="stylesheet">
        <style>
          @font-face {
            font-family: 'Railey';
            src: url('${baseUrl}/fonts/Railey-PersonalUse.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
          @font-face {
            font-family: 'Lovelo';
            src: url('${baseUrl}/fonts/Lovelo-LineBold.ttf') format('truetype');
            font-weight: 700;
            font-style: normal;
          }
          @font-face {
            font-family: 'Lovelo';
            src: url('${baseUrl}/fonts/Lovelo-Black.ttf') format('truetype');
            font-weight: 900;
            font-style: normal;
          }
          @font-face {
            font-family: 'Cheque';
            src: url('${baseUrl}/fonts/Cheque-Regular.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
          @font-face {
            font-family: 'Cheque';
            src: url('${baseUrl}/fonts/Cheque-Black.ttf') format('truetype');
            font-weight: 900;
            font-style: normal;
          }

          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 1px dashed #ccc; padding-bottom: 15px; }
          .store-name { 
            font-size: 22px; 
            margin-bottom: 5px; 
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
                default: return "'Inter', sans-serif";
              }
            })()};
            ${(() => {
              switch(storeSettings?.storeNameFont) {
                case 'railey':
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
          .info { font-size: 12px; margin-bottom: 2px; text-align: center; white-space: pre-wrap; }
          .items { margin-bottom: 20px; border-bottom: 1px dashed #ccc; padding-bottom: 15px; }
          .total-row { display: flex; justify-content: space-between; font-size: 18px; font-weight: 900; margin-top: 10px; }
          .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #999; }
        </style>
      </head>
      <body>
        <div class="header">
          ${storeSettings?.showLogoOnReceipt !== false && storeSettings?.logoUrl ? `<div style="text-align: center; margin-bottom: 10px;"><img src="${storeSettings.logoUrl}" style="max-width: 120px; max-height: 80px; filter: grayscale(100%);" /></div>` : ''}
          <div class="store-name">${cleanStoreName}</div>
          ${address ? `<div class="info">${address}</div>` : ''}
          ${phone ? `<div class="info">Telp: ${phone}</div>` : ''}
          <div style="margin: 10px 0; border-top: 1px solid #eee; padding-top: 5px;"></div>
          <div class="info">${isEstimation ? 'ID Estimasi' : 'ID Transaksi'}: #${(transaction.id || '').substring(0, 8).toUpperCase()}</div>
          <div class="info">${dateStr}</div>
          <div class="info">${isEstimation ? 'Pelanggan: ' + (transaction.customerName || 'Umum') : 'Kasir: ' + (transaction.cashierName || 'Kasir')}</div>
          ${isEstimation && transaction.validUntil ? `<div class="info" style="color: #f59e0b; font-weight: bold; margin-top: 5px;">Berlaku s/d: ${new Date(transaction.validUntil).toLocaleDateString('id-ID')}</div>` : ''}
        </div>
        
        <div class="items">
          ${itemsHtml}
        </div>
        
        <div class="total-row">
          <span>TOTAL</span>
          <span>Rp ${(transaction.total || transaction.price || 0).toLocaleString('id-ID')}</span>
        </div>
        
        <div class="footer">
          <p>${isEstimation ? 'Terima kasih atas kepercayaan Anda!' : 'Terima kasih telah berbelanja!'}</p>
          <p>${isEstimation ? 'Silakan hubungi kami untuk konfirmasi lebih lanjut.' : 'Barang yang sudah dibeli tidak dapat ditukar atau dikembalikan.'}</p>
        </div>

        ${isExpired && branding?.receiptWatermark ? `
          <div style="text-align: center; margin-top: 20px; font-size: 8px; font-weight: bold; text-transform: uppercase; opacity: 0.5; border-top: 1px dashed #ccc; padding-top: 10px; color: #999; letter-spacing: 2px;">
            ${branding.receiptWatermark}
          </div>
        ` : ''}
      </body>
    </html>
  `;
};

export const generateA4Html = (trx: any, storeSettings?: any, branding?: any, isExpired = true) => {
  const baseUrl = getBaseUrl(storeSettings);
  const terbilang = (nilai: number): string => {
    const bilangan = [
      '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 
      'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'
    ];
    let temp = '';
    if (nilai < 12) {
      temp = ' ' + bilangan[Math.floor(nilai)];
    } else if (nilai < 20) {
      temp = terbilang(nilai - 10) + ' Belas';
    } else if (nilai < 100) {
      temp = terbilang(nilai / 10) + ' Puluh' + terbilang(nilai % 10);
    } else if (nilai < 200) {
      temp = ' Seratus' + terbilang(nilai - 100);
    } else if (nilai < 1000) {
      temp = terbilang(nilai / 100) + ' Ratus' + terbilang(nilai % 100);
    } else if (nilai < 2000) {
      temp = ' Seribu' + terbilang(nilai - 1000);
    } else if (nilai < 1000000) {
      temp = terbilang(nilai / 1000) + ' Ribu' + terbilang(nilai % 1000);
    } else if (nilai < 1000000000) {
      temp = terbilang(nilai / 1000000) + ' Juta' + terbilang(nilai % 1000000);
    } else if (nilai < 1000000000000) {
      temp = terbilang(nilai / 1000000000) + ' Milyar' + terbilang(nilai % 1000000000);
    }
    return temp.trim();
  };

  let date: Date;
  if (trx.timestamp?.seconds) {
    date = new Date(trx.timestamp.seconds * 1000);
  } else if (trx.timestamp?.toDate) {
    date = trx.timestamp.toDate();
  } else if (trx.timestamp instanceof Date) {
    date = trx.timestamp;
  } else if (trx.timestamp) {
    date = new Date(trx.timestamp);
  } else {
    date = new Date();
  }
  const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const isEstimation = !trx.paymentMethod && !trx.paymentCategory && trx.status === 'active';
  const isDebt = trx.paymentCategory === 'debt';
  
  const total = trx.total || trx.price || 0;
  const tax = trx.tax || 0;
  const subtotal = trx.tax ? Math.max(0, total - tax) : total;
  const paid = trx.paidAmount ?? trx.cashReceived ?? 0;
  const sisa = trx.paymentStatus === 'paid' ? 0 : Math.max(0, total - paid);
  
  let docNote = "";
  if (isEstimation) {
    docNote = storeSettings?.a4EstimationNote || "* Penawaran harga ini berlaku selama masa aktif yang tertera di atas.\n* Barang yang telah diproses tidak dapat dibatalkan secara sepihak.\n* Dokumen ini dibuat otomatis oleh sistem dan sah tanpa tanda tangan basah.";
  } else if (isDebt) {
    docNote = storeSettings?.a4DebtNote || "* Sisa tagihan piutang wajib dilunasi sebelum jatuh tempo.\n* Pembayaran cicilan yang sah harus tercatat di sistem.";
  } else {
    docNote = storeSettings?.a4InvoiceNote || "* Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.\n* Invoice ini adalah bukti pembayaran yang sah.";
  }
  
  const docNoteHtml = docNote.replace(/\n/g, '<br/>');

  const storeName = storeSettings?.storeName || 'KASIR PRO STORE';
  const cleanStoreName = storeName.includes('@') ? storeName.split('@')[0] : storeName;
  const address = storeSettings?.address || '';
  const phone = storeSettings?.phone || '';
  const storeNpwp = storeSettings?.npwp ? `<p class="store-info">NPWP: ${storeSettings.npwp}</p>` : '';
  
  const itemsHtml = (trx.items || []).map((item: any) => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px; text-align: left;">
        <div style="font-weight: bold; font-size: 12px; color: #1e293b;">${item.productName || item.name}</div>
        ${item.warrantyExpiry ? `
          <div style="font-size: 10px; color: #10b981; font-weight: bold; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
            🛡️ Garansi s/d: ${new Date(item.warrantyExpiry).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        ` : ''}
        ${item.note ? `<div style="font-size: 10px; color: #f59e0b; font-style: italic; margin-top: 2px;">Catatan: ${item.note}</div>` : ''}
        ${item.selectedExtras?.map((e: any) => `<span style="font-size: 9px; background-color: #f1f5f9; border: 1px solid #e2e8f0; color: #64748b; padding: 2px 4px; border-radius: 4px; margin-right: 4px; margin-top: 4px; display: inline-block;">+ ${e.optionName || e.name}</span>`).join('') || ''}
      </td>
      <td style="padding: 10px; text-align: center; color: #64748b;">Rp ${(item.price || 0).toLocaleString('id-ID')}</td>
      <td style="padding: 10px; text-align: center; color: #1e293b; font-weight: bold;">${item.qty || 1} pcs</td>
      <td style="padding: 10px; text-align: right; color: #1e293b; font-weight: bold;">Rp ${(item.subtotal || ((item.price || 0) * (item.qty || 1))).toLocaleString('id-ID')}</td>
    </tr>
  `).join('');

  const docType = isEstimation ? 'PENAWARAN' : 'INVOICE';
  const docId = (trx.id || '').substring(0, 10).toUpperCase();
  
  const rawCustomer = trx.customerName || '';
  const hasCustomer = rawCustomer && rawCustomer !== 'Pelanggan Umum' && rawCustomer !== 'Tanpa Nama';
  const customerPart = hasCustomer ? ` - ${rawCustomer.trim()}` : '';
  const validUntilStr = trx.validUntil ? new Date(trx.validUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  let stampDateStr = dateStr;
  if (trx.paymentStatus === 'paid' && trx.paymentHistory && trx.paymentHistory.length > 0) {
    try {
      const sortedHistory = [...trx.paymentHistory].sort((a: any, b: any) => {
        const timeA = a.date?.seconds ? a.date.seconds * 1000 : new Date(a.date).getTime();
        const timeB = b.date?.seconds ? b.date.seconds * 1000 : new Date(b.date).getTime();
        return timeA - timeB;
      });
      const lastPayment = sortedHistory[sortedHistory.length - 1];
      let lastPaymentDate: Date | null = null;
      if (lastPayment.date?.seconds) {
        lastPaymentDate = new Date(lastPayment.date.seconds * 1000);
      } else if (lastPayment.date?.toDate) {
        lastPaymentDate = lastPayment.date.toDate();
      } else if (lastPayment.date instanceof Date) {
        lastPaymentDate = lastPayment.date;
      } else if (lastPayment.date) {
        lastPaymentDate = new Date(lastPayment.date);
      }
      
      if (lastPaymentDate && !isNaN(lastPaymentDate.getTime())) {
        stampDateStr = lastPaymentDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    } catch (e) {
      console.warn("Failed to parse last payment date:", e);
    }
  }

  const paidStamp = trx.paymentStatus === 'paid' && !isEstimation ? `
    <div style="position: absolute; top: 120px; right: 60px; border: 4px double #10b981; color: #10b981; font-size: 20px; font-weight: 900; padding: 10px 20px; border-radius: 8px; text-transform: uppercase; transform: rotate(-10deg); opacity: 0.85; letter-spacing: 2px; font-family: 'Courier New', Courier, monospace; background-color: rgba(16, 185, 129, 0.05); text-align: center; pointer-events: none;">
      LUNAS / PAID
      <div style="font-size: 8px; margin-top: 4px; font-family: sans-serif; font-weight: bold; letter-spacing: 0.5px;">${stampDateStr}</div>
    </div>
  ` : '';

  const bankInfo = storeSettings?.bankInfo || '';
  const bankInfoHtml = bankInfo ? `
    <div style="margin-top: 15px; padding: 12px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 10px; color: #475569; line-height: 1.4; white-space: pre-line;">
      <span style="font-weight: 900; color: #10b981; text-transform: uppercase; font-size: 9px; display: block; margin-bottom: 5px; letter-spacing: 0.5px;">Info Pembayaran / Transfer:</span>
      ${bankInfo.replace(/\n/g, '<br/>')}
    </div>
  ` : '';

  const terbilangStr = total > 0 ? terbilang(total) + ' Rupiah' : 'Nol Rupiah';
  const terbilangHtml = `
    <div style="margin-top: 12px; padding: 10px 15px; background-color: #f8fafc; border-left: 4px solid #0f172a; font-size: 11px; color: #1e293b; font-style: italic; font-weight: bold; border-radius: 0 8px 8px 0; border: 1px solid #e2e8f0; border-left: 4px solid #0f172a; margin-bottom: 24px;">
      Terbilang: ${terbilangStr}
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>${docType} - ${docId}${customerPart} - ${cleanStoreName.trim()}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Playfair+Display:wght@700;900&family=Oswald:wght@700&family=Outfit:wght@700;900&display=swap" rel="stylesheet">
      <style>
        @font-face {
          font-family: 'Railey';
          src: url('${baseUrl}/fonts/Railey-PersonalUse.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
        @font-face {
          font-family: 'Lovelo';
          src: url('${baseUrl}/fonts/Lovelo-LineBold.ttf') format('truetype');
          font-weight: 700;
          font-style: normal;
        }
        @font-face {
          font-family: 'Lovelo';
          src: url('${baseUrl}/fonts/Lovelo-Black.ttf') format('truetype');
          font-weight: 900;
          font-style: normal;
        }
        @font-face {
          font-family: 'Cheque';
          src: url('${baseUrl}/fonts/Cheque-Regular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
        @font-face {
          font-family: 'Cheque';
          src: url('${baseUrl}/fonts/Cheque-Black.ttf') format('truetype');
          font-weight: 900;
          font-style: normal;
        }

        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #1e293b; background-color: #ffffff; }
        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; border-bottom: 2px solid #0f172a; }
        .store-title { 
          font-size: 24px; 
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
              default: return "'Inter', sans-serif";
            }
          })()};
          ${(() => {
            switch(storeSettings?.storeNameFont) {
              case 'railey':
                return "font-weight: normal; text-transform: none; font-size: 28px;";
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
        .store-info { font-size: 11px; color: #64748b; margin: 0; line-height: 1.4; }
        .doc-title { font-size: 28px; font-weight: 900; color: #cbd5e1; text-align: right; text-transform: uppercase; margin: 0 0 10px 0; letter-spacing: 2px; }
        .doc-meta { font-size: 11px; text-align: right; font-weight: bold; text-transform: uppercase; margin: 0; }
        .info-grid { display: flex; gap: 20px; margin-bottom: 30px; }
        .info-card { flex: 1; background-color: #f8fafc; border: 1px solid #f1f5f9; padding: 15px; border-radius: 8px; }
        .info-label { font-size: 9px; font-weight: 900; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px; }
        .info-value { font-size: 13px; font-weight: bold; color: #0f172a; margin: 0; text-transform: uppercase; }
        .info-subvalue { font-size: 11px; color: #64748b; margin-top: 5px; margin-bottom: 0; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
        .items-table th { background-color: #0f172a; color: #ffffff; font-size: 10px; font-weight: 900; text-transform: uppercase; padding: 12px 10px; letter-spacing: 1px; }
        .items-table td { padding: 12px 10px; font-size: 12px; }
        .summary-container { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .notes-section { width: 55%; font-size: 10px; color: #64748b; line-height: 1.5; }
        .total-section { width: 40%; }
        .total-row { display: flex; justify-content: space-between; font-size: 12px; color: #64748b; margin-bottom: 8px; padding: 0 5px; }
        .grand-total-box { display: flex; justify-content: space-between; background-color: #0f172a; color: #ffffff; padding: 15px; border-radius: 8px; font-weight: 900; font-size: 15px; margin-top: 10px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .grand-total-label { font-size: 11px; letter-spacing: 1px; align-self: center; }
        .signatures { display: flex; justify-content: space-between; padding: 0 50px; margin-top: 60px; text-align: center; }
        .signature-box { width: 150px; position: relative; }
        .sig-label { font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
        .sig-name { font-size: 12px; font-weight: 900; color: #1e293b; text-transform: uppercase; border-top: 1.5px solid #0f172a; padding-top: 5px; }
        .watermark { text-align: center; font-size: 9px; font-weight: 900; color: #cbd5e1; letter-spacing: 4px; margin-top: 80px; text-transform: uppercase; }
      </style>
    </head>
    <body>
      ${paidStamp}
      <table class="header-table">
        <tr>
          ${storeSettings?.logoUrl ? `
          <td style="padding-bottom: 20px; width: 100px; vertical-align: top;">
            <img src="${storeSettings.logoUrl}" style="max-width: 90px; max-height: 90px; display: block;" />
          </td>
          ` : ''}
          <td style="padding-bottom: 20px;">
            <h1 class="store-title">${cleanStoreName}</h1>
            <p class="store-info">${address}</p>
            <p class="store-info">Telp: ${phone}</p>
            ${storeNpwp}
          </td>
          <td style="text-align: right; padding-bottom: 20px; vertical-align: top;">
            <h2 class="doc-title">${isEstimation ? 'ESTIMASI BIAYA' : 'INVOICE'}</h2>
            <p class="doc-meta" style="color: #0f172a;">${isEstimation ? 'NO. PENAWARAN' : 'NO. INVOICE'} #${(trx.id || '').substring(0, 10).toUpperCase()}</p>
            <p class="doc-meta" style="color: #94a3b8; margin-top: 5px;">Tanggal: ${dateStr}</p>
          </td>
        </tr>
      </table>

      <div class="info-grid">
        <div class="info-card">
          <p class="info-label">Tagihan Kepada:</p>
          <p class="info-value">${trx.customerName || 'Pelanggan Umum'}</p>
          ${trx.customerPhone ? `<p class="info-subvalue">Hubungi: ${trx.customerPhone}</p>` : ''}
          ${trx.customerNpwp ? `<p class="info-subvalue">NPWP: ${trx.customerNpwp}</p>` : ''}
          ${(trx.customerAddress || trx.address) ? `<p class="info-subvalue">Alamat: ${trx.customerAddress || trx.address}</p>` : ''}
        </div>
        <div class="info-card">
          <p class="info-label">${isEstimation ? 'Masa Berlaku Penawaran:' : 'Status Pembayaran:'}</p>
          <p class="info-value" style="color: #10b981;">
            ${isEstimation ? `s/d ${validUntilStr}` : (trx.paymentStatus === 'paid' ? 'LUNAS' : 'PENDING')}
          </p>
          ${trx.dueDate && !isEstimation && trx.paymentStatus !== 'paid' ? `<p class="info-subvalue" style="color: #f43f5e; font-weight: bold;">Jatuh Tempo: ${new Date(trx.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>` : ''}
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th style="text-align: left; width: 50%;">Nama Barang / Deskripsi</th>
            <th style="text-align: center;">Harga Satuan</th>
            <th style="text-align: center;">Kuantitas</th>
            <th style="text-align: right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="summary-container">
        <div class="notes-section">
          <p style="font-weight: bold; color: #0f172a; margin-top: 0; margin-bottom: 5px; text-transform: uppercase; font-size: 11px;">Catatan / Syarat & Ketentuan:</p>
          <p style="margin: 0; line-height: 1.4;">${docNoteHtml}</p>
          ${bankInfoHtml}
        </div>
        <div class="total-section">
          <div class="total-row">
            <span>Subtotal</span>
            <span>Rp ${subtotal.toLocaleString('id-ID')}</span>
          </div>
          ${trx.tax ? `
            <div class="total-row">
              <span>Pajak (VAT)</span>
              <span>Rp ${tax.toLocaleString('id-ID')}</span>
            </div>
          ` : ''}
          <div class="grand-total-box">
            <span class="grand-total-label">TOTAL AKHIR</span>
            <span>Rp ${total.toLocaleString('id-ID')}</span>
          </div>
          ${!isEstimation ? `
            <div style="padding-top: 8px; display: flex; flex-direction: column; gap: 4px;">
              <div class="total-row" style="font-size: 10px; font-weight: bold; color: #64748b; margin-top: 5px;">
                <span style="text-transform: uppercase; font-size: 8px; font-weight: 900; color: #94a3b8; letter-spacing: 0.5px;">Telah Dibayar</span>
                <span style="color: #10b981; font-size: 12px; font-weight: 900;">Rp ${paid.toLocaleString('id-ID')}</span>
              </div>
              ${sisa > 0 ? `
                <div style="display: flex; justify-content: space-between; background-color: #fef2f2; color: #dc2626; padding: 8px 12px; border-radius: 8px; border: 1px solid #fee2e2; font-weight: 900; margin-top: 5px;">
                  <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 1px; align-self: center;">Sisa Tagihan</span>
                  <span style="font-size: 12px;">Rp ${sisa.toLocaleString('id-ID')}</span>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </div>

      ${terbilangHtml}

      ${trx.paymentHistory && trx.paymentHistory.length > 0 ? `
        <div style="margin-bottom: 24px; padding-top: 16px; border-top: 2px dashed #e2e8f0;">
          <p style="font-size: 8px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; margin-top: 0;">Rincian Riwayat Pembayaran:</p>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${trx.paymentHistory.map((hist: any) => {
              let histDate: Date;
              try {
                if (hist.date?.seconds) {
                  histDate = new Date(hist.date.seconds * 1000);
                } else if (hist.date?.toDate) {
                  histDate = hist.date.toDate();
                } else if (hist.date instanceof Date) {
                  histDate = hist.date;
                } else {
                  histDate = new Date(hist.date);
                }
              } catch (e) {
                histDate = new Date();
              }
              const histDateStr = histDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
              const cashierName = hist.cashierName?.includes('@') ? hist.cashierName.split('@')[0] : (hist.cashierName || 'Kasir');
              return `
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; font-weight: bold; color: #475569; background-color: #f8fafc; padding: 8px 16px; border-radius: 12px; border: 1px dotted #cbd5e1;">
                  <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="width: 48px; color: #94a3b8; font-weight: 900; font-size: 9px;">${histDateStr}</div>
                    <div style="display: flex; flex-direction: column; align-items: flex-start;">
                      <span style="color: #0f172a; font-size: 10px; text-transform: uppercase; font-weight: 900; letter-spacing: -0.2px;">${hist.note || 'Pembayaran'}</span>
                      <span style="font-size: 8px; color: #94a3b8; font-style: italic; font-weight: 500;">Oleh: ${cashierName}</span>
                    </div>
                  </div>
                  <span style="color: #0f172a; font-weight: 900;">Rp ${(hist.amount || 0).toLocaleString('id-ID')}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <div class="signatures">
        <div class="signature-box">
          <p class="sig-label">Hormat Kami,</p>
          <div style="height: 65px; display: flex; align-items: center; justify-content: center; margin-bottom: 5px;">
            ${storeSettings?.showSignature !== false && storeSettings?.signatureUrl ? `
              <img src="${storeSettings.signatureUrl}" style="max-height: 60px; max-width: 140px; object-fit: contain;" />
            ` : ''}
          </div>
          <p class="sig-name">${trx.cashierName || 'Store Admin'}</p>
        </div>
        <div class="signature-box">
          <p class="sig-label">Penerima,</p>
          <div style="height: 65px; display: flex; align-items: center; justify-content: center; margin-bottom: 5px;">
            ${trx.signatureBase64 ? `
              <img src="${trx.signatureBase64}" style="max-height: 60px; max-width: 140px; object-fit: contain;" />
            ` : ''}
          </div>
          <p class="sig-name">${trx.customerName || 'Pelanggan'}</p>
        </div>
      </div>

      ${isExpired ? `
        <div class="watermark">
          ${branding?.receiptWatermark || 'IKASIR PRO - MODERN POS SYSTEM'}
        </div>
      ` : ''}
    </body>
    </html>
  `;
};

const hasBluetoothNativeModule = !!NativeModules.BluetoothManager || !!NativeModules.RNBluetoothManager;

const BluetoothEscposPrinter = hasBluetoothNativeModule
  ? require('react-native-bluetooth-escpos-printer')?.BluetoothEscposPrinter
  : null;

const BluetoothManager = hasBluetoothNativeModule
  ? require('react-native-bluetooth-escpos-printer')?.BluetoothManager
  : null;

export const printReceiptViaBluetooth = async (trx: any, storeSettings?: any, branding?: any, isExpired = true) => {
  if (!BluetoothEscposPrinter) {
    throw new Error('Bluetooth printer module is not available');
  }

  let date: Date;
  if (trx.timestamp?.seconds) {
    date = new Date(trx.timestamp.seconds * 1000);
  } else if (trx.timestamp?.toDate) {
    date = trx.timestamp.toDate();
  } else if (trx.timestamp instanceof Date) {
    date = trx.timestamp;
  } else if (trx.timestamp) {
    date = new Date(trx.timestamp);
  } else {
    date = new Date();
  }

  const storeName = storeSettings?.storeName || 'KASIR PRO';
  const cleanStoreName = storeName.includes('@') ? storeName.split('@')[0] : storeName;
  const address = storeSettings?.address || '';
  const phone = storeSettings?.phone || '';
  const is80mm = storeSettings?.paperSize === '80mm';

  // Character width must match the physical printer columns exactly
  const W = is80mm ? 42 : 32;
  const divider = '-'.repeat(W);

  // Helper: build a left-right justified line using space padding (like the web does)
  const lr = (left: string, right: string): string => {
    const spaces = W - left.length - right.length;
    return left + (spaces > 0 ? ' '.repeat(spaces) : ' ') + right;
  };

  // Helper: word-wrap text into lines that fit the printer width.
  // Do NOT add padding — the printer's ALIGN.CENTER handles centering.
  // Adding padding + ALIGN.CENTER = double-centering (text shifts right).
  const wrapText = (str: string): string[] => {
    if (!str) return [''];
    const words = str.split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    for (const word of words) {
      const test = cur ? cur + ' ' + word : word;
      if (test.length <= W) {
        cur = test;
      } else {
        if (cur) lines.push(cur);
        cur = word;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  // Format date to match web: DD/MM/YYYY HH:MM:SS
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const dateStr = `${dd}/${mm}/${yy} ${hh}:${mi}:${ss}`;

  const isEstimation = !trx.paymentMethod && !trx.paymentCategory && trx.status === 'active';

  await BluetoothEscposPrinter.printerInit();

  // Feed a few lines at the very beginning to prevent the header/logo from being cut off or printed too high
  await BluetoothEscposPrinter.printText("\n\r\n\r\n\r\n\r", {});

  if (trx.isTest) {
    await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
    
    // Logo (if set)
    const activeLogoUrl = storeSettings?.thermalLogoUrl || storeSettings?.logoUrl;
    if (activeLogoUrl && storeSettings?.showLogoOnReceipt !== false) {
      try {
        const uniqueId = Math.random().toString(36).substring(7);
        const tempFile = `${FileSystem.cacheDirectory}temp_bt_logo_${uniqueId}.jpg`;
        const { uri } = await FileSystem.downloadAsync(activeLogoUrl, tempFile);
        const base64Image = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const printerWidth = is80mm ? 576 : 384;
        const picWidth = 160;
        const leftPad = Math.floor((printerWidth - picWidth) / 2);
        await BluetoothEscposPrinter.printPic(base64Image, { width: picWidth, left: leftPad });
        try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch (delErr) {}
      } catch (err) {}
    }

    // Store Name with font support
    const fontId = storeSettings?.storeNameFont || 'sans';
    const isCustomFont = fontId !== 'sans';
    
    if (isCustomFont) {
      try {
        const uniqueId = Math.random().toString(36).substring(7);
        const tempFile = `${FileSystem.cacheDirectory}temp_bt_storename_${uniqueId}.png`;
        const baseUrl = getBaseUrl(storeSettings);
        const renderUrl = `${baseUrl}/api/render-store-name?text=${encodeURIComponent(cleanStoreName)}&font=${fontId}`;
        const { uri } = await FileSystem.downloadAsync(renderUrl, tempFile);
        const base64Image = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        
        if (!base64Image || !base64Image.startsWith('iVBORw0KGgo')) {
          throw new Error("Unduhan bukan gambar PNG valid.");
        }
        
        const is80 = storeSettings?.paperSize === '80mm';
        const printerWidth = is80 ? 576 : 384;
        const picWidth = is80 ? 480 : 320;
        const leftPad = Math.floor((printerWidth - picWidth) / 2);

        await BluetoothEscposPrinter.printerLineSpace(0);
        await BluetoothEscposPrinter.printPic(base64Image, { width: picWidth, left: leftPad });
        await BluetoothEscposPrinter.printerLineSpace(32);
        try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch (delErr) {}
      } catch (err: any) {
        console.warn("Gagal render gambar font di test print:", err);
        // Fallback to text
        await BluetoothEscposPrinter.setBlob(1);
        for (const line of wrapText(cleanStoreName.toUpperCase())) {
          await BluetoothEscposPrinter.printText(`${line}\n\r`, { encoding: 'GBK', codepage: 0 });
        }
        await BluetoothEscposPrinter.setBlob(0);
      }
    } else {
      await BluetoothEscposPrinter.setBlob(1);
      for (const line of wrapText(cleanStoreName.toUpperCase())) {
        await BluetoothEscposPrinter.printText(`${line}\n\r`, { encoding: 'GBK', codepage: 0 });
      }
      await BluetoothEscposPrinter.setBlob(0);
    }
    
    await BluetoothEscposPrinter.printText(`*** UJI COBA CETAK PENDEK ***\n\r`, {});
    await BluetoothEscposPrinter.printText(`${divider}\n\r`, {});
    
    // Meta
    await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
    await BluetoothEscposPrinter.printText(`Wkt: ${dateStr}\n\r`, {});
    await BluetoothEscposPrinter.printText(`ID : ${trx.id}\n\r`, {});
    await BluetoothEscposPrinter.printText(`${divider}\n\r`, {});
    
    // Items
    for (const item of (trx.items || [])) {
      await BluetoothEscposPrinter.setBlob(1);
      await BluetoothEscposPrinter.printText(`${item.productName || item.name}\n\r`, {});
      await BluetoothEscposPrinter.setBlob(0);
      const left = `1x${(item.price || 0).toLocaleString('id-ID')}`;
      const right = (item.subtotal || (item.price || 0)).toLocaleString('id-ID');
      await BluetoothEscposPrinter.printText(`${lr(left, right)}\n\r`, {});
    }
    await BluetoothEscposPrinter.printText(`${divider}\n\r`, {});
    
    // Total
    await BluetoothEscposPrinter.setBlob(1);
    await BluetoothEscposPrinter.printText(`${lr('TOTAL:', `Rp ${(trx.total || 0).toLocaleString('id-ID')}`)}\n\r`, {});
    await BluetoothEscposPrinter.setBlob(0);
    await BluetoothEscposPrinter.printText(`${divider}\n\r`, {});
    
    // Footer
    await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
    await BluetoothEscposPrinter.printText(`UJI COBA SUKSES\n\r`, {});
    await BluetoothEscposPrinter.printText(`\n\r`, {}); // Feed 1 line
    return;
  }

  // ─── LOGO (Tengah) ──────────────────────────────────────────────
  const activeLogoUrl = storeSettings?.thermalLogoUrl || storeSettings?.logoUrl;
  if (activeLogoUrl && storeSettings?.showLogoOnReceipt !== false) {
    try {
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
      const uniqueId = Math.random().toString(36).substring(7);
      const tempFile = `${FileSystem.cacheDirectory}temp_bt_logo_${uniqueId}.jpg`;
      const { uri } = await FileSystem.downloadAsync(activeLogoUrl, tempFile);
      const base64Image = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      
      // Cetak gambar (sesuaikan width, max biasanya 384 untuk 58mm)
      // Hitung posisi tengah (left padding)
      const is80 = storeSettings?.paperSize === '80mm';
      const printerWidth = is80 ? 576 : 384;
      const picWidth = 200; // kelipatan 8
      const leftPad = Math.floor((printerWidth - picWidth) / 2);

      await BluetoothEscposPrinter.printPic(base64Image, { width: picWidth, left: leftPad });
      
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (delErr) {}
    } catch (err: any) {
      console.warn("Gagal mencetak logo Bluetooth:", err);
      Alert.alert('Info Logo', 'Gagal mencetak logo: ' + (err.message || String(err)));
    }
  }

  // ─── HEADER (Centered) ──────────────────────────────────────────
  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
  
  const fontId = storeSettings?.storeNameFont || 'sans';
  const isCustomFont = fontId !== 'sans';
  
  if (isCustomFont) {
    try {
      const uniqueId = Math.random().toString(36).substring(7);
      const tempFile = `${FileSystem.cacheDirectory}temp_bt_storename_${uniqueId}.png`;
      const baseUrl = getBaseUrl(storeSettings);
      const renderUrl = `${baseUrl}/api/render-store-name?text=${encodeURIComponent(cleanStoreName)}&font=${fontId}`;
      const { uri } = await FileSystem.downloadAsync(renderUrl, tempFile);
      const base64Image = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      
      // Validasi: Pastikan data yang diunduh adalah gambar PNG valid (base64 PNG dimulai dengan 'iVBORw0KGgo')
      if (!base64Image || !base64Image.startsWith('iVBORw0KGgo')) {
        throw new Error("Unduhan bukan gambar PNG valid.");
      }
      
      const is80 = storeSettings?.paperSize === '80mm';
      const printerWidth = is80 ? 576 : 384;
      const picWidth = is80 ? 480 : 320; // kelipatan 8
      const leftPad = Math.floor((printerWidth - picWidth) / 2);

      await BluetoothEscposPrinter.printerLineSpace(0);
      await BluetoothEscposPrinter.printPic(base64Image, { width: picWidth, left: leftPad });
      await BluetoothEscposPrinter.printerLineSpace(32);
      
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (delErr) {}
    } catch (err: any) {
      console.warn("Gagal mencetak header kustom sebagai gambar:", err);
      // Fallback ke teks biasa jika gagal
      await BluetoothEscposPrinter.setBlob(1);
      for (const line of wrapText(cleanStoreName.toUpperCase())) {
        await BluetoothEscposPrinter.printText(`${line}\n\r`, { encoding: 'GBK', codepage: 0 });
      }
      await BluetoothEscposPrinter.setBlob(0);
    }
  } else {
    // Default text printing for standard fonts
    await BluetoothEscposPrinter.setBlob(1);
    for (const line of wrapText(cleanStoreName.toUpperCase())) {
      await BluetoothEscposPrinter.printText(`${line}\n\r`, { encoding: 'GBK', codepage: 0 });
    }
    await BluetoothEscposPrinter.setBlob(0);
  }

  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
  if (address) {
    for (const line of wrapText(address)) {
      await BluetoothEscposPrinter.printText(`${line}\n\r`, {});
    }
  }
  if (phone) {
    await BluetoothEscposPrinter.printText(`${phone}\n\r`, {});
  }
  await BluetoothEscposPrinter.printText(`${divider}\n\r`, {});

  // ─── META INFO (Left aligned, matching web labels) ──────────────
  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
  await BluetoothEscposPrinter.printText(`Wkt: ${dateStr}\n\r`, {});
  await BluetoothEscposPrinter.printText(`ID : ${trx.id?.substring(0, 12)}\n\r`, {});

  if (isEstimation && trx.validUntil) {
    const vDate = new Date(trx.validUntil).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });
    await BluetoothEscposPrinter.printText(`Berlaku s/d: ${vDate}\n\r`, {});
  }

  const rawCashier = trx.cashierName || 'Kasir';
  const cleanCashier = rawCashier.includes('@') ? rawCashier.split('@')[0] : rawCashier;
  await BluetoothEscposPrinter.printText(`Ksr: ${cleanCashier}\n\r`, {});

  if (trx.customerName && trx.customerName !== 'Tanpa Nama') {
    await BluetoothEscposPrinter.printText(`Pmsn: ${trx.customerName}\n\r`, {});
  }
  if (trx.queueNumber) {
    await BluetoothEscposPrinter.printText(`Antr: #${trx.queueNumber}\n\r`, {});
  }

  await BluetoothEscposPrinter.printText(`${divider}\n\r`, {});

  // ─── ITEMS ──────────────────────────────────────────────────────
  for (const item of (trx.items || [])) {
    // Product name (bold)
    await BluetoothEscposPrinter.setBlob(1);
    await BluetoothEscposPrinter.printText(`${item.productName || item.name}\n\r`, {});
    await BluetoothEscposPrinter.setBlob(0);

    // Extras
    if (item.selectedExtras && item.selectedExtras.length > 0) {
      for (const ext of item.selectedExtras) {
        const extPrice = (ext.price || 0) > 0 ? ` (Rp${(ext.price || 0).toLocaleString('id-ID')})` : '';
        await BluetoothEscposPrinter.printText(` + ${ext.optionName || ext.name}${extPrice}\n\r`, {});
      }
    }

    // Note
    if (item.note) {
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
      for (const line of wrapText(`( ${item.note} )`)) {
        await BluetoothEscposPrinter.printText(`${line}\n\r`, {});
      }
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
    }

    // Qty x Price ... Subtotal (space-padded, matching web)
    const left = `${item.qty || 1}x${(item.price || 0).toLocaleString('id-ID')}`;
    const subtotalVal = item.subtotal || ((item.price || 0) * (item.qty || 1));
    const right = subtotalVal.toLocaleString('id-ID');
    await BluetoothEscposPrinter.printText(`${lr(left, right)}\n\r`, {});

    // Garansi
    if (item.warrantyExpiry) {
      const wDate = new Date(item.warrantyExpiry).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });
      await BluetoothEscposPrinter.printText(` [Garansi s/d: ${wDate}]\n\r`, {});
    }
  }

  await BluetoothEscposPrinter.printText(`${divider}\n\r`, {});

  // ─── FINANCIAL SUMMARY (space-padded, matching web) ─────────────
  const totalVal = trx.total || 0;
  const taxVal = trx.tax || 0;
  const subtotal = totalVal - taxVal;

  // Subtotal
  await BluetoothEscposPrinter.printText(`${lr('Subtotal:', subtotal.toLocaleString('id-ID'))}\n\r`, {});

  // Tax
  if (taxVal > 0) {
    await BluetoothEscposPrinter.printText(`${lr('PPN:', taxVal.toLocaleString('id-ID'))}\n\r`, {});
  }

  await BluetoothEscposPrinter.printText(`${divider}\n\r`, {});

  // TOTAL (bold)
  await BluetoothEscposPrinter.setBlob(1);
  await BluetoothEscposPrinter.printText(`${lr('TOTAL:', `Rp ${totalVal.toLocaleString('id-ID')}`)}\n\r`, {});
  await BluetoothEscposPrinter.setBlob(0);

  // Payment details (matching web logic)
  if (!isEstimation) {
    const isDebt = trx.paymentCategory === 'debt' || trx.paymentStatus === 'partially_paid' || (trx.paymentHistory && trx.paymentHistory.length > 0);

    if (isDebt) {
      // Payment history
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
      await BluetoothEscposPrinter.printText(`RIWAYAT PEMBAYARAN\n\r`, {});
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);

      if (trx.paymentHistory && trx.paymentHistory.length > 0) {
        for (const hist of trx.paymentHistory) {
          let histDate: Date;
          try {
            if (hist.date?.seconds) histDate = new Date(hist.date.seconds * 1000);
            else if (hist.date?.toDate) histDate = hist.date.toDate();
            else histDate = new Date(hist.date);
          } catch { histDate = new Date(); }
          const hDateStr = histDate.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
          const hLeft = `${hDateStr} ${hist.note || 'Bayar'}`;
          const hRight = (hist.amount || 0).toLocaleString('id-ID');
          await BluetoothEscposPrinter.printText(`${lr(hLeft, hRight)}\n\r`, {});
        }
      }

      await BluetoothEscposPrinter.printText(`${divider}\n\r`, {});

      const paidTotal = trx.paidAmount ?? trx.cashReceived ?? 0;
      await BluetoothEscposPrinter.printText(`${lr('TOTAL BAYAR:', paidTotal.toLocaleString('id-ID'))}\n\r`, {});

      const remaining = totalVal - paidTotal;
      if (remaining > 0) {
        await BluetoothEscposPrinter.printText(`${lr('SISA PIUTANG:', remaining.toLocaleString('id-ID'))}\n\r`, {});
      }
    } else {
      // Cash payment
      const cashVal = trx.cashReceived || (trx.change !== undefined ? trx.change + totalVal : 0);
      const changeVal = trx.change !== undefined ? trx.change : (cashVal > totalVal ? cashVal - totalVal : 0);

      if (trx.paymentMethod?.toUpperCase() === 'CASH' && cashVal > 0) {
        await BluetoothEscposPrinter.printText(`${lr('Tunai:', cashVal.toLocaleString('id-ID'))}\n\r`, {});
        await BluetoothEscposPrinter.printText(`${lr('Kembali:', Math.abs(changeVal).toLocaleString('id-ID'))}\n\r`, {});
      }
    }
  }

  // ─── PAYMENT STATUS (centered, matching web) ────────────────────
  await BluetoothEscposPrinter.printText(`\n\r`, {});
  await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
  const statusText = isEstimation
    ? '[ DOKUMEN PENAWARAN ]'
    : `[ ${trx.paymentStatus === 'paid' ? 'LUNAS' : 'BELUM LUNAS'} - ${trx.paymentMethod || '-'} ]`;
  await BluetoothEscposPrinter.setBlob(1);
  await BluetoothEscposPrinter.printText(`${statusText}\n\r`, {});
  await BluetoothEscposPrinter.setBlob(0);

  await BluetoothEscposPrinter.printText(`${divider}\n\r`, {});

  // ─── FOOTER (centered) ─────────────────────────────────────────
  const receiptMessage = storeSettings?.receiptMessage || 'Terima Kasih';
  for (const line of wrapText(receiptMessage)) {
    await BluetoothEscposPrinter.printText(`${line}\n\r`, {});
  }

  // ─── BRANDING WATERMARK ────────────────────────────────────────
  if (isExpired && branding?.receiptWatermark) {
    await BluetoothEscposPrinter.printText(`\n\r`, {});
    for (const line of wrapText(branding.receiptWatermark)) {
      await BluetoothEscposPrinter.printText(`${line}\n\r`, {});
    }
  }

  await BluetoothEscposPrinter.printText(`\n\r\n\r\n\r`, {});
};

export const printReceipt = async (transaction: any, storeSettings?: any) => {
  let settings = storeSettings;
  
  let branding: any = null;
  const isExpired = await checkSubscriptionExpired(transaction?.storeId);

  if (transaction?.storeId) {
    try {
      const { db } = require('../lib/firebase');
      const { doc, getDoc } = require('firebase/firestore');
      const docSnap = await getDoc(doc(db, 'settings', `store_${transaction.storeId}`));
      if (docSnap.exists()) {
        settings = { ...settings, ...docSnap.data() };
      }
    } catch (err) {
      console.warn("Failed to fetch settings from Firestore in printReceipt:", err);
    }
  }

  // Fetch branding (watermark) from system_settings/branding
  try {
    const { db } = require('../lib/firebase');
    const { doc, getDoc } = require('firebase/firestore');
    const brandingSnap = await getDoc(doc(db, 'system_settings', 'branding'));
    if (brandingSnap.exists()) {
      branding = brandingSnap.data();
    }
  } catch (err) {
    console.warn("Failed to fetch branding:", err);
  }

  if (hasBluetoothNativeModule && BluetoothEscposPrinter) {
    try {
      const activePrinterAddress = await AsyncStorage.getItem('selected_printer_address');
      const activePrinter = await AsyncStorage.getItem('selected_printer');
      
      if (activePrinterAddress && BluetoothManager) {
        if (Platform.OS === 'android') {
          ToastAndroid.show('Menghubungkan & mencetak struk...', ToastAndroid.SHORT);
        }
        
        // Automatically ensure printer is connected before printing
        try {
          await BluetoothManager.connect(activePrinterAddress);
          // Wait a brief moment for the connection channel to stabilize
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (connErr) {
          console.warn('Bluetooth auto-connection failed, trying to print anyway:', connErr);
        }
        
        await printReceiptViaBluetooth(transaction, settings, branding, isExpired);
        
        if (Platform.OS === 'android') {
          ToastAndroid.show('Struk berhasil dicetak!', ToastAndroid.SHORT);
        } else {
          Alert.alert('Sukses', 'Struk berhasil dicetak!');
        }
        return;
      } else if (activePrinter) {
        if (Platform.OS === 'android') {
          ToastAndroid.show('Mencetak struk...', ToastAndroid.SHORT);
        }
        // Fallback for older installations that only saved printer name
        await printReceiptViaBluetooth(transaction, settings, branding, isExpired);
        
        if (Platform.OS === 'android') {
          ToastAndroid.show('Struk berhasil dicetak!', ToastAndroid.SHORT);
        } else {
          Alert.alert('Sukses', 'Struk berhasil dicetak!');
        }
        return;
      }
    } catch (error) {
      console.error('Direct Bluetooth print failed:', error);
      throw error;
    }
  }

  try {
    let finalSettings = settings;
    if ((!finalSettings || !finalSettings.storeName || finalSettings.storeName === 'Kasir Pro Store' || finalSettings.storeName === 'KASIR PRO' || (!finalSettings.logoUrl && !finalSettings.thermalLogoUrl)) && transaction?.storeId) {
      try {
        const { db } = require('../lib/firebase');
        const { doc, getDoc } = require('firebase/firestore');
        const docSnap = await getDoc(doc(db, 'settings', `store_${transaction.storeId}`));
        if (docSnap.exists()) {
          finalSettings = docSnap.data();
        }
      } catch (err) {
        console.warn("Failed to fetch settings from Firestore in printReceipt PDF fallback:", err);
      }
    }

    let base64Logo = '';
    if (finalSettings?.showLogoOnReceipt !== false && finalSettings?.logoUrl) {
      base64Logo = await convertUrlToBase64(finalSettings.logoUrl, 'temp_receipt_logo');
    }

    if (base64Logo) {
      finalSettings = { ...finalSettings, logoUrl: base64Logo };
    }

    const html = generateReceiptHtml(transaction, finalSettings, branding, isExpired);
    await Print.printAsync({
      html,
    });
  } catch (error) {
    console.error('Error printing receipt:', error);
    throw error;
  }
};

export const printA4 = async (trx: any, storeSettings?: any) => {
  let settings = storeSettings;
  let branding: any = null;
  const isExpired = await checkSubscriptionExpired(trx?.storeId);
  const isEstimation = !trx.paymentMethod && !trx.paymentCategory && trx.status === 'active';

  if (trx?.storeId) {
    try {
      const { db } = require('../lib/firebase');
      const { doc, getDoc } = require('firebase/firestore');
      const docSnap = await getDoc(doc(db, 'settings', `store_${trx.storeId}`));
      if (docSnap.exists()) {
        settings = { ...settings, ...docSnap.data() };
      }
    } catch (err) {
      console.warn("Failed to fetch settings from Firestore in printA4:", err);
    }
  }

  // Fetch branding (watermark) from system_settings/branding
  try {
    const { db } = require('../lib/firebase');
    const { doc, getDoc } = require('firebase/firestore');
    const brandingSnap = await getDoc(doc(db, 'system_settings', 'branding'));
    if (brandingSnap.exists()) {
      branding = brandingSnap.data();
    }
  } catch (err) {
    console.warn("Failed to fetch branding in printA4:", err);
  }

  let base64Logo = '';
  if (settings?.logoUrl) {
    base64Logo = await convertUrlToBase64(settings.logoUrl, 'temp_a4_logo');
  }

  if (base64Logo) {
    settings = { ...settings, logoUrl: base64Logo };
  }

  let base64Signature = '';
  if (settings?.showSignature !== false && settings?.signatureUrl) {
    base64Signature = await convertUrlToBase64(settings.signatureUrl, 'temp_a4_sig');
  }

  if (base64Signature) {
    settings = { ...settings, signatureUrl: base64Signature };
  }

  try {
    const html = generateA4Html(trx, settings, branding, isExpired);
    
    Alert.alert(
      'Pilih Aksi Dokumen A4',
      'Apakah Anda ingin mencetak dokumen langsung ke printer atau menyimpan/bagikan sebagai file PDF?',
      [
        {
          text: 'Simpan / Bagikan PDF',
          onPress: async () => {
            try {
              const cleanStoreName = (settings?.storeName || 'IKASIR').split('@')[0].trim();
              const docType = isEstimation ? 'PENAWARAN' : 'INVOICE';
              const docId = (trx.id || '').substring(0, 10).toUpperCase();
              const rawCustomer = trx.customerName || '';
              const hasCustomer = rawCustomer && rawCustomer !== 'Pelanggan Umum' && rawCustomer !== 'Tanpa Nama';
              const customerPart = hasCustomer ? ` - ${rawCustomer.trim()}` : '';
              
              // Format filename safely by removing illegal file name characters
              const fileName = `${docType} - ${docId}${customerPart} - ${cleanStoreName}`.replace(/[\/\\?%*:|"<>#&]/g, '') + '.pdf';
              const newPath = `${FileSystem.cacheDirectory}${fileName}`;
              
              const { uri } = await Print.printToFileAsync({ html });
              
              // If file already exists, delete it first to avoid collision
              const fileInfo = await FileSystem.getInfoAsync(newPath);
              if (fileInfo.exists) {
                await FileSystem.deleteAsync(newPath, { idempotent: true });
              }
              
              await FileSystem.moveAsync({
                from: uri,
                to: newPath,
              });
              
              await Sharing.shareAsync(newPath, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf', dialogTitle: 'Simpan / Bagikan PDF' });
            } catch (err: any) {
              console.error('Gagal membagikan PDF:', err);
              Alert.alert('Gagal', 'Terjadi kesalahan saat membagikan PDF: ' + (err.message || String(err)));
            }
          }
        },
        {
          text: 'Cetak Langsung',
          onPress: async () => {
            try {
              await Print.printAsync({ html });
            } catch (err: any) {
              console.error('Gagal mencetak:', err);
              Alert.alert('Gagal', 'Terjadi kesalahan saat mencetak: ' + (err.message || String(err)));
            }
          }
        },
        {
          text: 'Batal',
          style: 'cancel'
        }
      ],
      { cancelable: true }
    );
  } catch (error) {
    console.error('Error processing A4 document:', error);
    throw error;
  }
};

export const generateA4DeliveryHtml = (trx: any, storeSettings?: any, branding?: any, isExpired = true) => {
  let date: Date;
  if (trx.timestamp?.seconds) {
    date = new Date(trx.timestamp.seconds * 1000);
  } else if (trx.timestamp?.toDate) {
    date = trx.timestamp.toDate();
  } else if (trx.timestamp instanceof Date) {
    date = trx.timestamp;
  } else if (trx.timestamp) {
    date = new Date(trx.timestamp);
  } else {
    date = new Date();
  }
  const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  
  const storeName = storeSettings?.storeName || 'KASIR PRO STORE';
  const cleanStoreName = storeName.includes('@') ? storeName.split('@')[0] : storeName;
  const docId = (trx.id || '').substring(0, 10).toUpperCase();
  
  const rawCustomer = trx.customerName || '';
  const hasCustomer = rawCustomer && rawCustomer !== 'Pelanggan Umum' && rawCustomer !== 'Tanpa Nama';
  const customerPart = hasCustomer ? ` - ${rawCustomer.trim()}` : '';
  const address = storeSettings?.address || '';
  const phone = storeSettings?.phone || '';
  
  const itemsHtml = (trx.items || []).map((item: any, idx: number) => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px; text-align: left; color: #64748b;">${idx + 1}</td>
      <td style="padding: 10px; text-align: left;">
        <div style="font-weight: bold; font-size: 12px; color: #1e293b;">${item.productName || item.name}</div>
        ${item.warrantyExpiry ? `
          <div style="font-size: 10px; color: #10b981; font-weight: bold; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
            🛡️ Garansi s/d: ${new Date(item.warrantyExpiry).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        ` : ''}
        ${item.note ? `<div style="font-size: 10px; color: #f59e0b; font-style: italic; margin-top: 2px;">Catatan: ${item.note}</div>` : ''}
        ${item.selectedExtras?.map((e: any) => `<span style="font-size: 9px; background-color: #f1f5f9; border: 1px solid #e2e8f0; color: #64748b; padding: 2px 4px; border-radius: 4px; margin-right: 4px; margin-top: 4px; display: inline-block;">+ ${e.optionName || e.name}</span>`).join('') || ''}
      </td>
      <td style="padding: 10px; text-align: center; color: #1e293b; font-weight: bold;">${item.qty || 1} ${item.unit || 'pcs'}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>SURAT JALAN - ${docId}${customerPart} - ${cleanStoreName.trim()}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #1e293b; background-color: #ffffff; }
        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; border-bottom: 2px solid #0f172a; }
        .store-title { font-size: 24px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin: 0 0 5px 0; }
        .store-info { font-size: 11px; color: #64748b; margin: 0; line-height: 1.4; }
        .doc-title { font-size: 28px; font-weight: 900; color: #cbd5e1; text-align: right; text-transform: uppercase; margin: 0 0 10px 0; letter-spacing: 2px; }
        .doc-meta { font-size: 11px; text-align: right; font-weight: bold; text-transform: uppercase; margin: 0; }
        .info-grid { display: flex; gap: 20px; margin-bottom: 30px; }
        .info-card { flex: 1; background-color: #f8fafc; border: 1px solid #f1f5f9; padding: 15px; border-radius: 8px; }
        .info-label { font-size: 9px; font-weight: 900; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px; }
        .info-value { font-size: 13px; font-weight: bold; color: #0f172a; margin: 0; text-transform: uppercase; }
        .info-subvalue { font-size: 11px; color: #64748b; margin-top: 5px; margin-bottom: 0; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
        .items-table th { background-color: #0f172a; color: #ffffff; font-size: 10px; font-weight: 900; text-transform: uppercase; padding: 12px 10px; letter-spacing: 1px; }
        .items-table td { padding: 12px 10px; font-size: 12px; }
        .signatures { display: flex; justify-content: space-between; padding: 0 50px; margin-top: 60px; text-align: center; }
        .signature-box { width: 150px; position: relative; }
        .sig-label { font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
        .sig-name { font-size: 10px; font-weight: 900; color: #1e293b; text-transform: uppercase; border-top: 1.5px solid #0f172a; padding-top: 5px; }
        .watermark { text-align: center; font-size: 9px; font-weight: 900; color: #cbd5e1; letter-spacing: 4px; margin-top: 80px; text-transform: uppercase; }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          ${storeSettings?.logoUrl ? `
          <td style="padding-bottom: 20px; width: 100px; vertical-align: top;">
            <img src="${storeSettings.logoUrl}" style="max-width: 90px; max-height: 90px; display: block;" />
          </td>
          ` : ''}
          <td style="padding-bottom: 20px;">
            <h1 class="store-title">${cleanStoreName}</h1>
            <p class="store-info">${address}</p>
            <p class="store-info">Telp: ${phone}</p>
          </td>
          <td style="text-align: right; padding-bottom: 20px; vertical-align: top;">
            <h2 class="doc-title">SURAT JALAN</h2>
            <p class="doc-meta" style="color: #0f172a;">REF. #${(trx.id || '').substring(0, 10).toUpperCase()}</p>
            <p class="doc-meta" style="color: #94a3b8; margin-top: 5px;">Tgl Kirim: ${dateStr}</p>
          </td>
        </tr>
      </table>

      <div class="info-grid">
        <div class="info-card">
          <p class="info-label">Penerima / Tujuan:</p>
          <p class="info-value">${trx.customerName || 'Pelanggan Umum'}</p>
          ${trx.customerPhone ? `<p class="info-subvalue">${trx.customerPhone}</p>` : ''}
        </div>
        <div class="info-card">
          <p class="info-label">Informasi Pengiriman:</p>
          <p class="info-subvalue">No. Kendaraan: ........................</p>
          <p class="info-subvalue">Nama Driver: ........................</p>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th style="text-align: left; width: 8%;">No</th>
            <th style="text-align: left; width: 72%;">Nama Barang / Deskripsi</th>
            <th style="text-align: center; width: 20%;">Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px dashed #e2e8f0; margin-bottom: 40px;">
         <p class="info-label" style="margin-top: 0;">Keterangan Tambahan:</p>
         <div style="height: 40px; border-bottom: 1px solid #e2e8f0; margin-bottom: 10px;"></div>
         <div style="height: 10px; border-bottom: 1px solid #e2e8f0;"></div>
      </div>

      <div class="signatures">
        <div class="signature-box">
          <p class="sig-label">Penerima,</p>
          <div style="height: 65px; display: flex; align-items: center; justify-content: center; margin-bottom: 5px;"></div>
          <p class="sig-name">Nama Terang & Stempel</p>
        </div>
        <div class="signature-box">
          <p class="sig-label">Sopir / Pengantar,</p>
          <div style="height: 65px; display: flex; align-items: center; justify-content: center; margin-bottom: 5px;"></div>
          <p class="sig-name">Nama Terang</p>
        </div>
        <div class="signature-box">
          <p class="sig-label">Hormat Kami,</p>
          <div style="height: 65px; display: flex; align-items: center; justify-content: center; margin-bottom: 5px;">
            ${storeSettings?.showSignature !== false && storeSettings?.signatureUrl ? `
              <img src="${storeSettings.signatureUrl}" style="max-height: 60px; max-width: 140px; object-fit: contain;" />
            ` : ''}
          </div>
          <p class="sig-name" style="font-size: 12px;">${(trx.cashierName || 'Store Admin').split('@')[0]}</p>
        </div>
      </div>

      ${isExpired ? `
        <div class="watermark">
          ${branding?.receiptWatermark || 'IKASIR PRO - DELIVERY SYSTEM'}
        </div>
      ` : ''}
    </body>
    </html>
  `;
};

export const printA4Delivery = async (trx: any, storeSettings?: any) => {
  let settings = storeSettings;
  let branding: any = null;
  const isExpired = await checkSubscriptionExpired(trx?.storeId);

  if (trx?.storeId) {
    try {
      const { db } = require('../lib/firebase');
      const { doc, getDoc } = require('firebase/firestore');
      const docSnap = await getDoc(doc(db, 'settings', `store_${trx.storeId}`));
      if (docSnap.exists()) {
        settings = { ...settings, ...docSnap.data() };
      }
    } catch (err) {
      console.warn("Failed to fetch settings from Firestore in printA4Delivery:", err);
    }
  }

  // Fetch branding (watermark) from system_settings/branding
  try {
    const { db } = require('../lib/firebase');
    const { doc, getDoc } = require('firebase/firestore');
    const brandingSnap = await getDoc(doc(db, 'system_settings', 'branding'));
    if (brandingSnap.exists()) {
      branding = brandingSnap.data();
    }
  } catch (err) {
    console.warn("Failed to fetch branding in printA4Delivery:", err);
  }

  let base64Logo = '';
  if (settings?.logoUrl) {
    base64Logo = await convertUrlToBase64(settings.logoUrl, 'temp_a4_delivery_logo');
  }

  if (base64Logo) {
    settings = { ...settings, logoUrl: base64Logo };
  }

  let base64Signature = '';
  if (settings?.showSignature !== false && settings?.signatureUrl) {
    base64Signature = await convertUrlToBase64(settings.signatureUrl, 'temp_a4_delivery_sig');
  }

  if (base64Signature) {
    settings = { ...settings, signatureUrl: base64Signature };
  }

  try {
    const html = generateA4DeliveryHtml(trx, settings, branding, isExpired);
    
    Alert.alert(
      'Pilih Aksi Surat Jalan',
      'Apakah Anda ingin mencetak Surat Jalan langsung ke printer atau menyimpan/bagikan sebagai file PDF?',
      [
        {
          text: 'Simpan / Bagikan PDF',
          onPress: async () => {
            try {
              const cleanStoreName = (settings?.storeName || 'IKASIR').split('@')[0].trim();
              const docId = (trx.id || '').substring(0, 10).toUpperCase();
              const rawCustomer = trx.customerName || '';
              const hasCustomer = rawCustomer && rawCustomer !== 'Pelanggan Umum' && rawCustomer !== 'Tanpa Nama';
              const customerPart = hasCustomer ? ` - ${rawCustomer.trim()}` : '';
              
              // Format filename safely
              const fileName = `SURAT JALAN - ${docId}${customerPart} - ${cleanStoreName}`.replace(/[\/\\?%*:|"<>#&]/g, '') + '.pdf';
              const newPath = `${FileSystem.cacheDirectory}${fileName}`;
              
              const { uri } = await Print.printToFileAsync({ html });
              
              // If file already exists, delete it first
              const fileInfo = await FileSystem.getInfoAsync(newPath);
              if (fileInfo.exists) {
                await FileSystem.deleteAsync(newPath, { idempotent: true });
              }
              
              await FileSystem.moveAsync({
                from: uri,
                to: newPath,
              });
              
              await Sharing.shareAsync(newPath, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf', dialogTitle: 'Simpan / Bagikan PDF' });
            } catch (err: any) {
              console.error('Gagal membagikan PDF:', err);
              Alert.alert('Gagal', 'Terjadi kesalahan saat membagikan PDF: ' + (err.message || String(err)));
            }
          }
        },
        {
          text: 'Cetak Langsung',
          onPress: async () => {
            try {
              await Print.printAsync({ html });
            } catch (err: any) {
              console.error('Gagal mencetak:', err);
              Alert.alert('Gagal', 'Terjadi kesalahan saat mencetak: ' + (err.message || String(err)));
            }
          }
        },
        {
          text: 'Batal',
          style: 'cancel'
        }
      ],
      { cancelable: true }
    );
  } catch (error) {
    console.error('Error processing A4 Delivery:', error);
    throw error;
  }
};

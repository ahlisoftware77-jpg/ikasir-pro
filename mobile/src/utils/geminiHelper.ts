import { primaryDb } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export interface ProductDetailsResponse {
  name: string;
  baseCost: number;
  price: number;
  category: string;
}

export const generateProductInfoFromImage = async (base64Image: string): Promise<ProductDetailsResponse> => {
  try {
    // 1. Ambil API Key dari Firestore
    const infraDoc = await getDoc(doc(primaryDb, 'system_settings', 'infrastructure'));
    let apiKey = '';
    
    if (infraDoc.exists()) {
      apiKey = infraDoc.data().gemini_api_key || '';
    }

    if (!apiKey) {
      // Fallback ke env jika ada (opsional)
      apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
    }

    if (!apiKey) {
      throw new Error('API Key Gemini belum dikonfigurasi. Harap isi di menu SuperAdmin.');
    }

    // 2. Siapkan prompt untuk Gemini Flash
    const promptText = `
Anda adalah AI asisten kasir yang ahli mengenali barang dari gambar.
Saya memberikan foto sebuah produk/barang dagangan.
Tolong identifikasi barang tersebut dan hasilkan perkiraan data untuk aplikasi kasir dalam format JSON murni TANPA markdown (\`\`\`), dengan properti berikut:
- "name": Nama produk lengkap (contoh: "Aqua Botol 600ml", "Indomie Goreng")
- "baseCost": Perkiraan harga beli / modal wajar dalam Rupiah (angka saja, contoh: 2500)
- "price": Perkiraan harga jual pasaran yang wajar dalam Rupiah (angka saja, contoh: 3500)
- "category": Kategori barang (Pilih salah satu atau buat yang relevan: Makanan, Minuman, Sembako, Rokok, Elektronik, Jasa, Lainnya)

Jika foto adalah kemasan kosong, usahakan tetap menebak sesuai merek. Jika barcode tidak ada konteks, coba tebak dari bentuk barang.
Tulis JSON murni saja.
    `;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }
      ]
    };

    // 3. Panggil API Gemini 1.5 Flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API Error:', errText);
      throw new Error(`Gagal menghubungi server Gemini API: ${response.status}`);
    }

    const responseJson = await response.json();
    
    // 4. Ekstrak dan parse JSON dari balasan Gemini
    const textOutput = responseJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Bersihkan jika AI masih membalas pakai markdown ```json
    const cleanedText = textOutput.replace(/```json/gi, '').replace(/```/gi, '').trim();
    
    try {
      const parsedData = JSON.parse(cleanedText);
      return {
        name: parsedData.name || '',
        baseCost: Number(parsedData.baseCost) || 0,
        price: Number(parsedData.price) || 0,
        category: parsedData.category || 'Lainnya'
      };
    } catch (parseError) {
      console.error('Failed to parse Gemini output:', textOutput);
      throw new Error('Format balasan dari AI tidak dapat dibaca.');
    }

  } catch (error: any) {
    console.error('generateProductInfoFromImage Error:', error);
    throw new Error(error.message || 'Terjadi kesalahan tidak terduga.');
  }
};

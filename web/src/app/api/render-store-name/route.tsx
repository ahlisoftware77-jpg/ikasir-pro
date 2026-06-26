import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text') || 'IKASIR PRO';
    const fontId = searchParams.get('font') || 'sans';
    const color = searchParams.get('color') || '000000';
    
    let fontName = 'Inter';
    let fontWeight: number = 400;
    let fontData: ArrayBuffer | null = null;
    let hasCustomFont = false;
    
    const origin = req.nextUrl.origin || 'https://kasirkuyk.web.app';

    const loadFont = async (fontFilename: string, relativePath: string) => {
      const urls = [
        `${origin}/fonts/${fontFilename}`,
        `https://ikasir.my.id/fonts/${fontFilename}`,
        `https://ikasir-n3j64w7pn-ahlisoftware77-s-projects.vercel.app/fonts/${fontFilename}`,
        `https://ikasir-8d3amiifh-ahlisoftware77-s-projects.vercel.app/fonts/${fontFilename}`,
        `https://kasirkuyk.web.app/fonts/${fontFilename}`,
        new URL(relativePath, import.meta.url).toString()
      ];
      
      let lastErr = null;
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            return await res.arrayBuffer();
          }
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error(`Failed to load font ${fontFilename} from all sources`);
    };
    
    try {
      if (fontId === 'railey') {
        fontName = 'Railey';
        fontWeight = 400;
        hasCustomFont = true;
        fontData = await loadFont('Railey-PersonalUse.ttf', '../../../../public/fonts/Railey-PersonalUse.ttf');
      } else if (fontId === 'cheque') {
        fontName = 'Cheque';
        fontWeight = 400;
        hasCustomFont = true;
        fontData = await loadFont('Cheque-Regular.ttf', '../../../../public/fonts/Cheque-Regular.ttf');
      } else if (fontId === 'lovelo') {
        fontName = 'Lovelo';
        fontWeight = 700;
        hasCustomFont = true;
        fontData = await loadFont('Lovelo-LineBold.ttf', '../../../../public/fonts/Lovelo-LineBold.ttf');
      }
    } catch (e) {
      console.error("Failed to load custom font:", e);
    }

    const fonts = fontData ? [
      {
        name: fontName,
        data: fontData,
        style: 'normal' as const,
        weight: fontWeight as any,
      }
    ] : undefined;

    // Font size lebih kecil agar tinggi gambar minimal — semakin kecil gambar,
    // semakin sedikit blank dots yang tercetak sebagai jarak ke baris berikutnya.
    const fontSize = fontId === 'railey' ? 28 : 22;
    // Tambahkan buffer yang cukup agar font tidak terpotong di bagian bawah
    const imgHeight = fontSize + 10;

    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            backgroundColor: '#ffffff',
            color: `#${color}`,
            padding: '0px 4px',
          }}
        >
          <span
            style={{
              fontFamily: hasCustomFont && fontData ? fontName : 'sans-serif',
              fontSize: `${fontSize}px`,
              fontWeight: fontId === 'lovelo' ? 700 : 'bold',
              textAlign: 'center',
              letterSpacing: fontId === 'lovelo' ? '0.12em' : fontId === 'cheque' ? '0.05em' : 'normal',
              textTransform: fontId === 'railey' ? 'none' : 'uppercase',
              lineHeight: '1.0',
            }}
          >
            {text}
          </span>
        </div>
      ),
      {
        width: 384,
        height: imgHeight,
        fonts: fonts,
      }
    );
  } catch (err: any) {
    console.error("Render store name API error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}

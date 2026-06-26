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

    const fetchFont = async (fontFamily: string, weight: number): Promise<ArrayBuffer> => {
      try {
        const cssUrl = `https://fonts.googleapis.com/css2?family=${fontFamily}:wght@${weight}`;
        const cssRes = await fetch(cssUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'
          }
        });
        const cssText = await cssRes.text();
        const fontUrlMatch = cssText.match(/src:\s*url\((https:\/\/fonts\.gstatic\.com\/s\/[^\)]+)\)/);
        if (fontUrlMatch) {
          const fontRes = await fetch(fontUrlMatch[1]);
          if (fontRes.ok) {
            return await fontRes.arrayBuffer();
          }
        }
        throw new Error("Font file URL not found in CSS response.");
      } catch (err) {
        console.error(`Failed to fetch dynamic font ${fontFamily} from Google Fonts:`, err);
        throw err;
      }
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
      } else if (fontId === 'serif') {
        fontName = 'Playfair Display';
        fontWeight = 700;
        hasCustomFont = true;
        fontData = await fetchFont('Playfair+Display', 700);
      } else if (fontId === 'mono') {
        fontName = 'Courier Prime';
        fontWeight = 400;
        hasCustomFont = true;
        fontData = await fetchFont('Courier+Prime', 400);
      } else if (fontId === 'elegant') {
        fontName = 'Outfit';
        fontWeight = 400;
        hasCustomFont = true;
        fontData = await fetchFont('Outfit', 400);
      } else if (fontId === 'bold') {
        fontName = 'Oswald';
        fontWeight = 700;
        hasCustomFont = true;
        fontData = await fetchFont('Oswald', 700);
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
            padding: '0px 10px',
          }}
        >
          <span
            style={{
              fontFamily: hasCustomFont && fontData ? fontName : 'sans-serif',
              fontSize: fontId === 'railey' ? '40px' : '30px',
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
        height: 50,
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

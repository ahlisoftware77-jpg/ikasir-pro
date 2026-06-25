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
    let fontFileName = '';
    let fontWeight: number = 400;
    
    switch(fontId) {
      case 'railey':
        fontName = 'Railey';
        fontFileName = 'Railey-PersonalUse.ttf';
        fontWeight = 400;
        break;
      case 'cheque':
        fontName = 'Cheque';
        fontFileName = 'Cheque-Regular.ttf';
        fontWeight = 400;
        break;
      case 'lovelo':
        fontName = 'Lovelo';
        fontFileName = 'Lovelo-LineBold.ttf';
        fontWeight = 700;
        break;
      default:
        break;
    }
    
    let fontData: ArrayBuffer | null = null;
    
    if (fontFileName) {
      try {
        const fontUrl = `${req.nextUrl.origin}/fonts/${fontFileName}`;
        const fontRes = await fetch(fontUrl);
        if (fontRes.ok) {
          fontData = await fontRes.arrayBuffer();
        } else {
          console.error(`Failed to fetch font: ${fontRes.status} from ${fontUrl}`);
        }
      } catch (e) {
        console.error("Failed to fetch font from origin:", e);
      }
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
            padding: '5px 10px',
          }}
        >
          <span
            style={{
              fontFamily: fontFileName && fontData ? fontName : 'sans-serif',
              fontSize: fontId === 'railey' ? '46px' : '36px',
              fontWeight: fontId === 'lovelo' ? 700 : 'bold',
              textAlign: 'center',
              letterSpacing: fontId === 'lovelo' ? '0.12em' : fontId === 'cheque' ? '0.05em' : 'normal',
              textTransform: fontId === 'railey' ? 'none' : 'uppercase',
              lineHeight: '1.2',
            }}
          >
            {text}
          </span>
        </div>
      ),
      {
        width: 384,
        height: 80,
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

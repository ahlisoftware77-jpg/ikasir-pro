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
    
    try {
      if (fontId === 'railey') {
        fontName = 'Railey';
        fontWeight = 400;
        hasCustomFont = true;
        fontData = await fetch(
          new URL('../../../../public/fonts/Railey-PersonalUse.ttf', import.meta.url)
        ).then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.arrayBuffer();
        });
      } else if (fontId === 'cheque') {
        fontName = 'Cheque';
        fontWeight = 400;
        hasCustomFont = true;
        fontData = await fetch(
          new URL('../../../../public/fonts/Cheque-Regular.ttf', import.meta.url)
        ).then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.arrayBuffer();
        });
      } else if (fontId === 'lovelo') {
        fontName = 'Lovelo';
        fontWeight = 700;
        hasCustomFont = true;
        fontData = await fetch(
          new URL('../../../../public/fonts/Lovelo-LineBold.ttf', import.meta.url)
        ).then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.arrayBuffer();
        });
      }
    } catch (e) {
      console.error("Failed to load local font from import.meta.url:", e);
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
              fontFamily: hasCustomFont && fontData ? fontName : 'sans-serif',
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

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

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
        fontFileName = 'Lovelo-LineBold.ttf'; // Use the bold inline/outline version
        fontWeight = 700;
        break;
      default:
        // default system sans-serif
        break;
    }
    
    const fonts: any[] = [];
    
    if (fontFileName) {
      try {
        const fontPath = path.join(process.cwd(), 'public', 'fonts', fontFileName);
        const fontData = fs.readFileSync(fontPath);
        fonts.push({
          name: fontName,
          data: fontData,
          style: 'normal',
          weight: fontWeight,
        });
      } catch (e) {
        console.error("Failed to load local font file in route:", e);
      }
    }

    // Wrap long names if necessary by using fit-content
    // We render inside a white box suitable for thermal print (384px width, 80px height)
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
              fontFamily: fontFileName ? fontName : 'sans-serif',
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
        fonts: fonts.length > 0 ? fonts : undefined,
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

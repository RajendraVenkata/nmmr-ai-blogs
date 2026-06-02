import { ImageResponse } from 'next/og';
import { getPublishedPostBySlug } from '@/lib/serverClient';
import { getSignedMediaUrl } from '@/lib/amplifyServer';

export const runtime = 'nodejs';

// Only raster formats can be rasterized by Satori and shown by social scrapers.
// SVG covers fall through to the branded card.
const RASTER = /\.(png|jpe?g|webp|gif)$/i;

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  const post = await getPublishedPostBySlug(params.slug);
  if (!post) return new Response(null, { status: 404 });
  const title = post.title;

  let coverUrl: string | null = null;
  if (post.coverImageKey && RASTER.test(post.coverImageKey)) {
    try {
      coverUrl = await getSignedMediaUrl(post.coverImageKey);
    } catch {
      coverUrl = null;
    }
  }

  const element = coverUrl ? (
    <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '60px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))',
          color: '#ffffff',
        }}
      >
        <div style={{ display: 'flex', fontSize: 60, fontWeight: 800, lineHeight: 1.1 }}>
          {title}
        </div>
        <div style={{ display: 'flex', fontSize: 28, opacity: 0.85, marginTop: 16 }}>
          NMMR AI Blogs
        </div>
      </div>
    </div>
  ) : (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: '80px',
        background: 'linear-gradient(135deg, #1f2937 0%, #4b5563 100%)',
        color: '#ffffff',
      }}
    >
      <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, opacity: 0.85 }}>
        NMMR AI Blogs
      </div>
      <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, lineHeight: 1.1 }}>
        {title}
      </div>
      <div style={{ display: 'flex', fontSize: 30, opacity: 0.7 }}>
        rajendravenkata.com
      </div>
    </div>
  );

  return new ImageResponse(element, { width: 1200, height: 630 });
}

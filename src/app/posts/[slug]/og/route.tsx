import { ImageResponse } from 'next/og';
import { getPublishedPostBySlug } from '@/lib/serverClient';

export const runtime = 'nodejs';
export const contentType = 'image/png';

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  const post = await getPublishedPostBySlug(params.slug);
  const title = post?.title ?? 'NMMR AI Blogs';

  return new ImageResponse(
    (
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
    ),
    { width: 1200, height: 630 },
  );
}

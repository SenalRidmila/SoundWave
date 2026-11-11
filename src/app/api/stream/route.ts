import { NextRequest, NextResponse } from 'next/server';
import { resolveStreamInfo } from '@/lib/soundcloud';
import {
  resolveYouTubeStream,
  resolveYouTubeFallbackViaSoundCloud,
  isYouTubeUrl,
} from '@/lib/youtube';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const trackUrl = searchParams.get('url');
  const trackId  = searchParams.get('id');
  const source   = searchParams.get('source');
  const title    = searchParams.get('title');
  const isProxy  = searchParams.get('proxy') === '1';

  if (!trackUrl && !trackId) {
    return NextResponse.json({ error: 'Track URL or ID required' }, { status: 400 });
  }

  const isYouTube =
    source === 'youtube' || (trackUrl ? isYouTubeUrl(trackUrl) : false);

  try {
    if (isYouTube) {
      try {
        const resolved = await resolveYouTubeStream(trackUrl, trackId);

        if (isProxy) {
          const reqHeaders: Record<string, string> = {
            'User-Agent': resolved.userAgent,
          };
          const rangeHeader = request.headers.get('range');
          if (rangeHeader) {
            reqHeaders['Range'] = rangeHeader;
          }

          const upstream = await fetch(resolved.streamUrl, {
            headers: reqHeaders,
            cache: 'no-store',
          });

          if (!upstream.ok && upstream.status !== 206) {
            throw new Error(`Upstream YouTube stream error (${upstream.status})`);
          }

          const resHeaders = new Headers();
          resHeaders.set('Content-Type', upstream.headers.get('content-type') || resolved.mimeType || 'audio/mp4');
          resHeaders.set('Accept-Ranges', 'bytes');
          resHeaders.set('Cache-Control', 'no-store');

          const contentLength = upstream.headers.get('content-length');
          if (contentLength) resHeaders.set('Content-Length', contentLength);

          const contentRange = upstream.headers.get('content-range');
          if (contentRange) resHeaders.set('Content-Range', contentRange);

          return new NextResponse(upstream.body, {
            status: upstream.status,
            headers: resHeaders,
          });
        }

        const proxyParams = new URLSearchParams({
          url: trackUrl || '',
          id: trackId || '',
          source: 'youtube',
          title: title || '',
          proxy: '1',
        });

        return NextResponse.json({
          streamUrl: `/api/stream?${proxyParams.toString()}`,
          isHls: false,
          mimeType: resolved.mimeType,
        });
      } catch {
        // Fallback for Vercel/datacenter IPs where YouTube blocks direct /player extraction
        const fallbackStream = await resolveYouTubeFallbackViaSoundCloud(trackUrl, trackId, title);
        return NextResponse.json({
          streamUrl: fallbackStream.streamUrl,
          isHls: fallbackStream.isHls,
          mimeType: fallbackStream.mimeType,
        });
      }
    }

    const resolved = await resolveStreamInfo(trackUrl, trackId);

    return NextResponse.json({
      streamUrl: resolved.streamUrl,
      isHls: resolved.isHls,
      mimeType: resolved.mimeType,
    });
  } catch (error: unknown) {
    console.error('Stream error:', error);
    const message = error instanceof Error ? error.message : 'Streaming failed';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { resolveStreamInfo } from '@/lib/soundcloud';
import { resolveYouTubeStream, isYouTubeUrl } from '@/lib/youtube';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const trackUrl = searchParams.get('url');
  const trackId  = searchParams.get('id');
  const source   = searchParams.get('source');
  const isProxy  = searchParams.get('proxy') === '1';

  if (!trackUrl && !trackId) {
    return NextResponse.json({ error: 'Track URL or ID required' }, { status: 400 });
  }

  const isYouTube =
    source === 'youtube' || (trackUrl ? isYouTubeUrl(trackUrl) : false);

  try {
    if (isYouTube) {
      const resolved = await resolveYouTubeStream(trackUrl, trackId);

      // Direct audio proxy mode for <audio> playback (preserves Range headers & server IP/UA)
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
          return NextResponse.json(
            { error: `Upstream YouTube stream error (${upstream.status})` },
            { status: 502 }
          );
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

      // Return proxied stream URL for the player
      const proxyParams = new URLSearchParams({
        url: trackUrl || '',
        id: trackId || '',
        source: 'youtube',
        proxy: '1',
      });

      return NextResponse.json({
        streamUrl: `/api/stream?${proxyParams.toString()}`,
        isHls: false,
        mimeType: resolved.mimeType,
      });
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

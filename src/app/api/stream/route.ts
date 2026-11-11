import { NextRequest, NextResponse } from 'next/server';
import { resolveStreamInfo } from '@/lib/soundcloud';
import {
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

  if (!trackUrl && !trackId) {
    return NextResponse.json({ error: 'Track URL or ID required' }, { status: 400 });
  }

  const isYouTube =
    source === 'youtube' || (trackUrl ? isYouTubeUrl(trackUrl) : false);

  try {
    const resolved = isYouTube
      ? await resolveYouTubeFallbackViaSoundCloud(trackUrl, trackId, title)
      : await resolveStreamInfo(trackUrl, trackId);

    return NextResponse.json({
      streamUrl: resolved.streamUrl,
      isHls: resolved.isHls,
      mimeType: resolved.mimeType,
      durationSeconds: resolved.durationSeconds,
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

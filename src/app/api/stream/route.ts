import { NextRequest, NextResponse } from 'next/server';
import { resolveStreamInfo } from '@/lib/soundcloud';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const trackUrl = searchParams.get('url');
  const trackId  = searchParams.get('id');

  if (!trackUrl && !trackId) {
    return NextResponse.json({ error: 'Track URL or ID required' }, { status: 400 });
  }

  try {
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

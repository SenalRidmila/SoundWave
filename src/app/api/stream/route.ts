import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const trackUrl = searchParams.get('url');

  if (!trackUrl) {
    return NextResponse.json({ error: 'Track URL required' }, { status: 400 });
  }

  try {
    // Get best audio stream URL from SoundCloud, prioritizing direct HTTP over HLS (m3u8)
    const ytdlp = (await import('yt-dlp-exec')).default;
    const streamUrl = await ytdlp(trackUrl, {
      f: 'http_mp3/bestaudio[ext=mp3]/bestaudio[protocol^=http]',
      getUrl: true,
      noWarnings: true
    }) as unknown as string;

    if (!streamUrl) {
      return NextResponse.json({ error: 'Could not get stream URL' }, { status: 500 });
    }

    return NextResponse.json({ streamUrl });
  } catch (error) {
    console.error('Stream error:', error);
    return NextResponse.json(
      { error: 'Streaming failed. yt-dlp may need a PATH restart.' },
      { status: 500 }
    );
  }
}

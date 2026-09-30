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
    // Get best audio stream URL natively using soundcloud-downloader
    const scdlModule = await import('soundcloud-downloader');
    const scdl = scdlModule.default;
    const axios = (await import('axios')).default;
    
    const clientID = await scdl.getClientID();
    const info = await scdl.getInfo(trackUrl);
    
    // Find progressive stream (native MP3)
    const progressiveFormat = info.media.transcodings.find(t => t.format.protocol === 'progressive');
    if (!progressiveFormat) {
      return NextResponse.json({ error: 'No progressive stream found' }, { status: 404 });
    }

    const res = await axios.get(`${progressiveFormat.url}?client_id=${clientID}`);
    const streamUrl = res.data.url;

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

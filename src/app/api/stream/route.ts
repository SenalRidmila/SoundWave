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
    
    // Find best audio stream (progressive MP3 preferred, fallback to HLS)
    const progressiveFormat = info.media.transcodings.find((t: any) => t.format.protocol === 'progressive');
    const hlsFormat = info.media.transcodings.find((t: any) => t.format.protocol === 'hls' && t.quality === 'sq')
      || info.media.transcodings.find((t: any) => t.format.protocol === 'hls');

    const selectedFormat = progressiveFormat || hlsFormat || info.media.transcodings[0];
    if (!selectedFormat) {
      return NextResponse.json({ error: 'No audio stream found for this track' }, { status: 404 });
    }

    const res = await axios.get(`${selectedFormat.url}?client_id=${clientID}`);
    const streamUrl = res.data.url;

    if (!streamUrl) {
      return NextResponse.json({ error: 'Could not get stream URL' }, { status: 500 });
    }

    return NextResponse.json({ 
      streamUrl,
      isHls: selectedFormat.format?.protocol === 'hls' || streamUrl.includes('.m3u8')
    });
  } catch (error) {
    console.error('Stream error:', error);
    return NextResponse.json(
      { error: 'Streaming failed. yt-dlp may need a PATH restart.' },
      { status: 500 }
    );
  }
}

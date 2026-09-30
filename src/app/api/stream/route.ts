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
    const ytDlpPath = 'C:\\\\Users\\\\Lenovo\\\\AppData\\\\Local\\\\Microsoft\\\\WinGet\\\\Packages\\\\yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe\\\\yt-dlp.exe';
    const { stdout } = await execAsync(
      `"${ytDlpPath}" -f "http_mp3/bestaudio[ext=mp3]/bestaudio[protocol^=http]" --get-url --no-warnings "${trackUrl}"`,
      { timeout: 25000 }
    );

    const streamUrl = stdout.trim().split('\n')[0];
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

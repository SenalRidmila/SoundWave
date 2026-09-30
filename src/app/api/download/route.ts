import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type AudioFormat = 'mp3-128' | 'mp3-256' | 'mp3-320' | 'flac' | 'wav';

interface FormatConfig {
  ext: string;
  mimeType: string;
  ffmpegArgs: string;
}

const FORMAT_CONFIGS: Record<AudioFormat, FormatConfig> = {
  'mp3-128': { ext: 'mp3',  mimeType: 'audio/mpeg', ffmpegArgs: '-vn -ab 128k -f mp3' },
  'mp3-256': { ext: 'mp3',  mimeType: 'audio/mpeg', ffmpegArgs: '-vn -ab 256k -f mp3' },
  'mp3-320': { ext: 'mp3',  mimeType: 'audio/mpeg', ffmpegArgs: '-vn -ab 320k -f mp3' },
  'flac':    { ext: 'flac', mimeType: 'audio/flac',  ffmpegArgs: '-vn -f flac' },
  'wav':     { ext: 'wav',  mimeType: 'audio/wav',   ffmpegArgs: '-vn -f wav' },
};

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().slice(0, 80);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const trackUrl  = searchParams.get('url');
  const format    = (searchParams.get('format') || 'mp3-320') as AudioFormat;
  const title     = searchParams.get('title') || 'soundcloud-track';

  if (!trackUrl) {
    return NextResponse.json({ error: 'Track URL required' }, { status: 400 });
  }

  const config = FORMAT_CONFIGS[format];
  if (!config) {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  }

  const safeTitle  = sanitizeFilename(title);
  const cacheKey   = Buffer.from(trackUrl + format).toString('base64').replace(/[^a-z0-9]/gi, '').slice(0, 32);
  const outputPath = path.join(os.tmpdir(), `sc_${cacheKey}.${config.ext}`);

  try {
    // Check cache (1 hour)
    if (fs.existsSync(outputPath)) {
      const { mtimeMs, size } = fs.statSync(outputPath);
      if (size > 0 && Date.now() - mtimeMs < 3_600_000) {
        const buf = fs.readFileSync(outputPath);
        return new NextResponse(buf, {
          headers: {
            'Content-Type': config.mimeType,
            'Content-Disposition': `attachment; filename="${safeTitle}.${config.ext}"`,
            'Content-Length': String(buf.length),
            'Access-Control-Expose-Headers': 'Content-Disposition',
          },
        });
      }
    }

    // Step 1: Get best audio stream URL from SoundCloud via yt-dlp
    const ytDlpPath = 'C:\\\\Users\\\\Lenovo\\\\AppData\\\\Local\\\\Microsoft\\\\WinGet\\\\Packages\\\\yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe\\\\yt-dlp.exe';
    const { stdout: urlOut } = await execAsync(
      `"${ytDlpPath}" -f "http_mp3/bestaudio[ext=mp3]/bestaudio[protocol^=http]" --get-url --no-warnings "${trackUrl}"`,
      { timeout: 30000 }
    );
    const streamUrl = urlOut.trim().split('\n')[0];
    if (!streamUrl) throw new Error('No stream URL returned');

    // Step 2: Convert with FFmpeg
    const ffmpegBin = 'C:\\\\ffmpeg\\\\bin\\\\ffmpeg.exe';
    await execAsync(
      `"${ffmpegBin}" -y -i "${streamUrl}" ${config.ffmpegArgs} "${outputPath}"`,
      { timeout: 90000 }
    );

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      throw new Error('FFmpeg conversion produced empty file');
    }

    const buf = fs.readFileSync(outputPath);

    // Clean up after 1 min
    setTimeout(() => { try { fs.unlinkSync(outputPath); } catch {} }, 60_000);

    return new NextResponse(buf, {
      headers: {
        'Content-Type': config.mimeType,
        'Content-Disposition': `attachment; filename="${safeTitle}.${config.ext}"`,
        'Content-Length': String(buf.length),
        'Cache-Control': 'no-store',
        'Access-Control-Expose-Headers': 'Content-Disposition',
      },
    });

  } catch (err) {
    console.error('Download error:', err);
    return NextResponse.json(
      { error: 'Download failed. Ensure yt-dlp and ffmpeg are installed and in PATH.' },
      { status: 500 }
    );
  }
}

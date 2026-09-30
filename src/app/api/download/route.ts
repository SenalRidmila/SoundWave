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

    // Step 1: Get best audio stream URL natively using soundcloud-downloader
    const scdlModule = await import('soundcloud-downloader');
    const scdl = scdlModule.default;
    const axios = (await import('axios')).default;
    
    const clientID = await scdl.getClientID();
    const info = await scdl.getInfo(trackUrl);
    
    // Find progressive stream (native MP3)
    const progressiveFormat = info.media.transcodings.find(t => t.format.protocol === 'progressive');
    if (!progressiveFormat) {
      throw new Error('No progressive stream found');
    }

    const res = await axios.get(`${progressiveFormat.url}?client_id=${clientID}`);
    const streamUrl = res.data.url;
    
    if (!streamUrl) throw new Error('No stream URL returned');

    // Step 2: Convert or bypass FFmpeg
    // If MP3, stream the response directly to the user (instant start)
    if (config.ext === 'mp3') {
      const audioRes = await fetch(streamUrl);
      
      if (!audioRes.ok || !audioRes.body) {
        throw new Error('Failed to fetch audio stream');
      }
      
      return new NextResponse(audioRes.body, {
        headers: {
          'Content-Type': config.mimeType,
          'Content-Disposition': `attachment; filename="${safeTitle}.${config.ext}"`,
          'Content-Length': audioRes.headers.get('content-length') || '',
          'Cache-Control': 'no-store',
          'Access-Control-Expose-Headers': 'Content-Disposition',
        },
      });
    }

    // For FLAC/WAV, use FFmpeg
    const ffmpegInstaller = (await import('@ffmpeg-installer/ffmpeg')).default;
    const ffmpegBin = ffmpegInstaller.path;
    
    // Ensure executable permissions on Vercel
    try { fs.chmodSync(ffmpegBin, 0o755); } catch (e) {}

    await execAsync(
      `"${ffmpegBin}" -y -i "${streamUrl.trim()}" ${config.ffmpegArgs} "${outputPath}"`,
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

  } catch (err: any) {
    console.error('Download error:', err);
    return NextResponse.json(
      { error: `Download failed: ${err.message || 'Server error'}` },
      { status: 500 }
    );
  }
}

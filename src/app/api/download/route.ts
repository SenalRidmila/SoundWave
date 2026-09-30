import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type AudioFormat = 'mp3-128' | 'mp3-256' | 'mp3-320' | 'flac' | 'wav';

interface FormatConfig {
  ext: string;
  mimeType: string;
  ffmpegArgs: string[];
}

const FORMAT_CONFIGS: Record<AudioFormat, FormatConfig> = {
  'mp3-128': { ext: 'mp3',  mimeType: 'audio/mpeg', ffmpegArgs: ['-vn', '-ab', '128k', '-f', 'mp3'] },
  'mp3-256': { ext: 'mp3',  mimeType: 'audio/mpeg', ffmpegArgs: ['-vn', '-ab', '256k', '-f', 'mp3'] },
  'mp3-320': { ext: 'mp3',  mimeType: 'audio/mpeg', ffmpegArgs: ['-vn', '-ab', '320k', '-f', 'mp3'] },
  'flac':    { ext: 'flac', mimeType: 'audio/flac',  ffmpegArgs: ['-vn', '-compression_level', '0', '-f', 'flac'] },
  'wav':     { ext: 'wav',  mimeType: 'audio/wav',   ffmpegArgs: ['-vn', '-f', 'wav'] },
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

  const safeTitle = sanitizeFilename(title);

  try {
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

    // Step 2: Convert with FFmpeg on-the-fly and pipe directly to client
    const ffmpegInstaller = (await import('@ffmpeg-installer/ffmpeg')).default;
    const ffmpegBin = ffmpegInstaller.path;
    
    // Ensure executable permissions on Vercel
    try { fs.chmodSync(ffmpegBin, 0o755); } catch (e) {}

    const stream = new ReadableStream({
      start(controller) {
        const ffmpegProcess = spawn(ffmpegBin, [
          '-threads', '2',
          '-analyzeduration', '0',
          '-fflags', 'nobuffer',
          '-i', streamUrl.trim(),
          ...config.ffmpegArgs,
          '-flush_packets', '1',
          'pipe:1'
        ]);

        ffmpegProcess.stdout.on('data', (chunk) => {
          controller.enqueue(new Uint8Array(chunk));
        });

        ffmpegProcess.stdout.on('end', () => {
          controller.close();
        });

        ffmpegProcess.stderr.on('data', (data) => {
          // You can log stderr if you need to debug FFmpeg
        });

        ffmpegProcess.on('error', (err) => {
          console.error('FFmpeg error:', err);
          controller.error(err);
        });
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': config.mimeType,
        'Content-Disposition': `attachment; filename="${safeTitle}.${config.ext}"`,
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no', // Tell Vercel/Nginx NOT to buffer this stream
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

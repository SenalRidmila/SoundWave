import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveStreamInfo, getHlsSegmentUrls } from '@/lib/soundcloud';
import {
  resolveYouTubeFallbackViaSoundCloud,
  isYouTubeUrl,
} from '@/lib/youtube';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type AudioFormat = 'mp3-128' | 'mp3-256' | 'mp3-320' | 'flac' | 'wav';

interface FormatConfig {
  ext: string;
  mimeType: string;
  ffmpegArgs: string[];
}

const FORMAT_CONFIGS: Record<AudioFormat, FormatConfig> = {
  'mp3-128': {
    ext: 'mp3',
    mimeType: 'audio/mpeg',
    ffmpegArgs: ['-vn', '-c:a', 'libmp3lame', '-b:a', '128k', '-compression_level', '9', '-f', 'mp3'],
  },
  'mp3-256': {
    ext: 'mp3',
    mimeType: 'audio/mpeg',
    ffmpegArgs: ['-vn', '-c:a', 'libmp3lame', '-b:a', '256k', '-compression_level', '9', '-f', 'mp3'],
  },
  'mp3-320': {
    ext: 'mp3',
    mimeType: 'audio/mpeg',
    ffmpegArgs: ['-vn', '-c:a', 'libmp3lame', '-b:a', '320k', '-compression_level', '9', '-f', 'mp3'],
  },
  'flac': {
    ext: 'flac',
    mimeType: 'audio/flac',
    ffmpegArgs: ['-vn', '-compression_level', '0', '-f', 'flac'],
  },
  'wav': {
    ext: 'wav',
    mimeType: 'audio/wav',
    ffmpegArgs: ['-vn', '-f', 'wav'],
  },
};

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().slice(0, 100) || 'music-track';
}

async function fetchBufferWithRetry(url: string, retries = 2): Promise<Uint8Array> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        cache: 'no-store',
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const ab = await res.arrayBuffer();
      return new Uint8Array(ab);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to fetch audio segment');
}

async function downloadSoundCloudSourceBuffer(streamUrl: string, isHls: boolean): Promise<Buffer> {
  if (!isHls) {
    const bytes = await fetchBufferWithRetry(streamUrl);
    return Buffer.from(bytes);
  }

  const segmentUrls = await getHlsSegmentUrls(streamUrl);
  const chunks: Buffer[] = new Array(segmentUrls.length);
  const batchSize = 24;

  for (let i = 0; i < segmentUrls.length; i += batchSize) {
    const batch = segmentUrls.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((u) => fetchBufferWithRetry(u)));
    for (let j = 0; j < results.length; j++) {
      chunks[i + j] = Buffer.from(results[j]);
    }
  }

  return Buffer.concat(chunks);
}

async function createFfmpegReadableStream(
  inputBuffer: Buffer,
  config: FormatConfig
): Promise<ReadableStream<Uint8Array>> {
  const ffmpegInstaller = (await import('@ffmpeg-installer/ffmpeg')).default;
  const ffmpegBin = ffmpegInstaller.path;

  try {
    fs.chmodSync(ffmpegBin, 0o755);
  } catch {
    // Ignore on Windows or read-only FS
  }

  const tmpDir = os.tmpdir();
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inputPath = path.join(tmpDir, `sw-in-${uid}.tmp`);

  await fs.promises.writeFile(inputPath, inputBuffer);

  let proc: ReturnType<typeof spawn> | null = null;
  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    fs.promises.unlink(inputPath).catch(() => {});
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let stderr = '';

      proc = spawn(ffmpegBin, [
        '-nostdin',
        '-hide_banner',
        '-loglevel', 'error',
        '-threads', '2',
        '-i', inputPath,
        ...config.ffmpegArgs,
        'pipe:1',
      ]);

      proc.stdout?.on('data', (chunk: Buffer) => {
        if (!closed) {
          controller.enqueue(new Uint8Array(chunk));
        }
      });

      proc.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString();
      });

      proc.on('error', (err) => {
        cleanup();
        if (!closed) {
          closed = true;
          controller.error(err);
        }
      });

      proc.on('close', (code) => {
        cleanup();
        if (closed) return;
        closed = true;
        if (code === 0) {
          controller.close();
        } else {
          const detail = stderr.trim().split('\n').pop() || `exit code ${code}`;
          controller.error(new Error(`FFmpeg conversion failed: ${detail}`));
        }
      });
    },
    cancel() {
      if (proc && !proc.killed) {
        try {
          proc.kill('SIGKILL');
        } catch {
          // Ignore
        }
      }
      cleanup();
    },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const trackUrl = searchParams.get('url');
  const trackId  = searchParams.get('id');
  const source   = searchParams.get('source');
  const format   = (searchParams.get('format') || 'mp3-320') as AudioFormat;
  const title    = searchParams.get('title') || 'music-track';

  if (!trackUrl && !trackId) {
    return NextResponse.json({ error: 'Track URL or ID required' }, { status: 400 });
  }

  const config = FORMAT_CONFIGS[format];
  if (!config) {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  }

  const safeTitle = sanitizeFilename(title);
  const responseHeaders: Record<string, string> = {
    'Content-Type': config.mimeType,
    'Content-Disposition': `attachment; filename="download.${config.ext}"; filename*=UTF-8''${encodeURIComponent(safeTitle)}.${config.ext}`,
    'Cache-Control': 'no-store',
    'X-Accel-Buffering': 'no',
    'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length',
  };

  const isYouTube =
    source === 'youtube' || (trackUrl ? isYouTubeUrl(trackUrl) : false);

  try {
    const resolved = isYouTube
      ? await resolveYouTubeFallbackViaSoundCloud(
          trackUrl,
          trackId,
          title !== 'music-track' ? title : null
        )
      : await resolveStreamInfo(trackUrl, trackId);

    // Direct zero-FFmpeg fast path when user requests standard 128kbps MP3 and source is already real MP3
    if (format === 'mp3-128' && resolved.isMp3) {
      if (!resolved.isHls) {
        const upstream = await fetch(resolved.streamUrl, {
          headers: { 'User-Agent': USER_AGENT },
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        });

        if (!upstream.ok || !upstream.body) {
          throw new Error(`Failed to fetch progressive audio (${upstream.status})`);
        }

        const contentLength = upstream.headers.get('content-length');
        if (contentLength) {
          responseHeaders['Content-Length'] = contentLength;
        }

        return new NextResponse(upstream.body, { headers: responseHeaders });
      }

      const segmentUrls = await getHlsSegmentUrls(resolved.streamUrl);
      let cancelled = false;

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            const batchSize = 24;
            for (let i = 0; i < segmentUrls.length; i += batchSize) {
              if (cancelled) break;
              const batch = segmentUrls.slice(i, i + batchSize);
              const buffers = await Promise.all(batch.map((u) => fetchBufferWithRetry(u)));
              for (const buf of buffers) {
                if (cancelled) break;
                controller.enqueue(buf);
              }
            }
            if (!cancelled) {
              controller.close();
            }
          } catch (err) {
            if (!cancelled) {
              controller.error(err);
            }
          }
        },
        cancel() {
          cancelled = true;
        },
      });

      return new NextResponse(stream, { headers: responseHeaders });
    }

    // Download source segments in parallel, then stream FFmpeg output directly to the response
    const sourceBuffer = await downloadSoundCloudSourceBuffer(resolved.streamUrl, resolved.isHls);
    const ffmpegStream = await createFfmpegReadableStream(sourceBuffer, config);

    return new NextResponse(ffmpegStream, {
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    console.error('Download error:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json(
      { error: `Download failed: ${message}` },
      { status: 500 }
    );
  }
}

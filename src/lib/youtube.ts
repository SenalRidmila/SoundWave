import { Song } from '@/types';

const WEB_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const ANDROID_VR_UA =
  'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip';

const IOS_UA =
  'com.google.ios.youtube/20.03.02 (iPhone16,2; U; CPU iOS 18_2_1 like Mac OS X;)';

export interface ResolvedYouTubeStream {
  streamUrl: string;
  mimeType: string;
  userAgent: string;
  contentLength?: number;
  isHls?: boolean;
}

interface GlobalYTCache {
  ytStreamCache?: Map<string, { resolved: ResolvedYouTubeStream; expiresAt: number }>;
}

const g = globalThis as unknown as GlobalYTCache;
if (!g.ytStreamCache) g.ytStreamCache = new Map();

const STREAM_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = u.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      const parts = u.pathname.split('/').filter(Boolean);
      if ((parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'v') && parts[1]) {
        return /^[a-zA-Z0-9_-]{11}$/.test(parts[1]) ? parts[1] : null;
      }
    }
  } catch {
    // Not a valid URL
  }
  return null;
}

export function isYouTubeUrl(input: string): boolean {
  const trimmed = input.trim().toLowerCase();
  return (
    trimmed.includes('youtube.com/') ||
    trimmed.includes('youtu.be/') ||
    trimmed.includes('music.youtube.com/')
  );
}

function parseDurationToSeconds(durationStr: string): number {
  if (!durationStr) return 0;
  const parts = durationStr.split(':').map((p) => parseInt(p.trim(), 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
}

function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function formatViewCount(raw?: string): string {
  if (!raw) return '';
  return raw.replace(/\s*views?/i, '').trim();
}

export async function searchYouTubeTracks(query: string, limit = 20): Promise<Song[]> {
  const res = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: {
      'User-Agent': WEB_USER_AGENT,
      'Content-Type': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      Origin: 'https://www.youtube.com',
      Referer: 'https://www.youtube.com/',
    },
    body: JSON.stringify({
      context: {
        client: {
          hl: 'en',
          gl: 'US',
          clientName: 'WEB',
          clientVersion: '2.20250101.00.00',
        },
      },
      query,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`YouTube search failed (${res.status})`);
  }

  const data = await res.json();
  const sections =
    data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

  const songs: Song[] = [];

  for (const section of sections) {
    const items = section?.itemSectionRenderer?.contents || [];
    for (const item of items) {
      const v = item?.videoRenderer;
      if (!v?.videoId) continue;

      const durationText: string =
        v?.lengthText?.simpleText ||
        v?.lengthText?.runs?.[0]?.text ||
        '';

      // Skip live streams without duration
      if (!durationText) continue;

      const durationSeconds = parseDurationToSeconds(durationText);
      if (durationSeconds <= 0) continue;

      const title =
        v?.title?.runs?.map((r: { text?: string }) => r.text || '').join('') ||
        v?.title?.simpleText ||
        'Unknown Title';

      const artist =
        v?.ownerText?.runs?.[0]?.text ||
        v?.longBylineText?.runs?.[0]?.text ||
        v?.shortBylineText?.runs?.[0]?.text ||
        'YouTube Artist';

      const rawViews =
        v?.shortViewCountText?.simpleText ||
        v?.shortViewCountText?.runs?.[0]?.text ||
        v?.viewCountText?.simpleText ||
        '';

      const videoId: string = v.videoId;
      const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      songs.push({
        id: videoId,
        title,
        artist,
        thumbnail,
        duration: durationText,
        durationSeconds,
        viewCount: formatViewCount(rawViews),
        url: `https://www.youtube.com/watch?v=${videoId}`,
        source: 'youtube',
      });

      if (songs.length >= limit) break;
    }
    if (songs.length >= limit) break;
  }

  return songs;
}

interface InnerTubeFormat {
  itag?: number;
  url?: string;
  mimeType?: string;
  bitrate?: number;
  averageBitrate?: number;
  contentLength?: string;
  audioQuality?: string;
}

function pickBestAudioFormat(formats: InnerTubeFormat[]): InnerTubeFormat | null {
  const audioFormats = formats.filter(
    (f) => f?.url && typeof f.mimeType === 'string' && f.mimeType.startsWith('audio/')
  );
  if (!audioFormats.length) return null;

  // Prefer audio/mp4 (itag 140) or highest bitrate audio
  audioFormats.sort((a, b) => {
    const aIsM4a = a.mimeType?.includes('mp4') ? 1 : 0;
    const bIsM4a = b.mimeType?.includes('mp4') ? 1 : 0;
    if (aIsM4a !== bIsM4a) return bIsM4a - aIsM4a;
    return (b.averageBitrate || b.bitrate || 0) - (a.averageBitrate || a.bitrate || 0);
  });

  return audioFormats[0];
}

async function tryInnerTubeClient(
  videoId: string,
  clientConfig: {
    clientName: string;
    clientVersion: string;
    userAgent: string;
    extraClientFields?: Record<string, unknown>;
  }
): Promise<ResolvedYouTubeStream | null> {
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'User-Agent': clientConfig.userAgent,
        'Content-Type': 'application/json',
        'X-YouTube-Client-Name': clientConfig.clientName === 'IOS' ? '5' : '28',
        'X-YouTube-Client-Version': clientConfig.clientVersion,
        Origin: 'https://www.youtube.com',
      },
      body: JSON.stringify({
        videoId,
        ContentCheckOk: true,
        racyCheckOk: true,
        context: {
          client: {
            clientName: clientConfig.clientName,
            clientVersion: clientConfig.clientVersion,
            hl: 'en',
            gl: 'US',
            ...clientConfig.extraClientFields,
          },
        },
      }),
      cache: 'no-store',
    });

    if (!res.ok) return null;
    const data = await res.json();

    if (data?.playabilityStatus?.status !== 'OK') {
      return null;
    }

    const adaptive: InnerTubeFormat[] = data?.streamingData?.adaptiveFormats || [];
    const standard: InnerTubeFormat[] = data?.streamingData?.formats || [];
    const best = pickBestAudioFormat([...adaptive, ...standard]);

    if (best?.url) {
      // Verify the stream URL doesn't return 403 on this IP
      const probe = await fetch(best.url, {
        headers: {
          'User-Agent': clientConfig.userAgent,
          Range: 'bytes=0-0',
        },
        cache: 'no-store',
      });
      if (probe.ok || probe.status === 206) {
        return {
          streamUrl: best.url,
          mimeType: best.mimeType?.split(';')[0] || 'audio/mp4',
          userAgent: clientConfig.userAgent,
          contentLength: best.contentLength ? parseInt(best.contentLength, 10) : undefined,
          isHls: false,
        };
      }
    }

    // Check hlsManifestUrl if no adaptive audio format had direct URL
    if (data?.streamingData?.hlsManifestUrl) {
      return {
        streamUrl: data.streamingData.hlsManifestUrl,
        mimeType: 'application/vnd.apple.mpegurl',
        userAgent: clientConfig.userAgent,
        isHls: true,
      };
    }

    return null;
  } catch {
    return null;
  }
}

async function tryPipedInstances(videoId: string): Promise<ResolvedYouTubeStream | null> {
  const instances = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.private.coffee',
    'https://pipedapi.tokhmi.xyz',
    'https://pipedapi-libre.kavin.rocks',
  ];

  const controllers = instances.map(() => new AbortController());

  try {
    const result = await Promise.any(
      instances.map(async (base, idx) => {
        const timeout = setTimeout(() => controllers[idx].abort(), 6000);
        try {
          const res = await fetch(`${base}/streams/${videoId}`, {
            headers: { 'User-Agent': WEB_USER_AGENT, Accept: 'application/json' },
            signal: controllers[idx].signal,
            cache: 'no-store',
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const streams: Array<{
            url?: string;
            mimeType?: string;
            bitrate?: number;
            contentLength?: number;
          }> = data?.audioStreams || [];

          if (!streams.length) throw new Error('No audioStreams');
          streams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
          const best = streams[0];
          if (!best?.url) throw new Error('Missing URL');

          return {
            streamUrl: best.url,
            mimeType: best.mimeType?.split(';')[0] || 'audio/mp4',
            userAgent: WEB_USER_AGENT,
            contentLength: best.contentLength && best.contentLength > 0 ? best.contentLength : undefined,
            isHls: false,
          } satisfies ResolvedYouTubeStream;
        } finally {
          clearTimeout(timeout);
        }
      })
    );

    controllers.forEach((c) => c.abort());
    return result;
  } catch {
    return null;
  }
}

async function tryInvidiousInstances(videoId: string): Promise<ResolvedYouTubeStream | null> {
  const instances = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://yewtu.be',
  ];

  const controllers = instances.map(() => new AbortController());

  try {
    const result = await Promise.any(
      instances.map(async (base, idx) => {
        const timeout = setTimeout(() => controllers[idx].abort(), 6000);
        try {
          const res = await fetch(`${base}/api/v1/videos/${videoId}?local=true`, {
            headers: { 'User-Agent': WEB_USER_AGENT, Accept: 'application/json' },
            signal: controllers[idx].signal,
            cache: 'no-store',
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const formats: InnerTubeFormat[] = data?.adaptiveFormats || [];
          const best = pickBestAudioFormat(formats);
          if (!best?.url) throw new Error('No audio format');

          const finalUrl = best.url.startsWith('http')
            ? best.url
            : new URL(best.url, base).toString();

          return {
            streamUrl: finalUrl,
            mimeType: best.mimeType?.split(';')[0] || 'audio/mp4',
            userAgent: WEB_USER_AGENT,
            contentLength: best.contentLength ? parseInt(best.contentLength, 10) : undefined,
            isHls: false,
          } satisfies ResolvedYouTubeStream;
        } finally {
          clearTimeout(timeout);
        }
      })
    );

    controllers.forEach((c) => c.abort());
    return result;
  } catch {
    return null;
  }
}

export async function resolveYouTubeStream(
  trackUrl?: string | null,
  trackId?: string | null
): Promise<ResolvedYouTubeStream> {
  const videoId =
    (trackId && extractYouTubeId(trackId)) ||
    (trackUrl && extractYouTubeId(trackUrl));

  if (!videoId) {
    throw new Error('Invalid YouTube video ID or URL');
  }

  const now = Date.now();
  const cached = g.ytStreamCache?.get(videoId);
  if (cached && cached.expiresAt > now) {
    return cached.resolved;
  }

  // 1. Try ANDROID_VR InnerTube client (fast, works without signature deciphering)
  let resolved = await tryInnerTubeClient(videoId, {
    clientName: 'ANDROID_VR',
    clientVersion: '1.60.19',
    userAgent: ANDROID_VR_UA,
    extraClientFields: {
      androidSdkVersion: 32,
      osName: 'Android',
      osVersion: '12L',
      deviceMake: 'Oculus',
      deviceModel: 'Quest 2',
    },
  });

  // 2. Try IOS InnerTube client
  if (!resolved) {
    resolved = await tryInnerTubeClient(videoId, {
      clientName: 'IOS',
      clientVersion: '20.03.02',
      userAgent: IOS_UA,
      extraClientFields: {
        deviceMake: 'Apple',
        deviceModel: 'iPhone16,2',
        osName: 'iPhone',
        osVersion: '18.2.1.22C161',
      },
    });
  }

  // 3. Try Piped instances in parallel (great fallback on datacenter IPs)
  if (!resolved) {
    resolved = await tryPipedInstances(videoId);
  }

  // 4. Try Invidious instances in parallel
  if (!resolved) {
    resolved = await tryInvidiousInstances(videoId);
  }

  if (!resolved) {
    throw new Error('Could not resolve YouTube audio stream for this video');
  }

  if (g.ytStreamCache) {
    if (g.ytStreamCache.size > 300) g.ytStreamCache.clear();
    g.ytStreamCache.set(videoId, {
      resolved,
      expiresAt: Date.now() + STREAM_CACHE_TTL_MS,
    });
  }

  return resolved;
}

export async function downloadYouTubeAudioBuffer(resolved: ResolvedYouTubeStream): Promise<Buffer> {
  const totalLen = resolved.contentLength || 0;

  // Fetch in 4MB ranged chunks in parallel if contentLength is known (avoids YouTube throttling!)
  if (totalLen > 1024 * 1024 && !resolved.isHls) {
    const chunkSize = 4 * 1024 * 1024; // 4 MB chunks
    const ranges: Array<{ start: number; end: number }> = [];
    for (let start = 0; start < totalLen; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, totalLen - 1);
      ranges.push({ start, end });
    }

    try {
      const parts: Buffer[] = new Array(ranges.length);
      const batchSize = 4;
      for (let i = 0; i < ranges.length; i += batchSize) {
        const batch = ranges.slice(i, i + batchSize);
        const buffers = await Promise.all(
          batch.map(async ({ start, end }) => {
            const r = await fetch(resolved.streamUrl, {
              headers: {
                'User-Agent': resolved.userAgent,
                Range: `bytes=${start}-${end}`,
              },
              cache: 'no-store',
            });
            if (!r.ok && r.status !== 206) {
              throw new Error(`Chunk HTTP ${r.status}`);
            }
            return Buffer.from(await r.arrayBuffer());
          })
        );
        for (let j = 0; j < buffers.length; j++) {
          parts[i + j] = buffers[j];
        }
      }
      return Buffer.concat(parts);
    } catch {
      // Fall back to single request below
    }
  }

  const res = await fetch(resolved.streamUrl, {
    headers: { 'User-Agent': resolved.userAgent },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to download YouTube audio stream (${res.status})`);
  }

  return Buffer.from(await res.arrayBuffer());
}

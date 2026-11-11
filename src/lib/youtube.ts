import { Song } from '@/types';
import { searchSoundCloudTracks, resolveStreamInfo, ResolvedStream } from './soundcloud';

const WEB_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const IOS_UA =
  'com.google.ios.youtube/20.03.02 (iPhone16,2; U; CPU iOS 18_2_1 like Mac OS X;)';

const ANDROID_VR_UA =
  'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip';

export interface ResolvedYouTubeStream {
  streamUrl: string;
  mimeType: string;
  userAgent: string;
  contentLength?: number;
  isHls?: boolean;
}

interface GlobalYTCache {
  ytStreamCache?: Map<string, { resolved: ResolvedYouTubeStream; expiresAt: number }>;
  ytFallbackCache?: Map<string, { resolved: ResolvedStream; expiresAt: number }>;
  ytMetaCache?: Map<string, { title: string; expiresAt: number }>;
}

const g = globalThis as unknown as GlobalYTCache;
if (!g.ytStreamCache) g.ytStreamCache = new Map();
if (!g.ytFallbackCache) g.ytFallbackCache = new Map();
if (!g.ytMetaCache) g.ytMetaCache = new Map();

const STREAM_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const META_CACHE_TTL_MS = 30 * 60 * 1000;  // 30 minutes

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
    signal: AbortSignal.timeout(8000),
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

      if (g.ytMetaCache) {
        g.ytMetaCache.set(videoId, {
          title: `${artist} - ${title}`,
          expiresAt: Date.now() + META_CACHE_TTL_MS,
        });
      }

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

export async function fetchYouTubeTitle(videoId: string): Promise<string | null> {
  const cached = g.ytMetaCache?.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.title;
  }

  // 1. Try oEmbed first (fast)
  try {
    const u = new URL('https://www.youtube.com/oembed');
    u.searchParams.set('url', `https://www.youtube.com/watch?v=${videoId}`);
    u.searchParams.set('format', 'json');
    const res = await fetch(u.toString(), {
      headers: { 'User-Agent': WEB_USER_AGENT },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as { title?: string; author_name?: string };
      if (data?.title) {
        const cleanAuthor = (data.author_name || '').replace(/\s*-\s*Topic$/i, '').trim();
        const full = cleanAuthor ? `${cleanAuthor} - ${data.title}` : data.title;
        g.ytMetaCache?.set(videoId, { title: full, expiresAt: Date.now() + META_CACHE_TTL_MS });
        return full;
      }
    }
  } catch {
    // Fall through to InnerTube search
  }

  // 2. Fallback to InnerTube search by videoId (works even when embedding is disabled)
  try {
    const results = await searchYouTubeTracks(videoId, 1);
    if (results.length > 0) {
      const full = `${results[0].artist} - ${results[0].title}`;
      g.ytMetaCache?.set(videoId, { title: full, expiresAt: Date.now() + META_CACHE_TTL_MS });
      return full;
    }
  } catch {
    // Ignore
  }

  return null;
}

export function buildCandidateQueries(rawInput: string): string[] {
  const raw = (rawInput || '').trim();
  if (!raw) return [];

  const stripBracketsAndNoise = (s: string) =>
    s
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\{[^}]*\}/g, ' ')
      .replace(/#[^\s]+/g, ' ')
      .replace(
        /\b(official|music|video|audio|lyric|lyrics|visualizer|full|song|songs|new|sinhala|hindi|tamil|english|hd|hq|4k|8k|mv|feat|ft|with|prod|by|topic|vevo|records|entertainment|entertainments|creations|studio|studios|channel|subscribe|version|live|performance|ost|soundtrack)\b/gi,
        ' '
      )
      .replace(/\b(19|20)\d{2}\b/g, ' ')
      .replace(/[|•·~—–_/\\:+*!?,"'`&]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const dedupeWords = (s: string) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const w of s.split(/\s+/)) {
      const k = w.toLowerCase();
      if (k.length < 2 && !/^\d+$/.test(k)) continue;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(w);
      }
    }
    return out.join(' ');
  };

  const asciiOnly = (s: string) =>
    dedupeWords(s.replace(/[^\x20-\x7E]/g, ' ').replace(/-/g, ' '));

  // If rawInput is "Channel - Video Title", extract the video title without the channel prefix
  const dashParts = raw.split(/\s+-\s+/);
  const withoutChannelPrefix = dashParts.length >= 2 ? dashParts.slice(1).join(' - ') : raw;
  const firstPipeSegment = withoutChannelPrefix.split('|')[0].trim();
  const firstTrackSegment = firstPipeSegment.split(/\s+-\s+/)[0].trim();

  const cand1 = asciiOnly(stripBracketsAndNoise(firstPipeSegment));
  const cand2 = asciiOnly(stripBracketsAndNoise(raw)).split(/\s+/).slice(0, 5).join(' ');
  const cand3 = asciiOnly(stripBracketsAndNoise(firstTrackSegment));
  const cand4 = cand1.split(/\s+/).slice(0, 2).join(' ');
  const cand5 = cand2.split(/\s+/).slice(0, 2).join(' ');
  const cand6 = dedupeWords(stripBracketsAndNoise(firstPipeSegment).replace(/-/g, ' '));
  const cand7 = cand1.split(/\s+/)[0] || '';

  const all = [cand1, cand2, cand3, cand4, cand5, cand6, cand7];
  return [...new Set(all.map((c) => c.trim()).filter((c) => c.length >= 2))];
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
      },
      body: JSON.stringify({
        videoId,
        contentCheckOk: true,
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

    return null;
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

  // 1. Try IOS InnerTube client
  let resolved = await tryInnerTubeClient(videoId, {
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

  // 2. Try ANDROID_VR InnerTube client
  if (!resolved) {
    resolved = await tryInnerTubeClient(videoId, {
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
  }

  if (!resolved) {
    throw new Error('Direct YouTube stream blocked on this server IP');
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

/**
 * Resolves a matching SoundCloud CDN stream using multi-stage query progressive simplification
 * when YouTube blocks datacenter IPs (e.g. on Vercel).
 */
export async function resolveYouTubeFallbackViaSoundCloud(
  trackUrl?: string | null,
  trackId?: string | null,
  fallbackTitle?: string | null
): Promise<ResolvedStream> {
  const videoId =
    (trackId && extractYouTubeId(trackId)) ||
    (trackUrl && extractYouTubeId(trackUrl));

  const cacheKey = videoId || (fallbackTitle ? fallbackTitle.trim().toLowerCase() : '');
  const now = Date.now();
  if (cacheKey && g.ytFallbackCache) {
    const cached = g.ytFallbackCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.resolved;
    }
  }

  let rawTitle = fallbackTitle?.trim() || '';
  if (!rawTitle && videoId) {
    rawTitle = (await fetchYouTubeTitle(videoId)) || '';
  }

  const candidateQueries = buildCandidateQueries(rawTitle).slice(0, 5);
  if (videoId && candidateQueries.length === 0) {
    candidateQueries.push(videoId);
  }

  for (const query of candidateQueries) {
    try {
      const scTracks = await searchSoundCloudTracks(query, 5);
      for (const scTrack of scTracks) {
        try {
          const resolved = await resolveStreamInfo(scTrack.permalink_url, String(scTrack.id));
          if (cacheKey && g.ytFallbackCache) {
            if (g.ytFallbackCache.size > 300) g.ytFallbackCache.clear();
            g.ytFallbackCache.set(cacheKey, {
              resolved,
              expiresAt: Date.now() + STREAM_CACHE_TTL_MS,
            });
          }
          return resolved;
        } catch {
          // Try next track in search results
        }
      }
    } catch {
      // Try next simplified candidate query
    }
  }

  throw new Error('Could not resolve YouTube audio stream for this video');
}

export async function downloadYouTubeAudioBuffer(resolved: ResolvedYouTubeStream): Promise<Buffer> {
  const totalLen = resolved.contentLength || 0;

  if (totalLen > 1024 * 1024 && !resolved.isHls) {
    const chunkSize = 4 * 1024 * 1024;
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

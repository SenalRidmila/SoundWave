const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': USER_AGENT,
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://soundcloud.com',
  Referer: 'https://soundcloud.com/',
};

export interface SCTranscoding {
  url: string;
  preset?: string;
  duration?: number;
  snipped?: boolean;
  format?: {
    protocol?: string;
    mime_type?: string;
  };
  quality?: string;
}

export interface SCTrack {
  id: number;
  title: string;
  user?: { username?: string; avatar_url?: string };
  artwork_url?: string;
  duration: number;
  full_duration?: number;
  permalink_url: string;
  likes_count?: number;
  playback_count?: number;
  streamable?: boolean;
  policy?: string;
  genre?: string;
  track_authorization?: string;
  media?: {
    transcodings?: SCTranscoding[];
  };
}

export interface ResolvedStream {
  streamUrl: string;
  protocol: 'progressive' | 'hls';
  mimeType: string;
  isHls: boolean;
  isMp3: boolean;
}

interface GlobalSCCache {
  clientId?: string;
  clientIdExpiresAt?: number;
  clientIdPromise?: Promise<string> | null;
  trackCache?: Map<string, { track: SCTrack; expiresAt: number }>;
  streamCache?: Map<string, { resolved: ResolvedStream; expiresAt: number }>;
}

const g = globalThis as unknown as GlobalSCCache;
if (!g.trackCache) g.trackCache = new Map();
if (!g.streamCache) g.streamCache = new Map();

const CLIENT_ID_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const TRACK_CACHE_TTL_MS = 30 * 60 * 1000;   // 30 minutes
const STREAM_CACHE_TTL_MS = 3 * 60 * 1000;   // 3 minutes

function normalizeTrackUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.hostname === 'm.soundcloud.com' || parsed.hostname === 'www.soundcloud.com') {
      parsed.hostname = 'soundcloud.com';
    }
    parsed.hash = '';
    const secretToken = parsed.searchParams.get('secret_token');
    parsed.search = '';
    if (secretToken) {
      parsed.searchParams.set('secret_token', secretToken);
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return rawUrl.trim();
  }
}

export function cacheTrack(track: SCTrack): void {
  if (!track || !g.trackCache) return;
  const expiresAt = Date.now() + TRACK_CACHE_TTL_MS;

  if (g.trackCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of g.trackCache.entries()) {
      if (v.expiresAt < now || g.trackCache.size > 400) {
        g.trackCache.delete(k);
      }
    }
  }

  if (track.id) {
    g.trackCache.set(`id:${track.id}`, { track, expiresAt });
  }
  if (track.permalink_url) {
    g.trackCache.set(`url:${normalizeTrackUrl(track.permalink_url)}`, { track, expiresAt });
  }
}

function getCachedTrack(trackUrl?: string | null, trackId?: string | null): SCTrack | null {
  if (!g.trackCache) return null;
  const now = Date.now();

  if (trackId) {
    const byId = g.trackCache.get(`id:${trackId}`);
    if (byId && byId.expiresAt > now && byId.track.media?.transcodings?.length) {
      return byId.track;
    }
  }

  if (trackUrl) {
    const byUrl = g.trackCache.get(`url:${normalizeTrackUrl(trackUrl)}`);
    if (byUrl && byUrl.expiresAt > now && byUrl.track.media?.transcodings?.length) {
      return byUrl.track;
    }
  }

  return null;
}

async function scrapeClientId(): Promise<string> {
  if (process.env.SOUNDCLOUD_CLIENT_ID) {
    return process.env.SOUNDCLOUD_CLIENT_ID;
  }

  const res = await fetch('https://soundcloud.com/', {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to load soundcloud.com (${res.status})`);
  }

  const html = await res.text();
  const scriptRegex = /<script[^>]+src=["'](https:\/\/a-v2\.sndcdn\.com\/assets\/[^"']+\.js)["']/g;
  const scriptUrls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    scriptUrls.push(match[1]);
  }

  if (scriptUrls.length === 0) {
    throw new Error('Could not find SoundCloud asset scripts');
  }

  const candidates = [...scriptUrls].reverse();
  const keyRegex = /(?:client_id|clientId)\s*[:=]\s*["']([a-zA-Z0-9]{32})["']/;

  for (let i = 0; i < candidates.length; i += 4) {
    const batch = candidates.slice(i, i + 4);
    const texts = await Promise.all(
      batch.map(async (url) => {
        try {
          const r = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
            cache: 'no-store',
          });
          return r.ok ? await r.text() : '';
        } catch {
          return '';
        }
      })
    );

    for (const js of texts) {
      const m = keyRegex.exec(js);
      if (m?.[1]) {
        return m[1];
      }
    }
  }

  throw new Error('Unable to extract SoundCloud client_id from scripts');
}

export async function getClientId(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && g.clientId && g.clientIdExpiresAt && g.clientIdExpiresAt > now) {
    return g.clientId;
  }

  if (!forceRefresh && g.clientIdPromise) {
    return g.clientIdPromise;
  }

  g.clientIdPromise = (async () => {
    try {
      const id = await scrapeClientId();
      g.clientId = id;
      g.clientIdExpiresAt = Date.now() + CLIENT_ID_TTL_MS;
      return id;
    } finally {
      g.clientIdPromise = null;
    }
  })();

  return g.clientIdPromise;
}

async function scApiFetch<T>(buildUrl: (clientId: string) => string): Promise<T> {
  let clientId = await getClientId(false);
  let res = await fetch(buildUrl(clientId), {
    headers: DEFAULT_HEADERS,
    cache: 'no-store',
  });

  if (res.status === 401 || res.status === 403) {
    clientId = await getClientId(true);
    res = await fetch(buildUrl(clientId), {
      headers: DEFAULT_HEADERS,
      cache: 'no-store',
    });
  }

  if (!res.ok) {
    throw new Error(`SoundCloud API error (${res.status})`);
  }

  return (await res.json()) as T;
}

export async function searchSoundCloudTracks(query: string, limit = 20): Promise<SCTrack[]> {
  const data = await scApiFetch<{ collection?: SCTrack[] }>((clientId) => {
    const u = new URL('https://api-v2.soundcloud.com/search/tracks');
    u.searchParams.set('q', query);
    u.searchParams.set('client_id', clientId);
    u.searchParams.set('limit', String(limit));
    u.searchParams.set('offset', '0');
    return u.toString();
  });

  const tracks = (data?.collection || []).filter(
    (t) =>
      t &&
      t.streamable !== false &&
      t.policy !== 'BLOCK' &&
      Array.isArray(t.media?.transcodings) &&
      t.media!.transcodings!.length > 0
  );

  for (const track of tracks) {
    cacheTrack(track);
  }

  return tracks;
}

export async function getTrackInfo(
  trackUrl?: string | null,
  trackId?: string | null,
  skipCache = false
): Promise<SCTrack> {
  if (!skipCache) {
    const cached = getCachedTrack(trackUrl, trackId);
    if (cached) return cached;
  }

  if (trackId && /^\d+$/.test(trackId.trim())) {
    try {
      const track = await scApiFetch<SCTrack>((clientId) => {
        const u = new URL(`https://api-v2.soundcloud.com/tracks/${trackId.trim()}`);
        u.searchParams.set('client_id', clientId);
        return u.toString();
      });
      if (track?.media?.transcodings?.length) {
        cacheTrack(track);
        return track;
      }
    } catch {
      // Fall through to URL resolve
    }
  }

  if (!trackUrl) {
    throw new Error('Track URL or ID is required');
  }

  const cleanUrl = normalizeTrackUrl(trackUrl);

  if (cleanUrl.includes('personalized-tracks::')) {
    const parts = cleanUrl.split(':');
    const extractedId = parts[parts.length - 1];
    if (extractedId && /^\d+$/.test(extractedId)) {
      const track = await scApiFetch<SCTrack>((clientId) => {
        const u = new URL(`https://api-v2.soundcloud.com/tracks/${extractedId}`);
        u.searchParams.set('client_id', clientId);
        return u.toString();
      });
      cacheTrack(track);
      return track;
    }
  }

  const track = await scApiFetch<SCTrack>((clientId) => {
    const u = new URL('https://api-v2.soundcloud.com/resolve');
    u.searchParams.set('url', cleanUrl);
    u.searchParams.set('client_id', clientId);
    return u.toString();
  });

  if (!track?.media?.transcodings?.length) {
    throw new Error('No playable audio stream found for this track');
  }

  cacheTrack(track);
  return track;
}

function isRealMp3Mime(mime: string): boolean {
  const m = mime.toLowerCase();
  // Exclude 'audio/mpegurl' (which is SoundCloud's deprecated abr_sq HLS playlist that returns 404)
  if (m.includes('mpegurl')) return false;
  return m.includes('audio/mpeg') || m.includes('mp3');
}

function rankTranscodings(transcodings: SCTranscoding[]): SCTranscoding[] {
  if (!transcodings?.length) return [];

  const nonSnipped = transcodings.filter((t) => !t.snipped && t.url);
  const pool = nonSnipped.length > 0 ? nonSnipped : transcodings.filter((t) => t.url);

  const score = (t: SCTranscoding): number => {
    const mime = (t.format?.mime_type || '').toLowerCase();
    const proto = (t.format?.protocol || '').toLowerCase();
    const preset = (t.preset || '').toLowerCase();

    // Put deprecated abr_sq / audio/mpegurl last (usually returns 404 on SoundCloud)
    if (mime.includes('mpegurl') || preset === 'abr_sq') return 1;

    if (proto === 'progressive' && isRealMp3Mime(mime)) return 100;
    if (proto === 'hls' && isRealMp3Mime(mime) && t.quality === 'sq') return 90;
    if (proto === 'hls' && isRealMp3Mime(mime)) return 85;
    if (proto === 'hls' && preset.includes('160k')) return 80;
    if (proto === 'hls' && mime.includes('mp4') && t.quality === 'sq') return 75;
    if (proto === 'hls' && mime.includes('mp4')) return 70;
    if (proto === 'progressive') return 60;
    if (proto === 'hls') return 50;
    return 10;
  };

  return [...pool].sort((a, b) => score(b) - score(a));
}

async function tryResolveFromTrack(info: SCTrack): Promise<ResolvedStream | null> {
  const ranked = rankTranscodings(info.media?.transcodings || []);
  for (const candidate of ranked) {
    try {
      const data = await scApiFetch<{ url?: string }>((clientId) => {
        const mediaUrl = new URL(candidate.url);
        mediaUrl.searchParams.set('client_id', clientId);
        if (info.track_authorization) {
          mediaUrl.searchParams.set('track_authorization', info.track_authorization);
        }
        return mediaUrl.toString();
      });

      if (data?.url) {
        const mimeType = candidate.format?.mime_type || 'audio/mp4';
        const isHls = candidate.format?.protocol === 'hls' || data.url.includes('.m3u8');
        const isMp3 = isRealMp3Mime(mimeType);
        return {
          streamUrl: data.url,
          protocol: isHls ? 'hls' : 'progressive',
          mimeType,
          isHls,
          isMp3,
        };
      }
    } catch {
      // Try next transcoding candidate
    }
  }
  return null;
}

export async function resolveStreamInfo(
  trackUrl?: string | null,
  trackId?: string | null
): Promise<ResolvedStream> {
  const cacheKey = `${trackId || ''}|${trackUrl ? normalizeTrackUrl(trackUrl) : ''}`;
  const now = Date.now();
  const cachedStream = g.streamCache?.get(cacheKey);
  if (cachedStream && cachedStream.expiresAt > now) {
    return cachedStream.resolved;
  }

  let info = await getTrackInfo(trackUrl, trackId, false);
  let resolved = await tryResolveFromTrack(info);

  // If cached track transcodings expired, re-fetch fresh track info from SoundCloud API
  if (!resolved) {
    info = await getTrackInfo(trackUrl, trackId, true);
    resolved = await tryResolveFromTrack(info);
  }

  if (!resolved) {
    throw new Error('Could not resolve a playable SoundCloud stream for this track');
  }

  if (g.streamCache) {
    if (g.streamCache.size > 300) g.streamCache.clear();
    g.streamCache.set(cacheKey, {
      resolved,
      expiresAt: Date.now() + STREAM_CACHE_TTL_MS,
    });
  }

  return resolved;
}

export async function getHlsSegmentUrls(m3u8Url: string): Promise<string[]> {
  const res = await fetch(m3u8Url, {
    headers: { 'User-Agent': USER_AGENT },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch HLS playlist (${res.status})`);
  }

  const text = await res.text();
  const lines = text.split(/\r?\n/);
  const urls: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXT-X-MAP:')) {
      const uriMatch = /URI=["']([^"']+)["']/.exec(line);
      if (uriMatch?.[1]) {
        urls.push(new URL(uriMatch[1], m3u8Url).toString());
      }
      continue;
    }

    if (line.startsWith('#')) continue;
    urls.push(new URL(line, m3u8Url).toString());
  }

  if (urls.length === 0) {
    throw new Error('HLS playlist contained no audio segments');
  }

  return urls;
}

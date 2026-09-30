import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Duration: SoundCloud gives milliseconds
function fmtDuration(ms: number): string {
  const s  = Math.floor(ms / 1000);
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
  return `${m}:${String(sc).padStart(2, '0')}`;
}

function fmtCount(n?: number): string {
  if (!n) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// High-res artwork: replace 'large' with 't500x500'
function getArtwork(url?: string): string {
  if (!url) return '';
  return url.replace('-large.', '-t500x500.').replace('-large-', '-t500x500-');
}

interface SCTrack {
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
  genre?: string;
}

interface SCSearchResult {
  collection: SCTrack[];
  total_results?: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get('q');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 25);

  if (!query?.trim()) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  try {
    // Dynamic import to avoid SSR issues
    const scdlModule = await import('soundcloud-downloader');
    const scdl = scdlModule.default;

    // Get client_id automatically from SoundCloud website
    const clientID = await scdl.getClientID();

    // Search SoundCloud tracks
    const result: SCSearchResult = await scdl.search({
      query,
      resourceType: 'tracks',
      limit,
    });

    if (!result?.collection?.length) {
      return NextResponse.json({ songs: [] });
    }

    const songs = result.collection
      .filter((t) => t.streamable !== false)
      .map((t: SCTrack) => {
        const durationMs = t.full_duration || t.duration || 0;
        const artwork    = getArtwork(t.artwork_url || t.user?.avatar_url);
        return {
          id:              String(t.id),
          title:           t.title || 'Unknown Title',
          artist:          t.user?.username || 'Unknown Artist',
          thumbnail:       artwork || `https://picsum.photos/seed/${t.id}/320/320`,
          duration:        fmtDuration(durationMs),
          durationSeconds: Math.floor(durationMs / 1000),
          likeCount:       fmtCount(t.likes_count),
          viewCount:       fmtCount(t.playback_count),
          genre:           t.genre || '',
          url:             t.permalink_url,
        };
      });

    return NextResponse.json({ songs });

  } catch (error) {
    console.error('SoundCloud search error:', error);

    // Fallback: try yt-dlp if scdl fails
    try {
      const { exec }      = await import('child_process');
      const { promisify } = await import('util');
      const execAsync     = promisify(exec);

      const ytDlpPath = 'C:\\\\Users\\\\Lenovo\\\\AppData\\\\Local\\\\Microsoft\\\\WinGet\\\\Packages\\\\yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe\\\\yt-dlp.exe';
      const { stdout } = await execAsync(
        `"${ytDlpPath}" "scsearch${limit}:${query}" --dump-json --no-download --no-warnings 2>&1`,
        { timeout: 25000 }
      );

      const lines = stdout.trim().split('\n').filter(l => l.startsWith('{'));
      const tracks = lines.map((line) => {
        try {
          const t = JSON.parse(line);
          return {
            id:              t.id || t.webpage_url,
            title:           t.title || 'Unknown',
            artist:          t.artist || t.uploader || 'Unknown Artist',
            thumbnail:       t.thumbnail || '',
            duration:        fmtDuration((t.duration || 0) * 1000),
            durationSeconds: t.duration || 0,
            likeCount:       fmtCount(t.like_count),
            viewCount:       fmtCount(t.view_count),
            genre:           '',
            url:             t.webpage_url,
          };
        } catch { return null; }
      }).filter(Boolean);

      return NextResponse.json({ songs: tracks });

    } catch (ytErr) {
      console.error('yt-dlp fallback failed:', ytErr);
      return NextResponse.json(
        { error: 'Search failed. Check server logs.' },
        { status: 500 }
      );
    }
  }
}

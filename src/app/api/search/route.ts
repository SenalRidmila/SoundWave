import { NextRequest, NextResponse } from 'next/server';
import { searchSoundCloudTracks, SCTrack } from '@/lib/soundcloud';

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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get('q');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 25);

  if (!query?.trim()) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  try {
    const tracks = await searchSoundCloudTracks(query.trim(), limit);

    if (!tracks.length) {
      return NextResponse.json({ songs: [] });
    }

    const songs = tracks.map((t: SCTrack) => {
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
    return NextResponse.json(
      { error: 'Search failed. Please try again.' },
      { status: 500 }
    );
  }
}

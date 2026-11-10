'use client';

import { useState } from 'react';
import { Music2, Headphones, TrendingUp, Radio, Zap } from 'lucide-react';
import SearchBar, { YouTubeIcon, SoundCloudIcon } from '@/components/SearchBar';
import SongCard from '@/components/SongCard';
import { Song, MusicSource } from '@/types';
import { usePlayerStore } from '@/store/playerStore';

const TRENDING_QUERIES = [
  'Lo-fi hip hop', 'Afrobeats', 'Indie pop', 'EDM', 
  'R&B', 'Trap', 'Deep house', 'Chill vibes',
];

const FEATURES = [
  { icon: Zap,        label: 'Lightning Fast',  desc: 'SoundCloud & YouTube search' },
  { icon: Headphones, label: 'Multi-Size MP3',  desc: '320k, 256k, 128k, FLAC & WAV' },
  { icon: Radio,      label: 'Stream Free',     desc: 'No ads, no account needed'    },
];

export default function HomePage() {
  const { activeSource, setActiveSource } = usePlayerStore();
  const [songs,       setSongs]       = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading,   setIsLoading]   = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const isYT = activeSource === 'youtube';

  const handleResults = (results: Song[], query: string) => {
    setSongs(results);
    setSearchQuery(query);
    setHasSearched(true);
  };

  const runSearch = async (query: string, source: MusicSource = activeSource) => {
    if (!query.trim()) return;
    setIsLoading(true);
    setHasSearched(true);
    setSearchQuery(query);
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20&source=${source}`);
      const data = await res.json();
      setSongs(data.songs || []);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHeaderSourceChange = (source: MusicSource) => {
    setActiveSource(source);
    if (hasSearched && searchQuery.trim()) {
      runSearch(searchQuery, source);
    }
  };

  return (
    <main className="min-h-screen pb-32 sm:pb-36 overflow-x-hidden">

      {/* ── Header (Responsive for Mobile, Tablet & Desktop) ── */}
      <header className="sticky top-0 z-40 bg-gray-950/85 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          {/* Logo */}
          <button
            type="button"
            onClick={() => setHasSearched(false)}
            className="flex items-center gap-2 text-left group"
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-lg transition-all ${
                isYT
                  ? 'bg-gradient-to-br from-red-600 to-rose-600 shadow-red-600/30'
                  : 'bg-gradient-to-br from-orange-500 to-red-500 shadow-orange-500/30'
              }`}
            >
              <Music2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-base sm:text-lg tracking-tight">SoundWave</span>
          </button>

          {/* Header Platform Switcher (SoundCloud & YouTube Icons) */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => handleHeaderSourceChange('soundcloud')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                !isYT
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Switch to SoundCloud"
              id="header-sc-btn"
            >
              <SoundCloudIcon className="w-3.5 h-3.5" />
              <span>SoundCloud</span>
            </button>
            <button
              type="button"
              onClick={() => handleHeaderSourceChange('youtube')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isYT
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Switch to YouTube"
              id="header-yt-btn"
            >
              <YouTubeIcon className="w-3.5 h-3.5" />
              <span>YouTube</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero (only before first search) ── */}
      {!hasSearched && (
        <section className="relative overflow-hidden">
          {/* Animated glow blobs */}
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div
              className={`absolute top-12 sm:top-20 left-1/4 w-64 sm:w-96 h-64 sm:h-96 rounded-full blur-3xl animate-pulse ${
                isYT ? 'bg-red-600/15' : 'bg-orange-600/15'
              }`}
            />
            <div
              className="absolute top-28 right-1/4 w-56 sm:w-80 h-56 sm:h-80 bg-red-600/10 rounded-full blur-3xl animate-pulse"
              style={{ animationDelay: '1s' }}
            />
          </div>

          <div className="max-w-4xl mx-auto px-4 pt-10 sm:pt-16 lg:pt-20 pb-10 sm:pb-16 text-center">

            {/* Badge */}
            <div
              className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-1.5 border rounded-full text-xs sm:text-sm font-medium mb-6 sm:mb-8 sw-fade-in ${
                isYT
                  ? 'bg-red-500/10 border-red-500/25 text-red-300'
                  : 'bg-orange-500/10 border-orange-500/20 text-orange-300'
              }`}
            >
              {isYT ? <YouTubeIcon className="w-3.5 h-3.5 text-red-400" /> : <Zap className="w-3.5 h-3.5" />}
              <span>SoundCloud &amp; YouTube · Free · Multi-Size MP3</span>
            </div>

            {/* Heading */}
            <h1 className="text-3xl sm:text-5xl lg:text-7xl font-black text-white mb-4 sm:mb-6 leading-tight sw-slide-up">
              Stream &amp; Download
              <span
                className={`block bg-clip-text text-transparent ${
                  isYT
                    ? 'bg-gradient-to-r from-red-400 via-rose-400 to-orange-300'
                    : 'bg-gradient-to-r from-orange-400 via-red-400 to-orange-300'
                }`}
              >
                {isYT ? 'YouTube & SoundCloud' : 'SoundCloud & YouTube'}
              </span>
            </h1>

            <p className="text-gray-400 text-sm sm:text-lg lg:text-xl mb-8 sm:mb-10 max-w-2xl mx-auto px-2 sw-fade-in delay-100">
              Search millions of tracks on SoundCloud and YouTube. Stream instantly or download in MP3 (320k, 256k, 128k), FLAC, and WAV.
            </p>

            {/* Search bar */}
            <div className="sw-slide-up delay-200">
              <SearchBar onResults={handleResults} isLoading={isLoading} setIsLoading={setIsLoading} />
            </div>

            {/* Trending */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mt-6 sm:mt-8 sw-fade-in delay-300">
              <span className="flex items-center gap-1 text-gray-500 text-xs sm:text-sm mr-1">
                <TrendingUp className="w-3.5 h-3.5" /> Popular:
              </span>
              {TRENDING_QUERIES.map((q) => (
                <button
                  type="button"
                  key={q}
                  onClick={() => runSearch(q)}
                  className="px-2.5 sm:px-3 py-1 bg-white/5 hover:bg-orange-500/10 border border-white/10 hover:border-orange-400/40 text-gray-300 hover:text-orange-200 rounded-full text-xs sm:text-sm transition-all hover:scale-105"
                  id={`trending-${q.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Features — Responsive Grid for Mobile, Tablet & Desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mt-10 sm:mt-16 max-w-3xl mx-auto sw-fade-in delay-400">
              {FEATURES.map(({ icon: Icon, label, desc }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 text-left p-3.5 sm:p-4 rounded-2xl bg-white/[0.03] border border-white/5"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                      isYT
                        ? 'bg-gradient-to-br from-red-500/20 to-rose-500/20 border-red-500/20'
                        : 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border-orange-500/20'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isYT ? 'text-red-400' : 'text-orange-400'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{label}</p>
                    <p className="text-gray-500 text-xs truncate">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Search bar (shown after first search) ── */}
      {hasSearched && (
        <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-5 sm:pt-8 pb-4 sm:pb-6">
          <SearchBar onResults={handleResults} isLoading={isLoading} setIsLoading={setIsLoading} />
        </div>
      )}

      {/* ── Results ── */}
      {hasSearched && (
        <section className="max-w-4xl mx-auto px-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4">
            <h2 className="text-white font-bold text-sm sm:text-lg flex items-center gap-2 min-w-0">
              {songs.length > 0 ? (
                <span className="truncate">
                  {isYT ? 'YouTube' : 'SoundCloud'} results for{' '}
                  <span className={isYT ? 'text-red-400' : 'text-orange-400'}>
                    &ldquo;{searchQuery}&rdquo;
                  </span>
                </span>
              ) : (
                'No results found'
              )}
            </h2>
            {songs.length > 0 && (
              <span className="text-gray-500 text-xs sm:text-sm flex-shrink-0">{songs.length} tracks</span>
            )}
          </div>

          {/* Loading skeletons */}
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 rounded-xl bg-white/3 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="w-6 sm:w-8 h-4 bg-white/10 rounded" />
                  <div className="w-11 h-11 sm:w-12 sm:h-12 bg-white/10 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-white/10 rounded w-3/4" />
                    <div className="h-2.5 bg-white/10 rounded w-1/2" />
                  </div>
                  <div className="h-3 w-10 bg-white/10 rounded hidden sm:block" />
                </div>
              ))}
            </div>
          )}

          {/* Song list */}
          {!isLoading && songs.length > 0 && (
            <div className="space-y-1">
              {songs.map((song, i) => (
                <SongCard key={`${song.source || activeSource}-${song.id}`} song={song} queue={songs} index={i} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && songs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                <Music2 className="w-7 h-7 sm:w-8 sm:h-8 text-gray-600" />
              </div>
              <p className="text-gray-400 font-medium text-sm sm:text-base">
                No tracks found for &ldquo;{searchQuery}&rdquo;
              </p>
              <p className="text-gray-600 text-xs sm:text-sm mt-1">
                Try a different search term or switch between SoundCloud and YouTube above
              </p>
            </div>
          )}
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="mt-16 sm:mt-20 py-6 sm:py-8 border-t border-white/5 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
              <Music2 className="w-3 h-3 text-white" />
            </div>
            <span className="text-white font-bold text-sm sm:text-base">SoundWave</span>
          </div>
          <p className="text-gray-600 text-xs">
            SoundCloud &amp; YouTube Music · Personal use only · No stored data
          </p>
        </div>
      </footer>
    </main>
  );
}

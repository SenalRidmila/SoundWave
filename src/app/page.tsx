'use client';

import { useState } from 'react';
import { Music2, Headphones, TrendingUp, Radio, Zap, Heart, Download } from 'lucide-react';
import SearchBar from '@/components/SearchBar';
import SongCard from '@/components/SongCard';
import { Song } from '@/types';

const TRENDING_QUERIES = [
  'Lo-fi hip hop', 'Afrobeats', 'Indie pop', 'EDM', 
  'R&B', 'Trap', 'Deep house', 'Chill vibes',
];

const FEATURES = [
  { icon: Zap,        label: 'Lightning Fast',  desc: 'Instant SoundCloud search'  },
  { icon: Headphones, label: 'HD Audio',         desc: 'Up to 320kbps MP3 & FLAC'  },
  { icon: Radio,      label: 'Stream Free',      desc: 'No ads, no account needed' },
];

export default function HomePage() {
  const [songs,       setSongs]       = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading,   setIsLoading]   = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleResults = (results: Song[], query: string) => {
    setSongs(results);
    setSearchQuery(query);
    setHasSearched(true);
  };

  const handleTrendingClick = async (query: string) => {
    setIsLoading(true);
    setHasSearched(true);
    setSearchQuery(query);
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`);
      const data = await res.json();
      setSongs(data.songs || []);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen pb-32">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-gray-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* SoundCloud-style orange logo */}
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Music2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">SoundWave</span>
            <span className="hidden sm:inline-block text-xs text-orange-400/70 font-medium px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded-full">
              SoundCloud
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Home</a>
            <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Trending</a>
            <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Genres</a>
          </nav>
        </div>
      </header>

      {/* ── Hero (only before first search) ── */}
      {!hasSearched && (
        <section className="relative overflow-hidden">
          {/* Animated glow blobs */}
          <div className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute top-20 left-1/4 w-96 h-96 bg-orange-600/15 rounded-full blur-3xl animate-pulse" />
            <div className="absolute top-32 right-1/4 w-80 h-80 bg-red-600/10  rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-10 left-1/2  w-64 h-64 bg-yellow-600/8  rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
          </div>

          <div className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-300 text-sm font-medium mb-8 sw-fade-in">
              <Zap className="w-3.5 h-3.5" />
              SoundCloud · Free · No Login · HD Audio
            </div>

            {/* Heading */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-6 leading-tight sw-slide-up">
              Stream &amp; Download
              <span className="block bg-gradient-to-r from-orange-400 via-red-400 to-orange-300 bg-clip-text text-transparent">
                SoundCloud Music
              </span>
            </h1>

            <p className="text-gray-400 text-lg sm:text-xl mb-12 max-w-2xl mx-auto sw-fade-in delay-100">
              Search millions of SoundCloud tracks. Stream instantly or download in MP3, FLAC, WAV — no account required.
            </p>

            {/* Search bar */}
            <div className="sw-slide-up delay-200">
              <SearchBar onResults={handleResults} isLoading={isLoading} setIsLoading={setIsLoading} />
            </div>

            {/* Trending */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-8 sw-fade-in delay-300">
              <span className="flex items-center gap-1 text-gray-500 text-sm">
                <TrendingUp className="w-3.5 h-3.5" /> Popular:
              </span>
              {TRENDING_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleTrendingClick(q)}
                  className="px-3 py-1 bg-white/5 hover:bg-orange-500/10 border border-white/10 hover:border-orange-400/40 text-gray-300 hover:text-orange-200 rounded-full text-sm transition-all hover:scale-105"
                  id={`trending-${q.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Features */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-16 sw-fade-in delay-400">
              {FEATURES.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/20 rounded-xl flex items-center justify-center">
                    <Icon className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">{label}</p>
                    <p className="text-gray-500 text-xs">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Search bar (shown after first search) ── */}
      {hasSearched && (
        <div className="max-w-4xl mx-auto px-4 pt-8 pb-6">
          <SearchBar onResults={handleResults} isLoading={isLoading} setIsLoading={setIsLoading} />
        </div>
      )}

      {/* ── Results ── */}
      {hasSearched && (
        <section className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-lg">
              {songs.length > 0 ? (
                <>Results for <span className="text-orange-400">&ldquo;{searchQuery}&rdquo;</span></>
              ) : (
                'No results found'
              )}
            </h2>
            {songs.length > 0 && (
              <span className="text-gray-500 text-sm">{songs.length} tracks</span>
            )}
          </div>

          {/* Loading skeletons */}
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/3 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="w-8 h-4 bg-white/10 rounded" />
                  <div className="w-12 h-12 bg-white/10 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-white/10 rounded w-3/4" />
                    <div className="h-2.5 bg-white/10 rounded w-1/2" />
                  </div>
                  <div className="h-3 w-10 bg-white/10 rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Song list */}
          {!isLoading && songs.length > 0 && (
            <div className="space-y-1">
              {songs.map((song, i) => (
                <SongCard key={song.id} song={song} queue={songs} index={i} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && songs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                <Music2 className="w-8 h-8 text-gray-600" />
              </div>
              <p className="text-gray-400 font-medium">No tracks found for &ldquo;{searchQuery}&rdquo;</p>
              <p className="text-gray-600 text-sm mt-1">Try a different search term</p>
            </div>
          )}
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="mt-20 py-8 border-t border-white/5 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
              <Music2 className="w-3 h-3 text-white" />
            </div>
            <span className="text-white font-bold">SoundWave</span>
          </div>
          <p className="text-gray-600 text-xs">
            For personal use only · Respects SoundCloud Terms of Service · No stored data
          </p>
        </div>
      </footer>
    </main>
  );
}

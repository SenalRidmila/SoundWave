'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Music, Loader2 } from 'lucide-react';
import { Song, MusicSource } from '@/types';
import { usePlayerStore } from '@/store/playerStore';

interface SearchBarProps {
  onResults: (songs: Song[], query: string) => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
}

export function YouTubeIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function SoundCloudIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.56 8.87V17h8.76c1.85-.13 2.68-1.27 2.68-2.67 0-1.48-1.12-2.67-2.55-2.67-.35 0-.7.08-1.01.21-.29-2.29-2.22-4.06-4.57-4.06-1.26 0-2.42.51-3.31 1.06zm-2.12.63v7.5H10.5V9.09c-.38.12-.73.26-1.06.41zm-2.19 1.13V17h1.06V10.1c-.37.16-.73.34-1.06.53zm-2.18 1.54V17h1.06v-5.3c-.38.14-.74.3-1.06.47zm-2.19.83V17h1.06v-4.25c-.14-.02-.28-.03-.43-.03-.22 0-.43.03-.63.08zM1 14.08v2.52c.24.25.58.4.94.4h.06v-3.32c-.36 0-.76.15-1 .4z" />
    </svg>
  );
}

export default function SearchBar({ onResults, isLoading, setIsLoading }: SearchBarProps) {
  const { activeSource, setActiveSource } = usePlayerStore();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Song[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isYT = activeSource === 'youtube';

  const fetchSuggestions = useCallback(async (q: string, source: MusicSource) => {
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=5&source=${source}`);
      const data = await res.json();
      setSuggestions(data.songs?.slice(0, 5) || []);
    } catch {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim()) {
      debounceRef.current = setTimeout(() => fetchSuggestions(query, activeSource), 400);
    } else {
      setSuggestions([]);
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, activeSource, fetchSuggestions]);

  const handleSearch = async (searchQuery: string = query, sourceOverride?: MusicSource) => {
    if (!searchQuery.trim()) return;
    const targetSource = sourceOverride || activeSource;
    setShowSuggestions(false);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=20&source=${targetSource}`);
      const data = await res.json();
      if (data.source && data.source !== activeSource) {
        setActiveSource(data.source);
      }
      onResults(data.songs || [], searchQuery);
    } catch {
      onResults([], searchQuery);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSourceSwitch = (newSource: MusicSource) => {
    if (newSource === activeSource) return;
    setActiveSource(newSource);
    setSuggestions([]);
    if (query.trim()) {
      handleSearch(query, newSource);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
    if (e.key === 'Escape') { setShowSuggestions(false); inputRef.current?.blur(); }
  };

  const handleSuggestionClick = (song: Song) => {
    setQuery(song.title);
    setShowSuggestions(false);
    handleSearch(song.title);
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      {/* Platform Switcher Tabs (SoundCloud / YouTube) */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <button
          type="button"
          onClick={() => handleSourceSwitch('soundcloud')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border ${
            !isYT
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-400/50 shadow-lg shadow-orange-500/25 scale-[1.02]'
              : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border-white/10'
          }`}
          id="switch-soundcloud-btn"
        >
          <SoundCloudIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>SoundCloud</span>
        </button>

        <button
          type="button"
          onClick={() => handleSourceSwitch('youtube')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border ${
            isYT
              ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-red-400/50 shadow-lg shadow-red-600/25 scale-[1.02]'
              : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border-white/10'
          }`}
          id="switch-youtube-btn"
        >
          <YouTubeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 fill-current" />
          <span>YouTube</span>
        </button>
      </div>

      {/* Glow */}
      <div
        className={`absolute inset-x-0 bottom-0 h-16 rounded-2xl transition-all duration-500 blur-xl -z-10 ${
          isFocused
            ? isYT
              ? 'opacity-100 bg-gradient-to-r from-red-600/30 via-rose-500/25 to-red-500/30'
              : 'opacity-100 bg-gradient-to-r from-orange-500/25 via-red-500/25 to-orange-400/25'
            : 'opacity-0'
        }`}
      />

      {/* Input container */}
      <div
        className={`relative flex items-center gap-2 sm:gap-3 px-3.5 sm:px-5 py-3 sm:py-4 rounded-2xl border transition-all duration-300 ${
          isFocused
            ? isYT
              ? 'bg-white/10 border-red-500/60 shadow-2xl shadow-red-600/20'
              : 'bg-white/10 border-orange-400/60 shadow-2xl shadow-orange-500/20'
            : 'bg-white/5 border-white/10 hover:border-white/20'
        }`}
      >
        {/* Active platform indicator icon */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isYT ? (
            <YouTubeIcon className="w-5 h-5 text-red-500" />
          ) : (
            <Search
              className={`w-5 h-5 transition-colors duration-300 ${
                isFocused ? 'text-orange-400' : 'text-gray-400'
              }`}
            />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
          onFocus={() => { setIsFocused(true); setShowSuggestions(suggestions.length > 0); }}
          onBlur={() => { setIsFocused(false); setTimeout(() => setShowSuggestions(false), 180); }}
          onKeyDown={handleKeyDown}
          placeholder={
            isYT
              ? 'Search YouTube music or paste YouTube link...'
              : 'Search SoundCloud tracks, artists, or paste link...'
          }
          className="flex-1 min-w-0 bg-transparent text-white placeholder-gray-400 text-sm sm:text-base lg:text-lg outline-none"
          aria-label="Search music"
          id="music-search-input"
        />

        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setSuggestions([]); inputRef.current?.focus(); }}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10 flex-shrink-0"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {isLoading ? (
          <Loader2 className={`w-5 h-5 animate-spin flex-shrink-0 ${isYT ? 'text-red-500' : 'text-orange-400'}`} />
        ) : (
          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={!query.trim()}
            className={`px-3.5 sm:px-5 py-2 disabled:opacity-40 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 text-xs sm:text-sm flex-shrink-0 ${
              isYT
                ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500'
                : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400'
            }`}
            id="search-submit-btn"
          >
            Search
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 sw-slide-down max-h-72 overflow-y-auto">
          {suggestions.map((song) => (
            <button
              type="button"
              key={`${song.source || activeSource}-${song.id}`}
              onClick={() => handleSuggestionClick(song)}
              className="w-full flex items-center gap-3 px-3.5 sm:px-4 py-2.5 sm:py-3 hover:bg-white/5 transition-colors text-left group"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                {song.thumbnail ? (
                  <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-4 h-4 text-gray-500" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs sm:text-sm font-medium truncate group-hover:text-orange-300 transition-colors">
                  {song.title}
                </p>
                <p className="text-gray-400 text-[11px] sm:text-xs truncate">{song.artist}</p>
              </div>
              <span className="text-gray-500 text-xs flex-shrink-0 font-mono">{song.duration}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

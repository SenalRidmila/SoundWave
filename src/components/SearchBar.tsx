'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Music, Loader2, SlidersHorizontal } from 'lucide-react';
import { Song } from '@/types';

interface SearchBarProps {
  onResults: (songs: Song[], query: string) => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
}

export default function SearchBar({ onResults, isLoading, setIsLoading }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Song[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      // Fetch quick 5-result suggest from our SoundCloud search
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=5`);
      const data = await res.json();
      setSuggestions(data.songs?.slice(0, 5) || []);
    } catch { setSuggestions([]); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim()) {
      debounceRef.current = setTimeout(() => fetchSuggestions(query), 400);
    } else {
      setSuggestions([]);
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchSuggestions]);

  const handleSearch = async (searchQuery: string = query) => {
    if (!searchQuery.trim()) return;
    setShowSuggestions(false);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=20`);
      const data = await res.json();
      onResults(data.songs || [], searchQuery);
    } catch {
      onResults([], searchQuery);
    } finally {
      setIsLoading(false);
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
      {/* Glow */}
      <div
        className={`absolute inset-0 rounded-2xl transition-all duration-500 blur-xl -z-10 ${
          isFocused ? 'opacity-100 bg-gradient-to-r from-orange-500/25 via-red-500/25 to-orange-400/25' : 'opacity-0'
        }`}
      />

      {/* Input */}
      <div
        className={`relative flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all duration-300 ${
          isFocused
            ? 'bg-white/10 border-orange-400/60 shadow-2xl shadow-orange-500/20'
            : 'bg-white/5 border-white/10 hover:border-white/20'
        }`}
      >
        {/* SoundCloud logo-inspired icon */}
        <Search
          className={`w-5 h-5 flex-shrink-0 transition-colors duration-300 ${
            isFocused ? 'text-orange-400' : 'text-gray-400'
          }`}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
          onFocus={() => { setIsFocused(true); setShowSuggestions(suggestions.length > 0); }}
          onBlur={() => { setIsFocused(false); setTimeout(() => setShowSuggestions(false), 150); }}
          onKeyDown={handleKeyDown}
          placeholder="Search SoundCloud — artists, tracks, genres..."
          className="flex-1 bg-transparent text-white placeholder-gray-400 text-lg outline-none"
          aria-label="Search SoundCloud music"
          id="music-search-input"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setSuggestions([]); inputRef.current?.focus(); }}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {isLoading ? (
          <Loader2 className="w-5 h-5 text-orange-400 animate-spin flex-shrink-0" />
        ) : (
          <button
            onClick={() => handleSearch()}
            disabled={!query.trim()}
            className="px-5 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 disabled:opacity-40 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 text-sm flex-shrink-0"
            id="search-submit-btn"
          >
            Search
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 sw-slide-down">
          {suggestions.map((song) => (
            <button
              key={song.id}
              onClick={() => handleSuggestionClick(song)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                {song.thumbnail ? (
                  <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-4 h-4 text-gray-500" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate group-hover:text-orange-300 transition-colors">
                  {song.title}
                </p>
                <p className="text-gray-400 text-xs truncate">{song.artist}</p>
              </div>
              <span className="text-gray-500 text-xs flex-shrink-0">{song.duration}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

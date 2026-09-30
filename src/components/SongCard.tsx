'use client';

import { Play, Pause, Download, Plus, Heart } from 'lucide-react';
import { Song } from '@/types';
import { usePlayerStore } from '@/store/playerStore';

interface SongCardProps {
  song: Song;
  queue: Song[];
  index: number;
}

export default function SongCard({ song, queue, index }: SongCardProps) {
  const { currentSong, isPlaying, playSong, togglePlay, openDownloadModal, addToQueue } = usePlayerStore();
  const isCurrentSong = currentSong?.id === song.id;

  const handlePlay = () => {
    if (isCurrentSong) {
      togglePlay();
    } else {
      playSong(song, queue);
    }
  };

  return (
    <div
      className={`group relative flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer ${
        isCurrentSong
          ? 'bg-gradient-to-r from-orange-500/15 via-red-500/10 to-transparent border border-orange-500/30'
          : 'hover:bg-white/5 border border-transparent hover:border-white/10'
      }`}
    >
      {/* Index / Play button */}
      <div className="relative flex-shrink-0 w-8 text-center">
        <span
          className={`text-sm font-mono transition-opacity duration-200 ${
            isCurrentSong ? 'opacity-0' : 'opacity-100 group-hover:opacity-0 text-gray-400'
          }`}
        >
          {index + 1}
        </span>
        <button
          onClick={handlePlay}
          className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
            isCurrentSong ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          aria-label={isCurrentSong && isPlaying ? 'Pause' : 'Play'}
          id={`play-btn-${song.id}`}
        >
          {isCurrentSong && isPlaying ? (
            <Pause className="w-4 h-4 text-orange-400" />
          ) : (
            <Play className="w-4 h-4 text-white fill-white" />
          )}
        </button>
      </div>

      {/* Thumbnail */}
      <div className="relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-800">
        <img
          src={song.thumbnail}
          alt={song.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        />
        {/* Playing animation overlay */}
        {isCurrentSong && isPlaying && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="flex items-end gap-0.5 h-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-1 bg-orange-400 rounded-full sw-bar"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <p
          className={`font-medium text-sm truncate transition-colors ${
            isCurrentSong ? 'text-orange-300' : 'text-white group-hover:text-orange-200'
          }`}
        >
          {song.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-gray-400 text-xs truncate">{song.artist}</span>
          {song.likeCount && (
            <>
              <span className="text-gray-600 text-xs">·</span>
              <span className="text-gray-500 text-xs flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {song.likeCount}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Duration */}
      <span className="text-gray-400 text-sm font-mono flex-shrink-0 hidden sm:block">{song.duration}</span>

      {/* Action buttons */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); addToQueue(song); }}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          title="Add to queue"
          aria-label="Add to queue"
          id={`queue-btn-${song.id}`}
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); openDownloadModal(song); }}
          className="p-2 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-all"
          title="Download"
          aria-label="Download song"
          id={`download-btn-${song.id}`}
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

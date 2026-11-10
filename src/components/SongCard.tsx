'use client';

import { Play, Pause, Download, Plus, Heart, Eye } from 'lucide-react';
import { Song } from '@/types';
import { usePlayerStore } from '@/store/playerStore';
import { YouTubeIcon, SoundCloudIcon } from './SearchBar';

interface SongCardProps {
  song: Song;
  queue: Song[];
  index: number;
}

export default function SongCard({ song, queue, index }: SongCardProps) {
  const { currentSong, isPlaying, playSong, togglePlay, openDownloadModal, addToQueue } = usePlayerStore();
  const isCurrentSong = currentSong?.id === song.id;
  const isYT = song.source === 'youtube';

  const handlePlay = () => {
    if (isCurrentSong) {
      togglePlay();
    } else {
      playSong(song, queue);
    }
  };

  return (
    <div
      onClick={handlePlay}
      className={`group relative flex items-center gap-2.5 sm:gap-4 px-2.5 sm:px-4 py-2.5 sm:py-3 rounded-xl transition-all duration-200 cursor-pointer ${
        isCurrentSong
          ? isYT
            ? 'bg-gradient-to-r from-red-600/15 via-rose-500/10 to-transparent border border-red-500/30'
            : 'bg-gradient-to-r from-orange-500/15 via-red-500/10 to-transparent border border-orange-500/30'
          : 'hover:bg-white/5 border border-transparent hover:border-white/10'
      }`}
    >
      {/* Index / Play button */}
      <div className="relative flex-shrink-0 w-6 sm:w-8 text-center">
        <span
          className={`text-xs sm:text-sm font-mono transition-opacity duration-200 ${
            isCurrentSong ? 'opacity-0' : 'opacity-100 group-hover:opacity-0 text-gray-400'
          }`}
        >
          {index + 1}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handlePlay();
          }}
          className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
            isCurrentSong ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          aria-label={isCurrentSong && isPlaying ? 'Pause' : 'Play'}
          id={`play-btn-${song.id}`}
        >
          {isCurrentSong && isPlaying ? (
            <Pause className={`w-4 h-4 ${isYT ? 'text-red-400' : 'text-orange-400'}`} />
          ) : (
            <Play className="w-4 h-4 text-white fill-white" />
          )}
        </button>
      </div>

      {/* Thumbnail */}
      <div className="relative flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-lg overflow-hidden bg-gray-800">
        <img
          src={song.thumbnail}
          alt={song.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          loading="lazy"
        />
        {/* Playing animation overlay */}
        {isCurrentSong && isPlaying && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="flex items-end gap-0.5 h-5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full sw-bar ${isYT ? 'bg-red-400' : 'bg-orange-400'}`}
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
          className={`font-medium text-xs sm:text-sm truncate transition-colors ${
            isCurrentSong
              ? isYT
                ? 'text-red-300'
                : 'text-orange-300'
              : 'text-white group-hover:text-orange-200'
          }`}
        >
          {song.title}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.2 rounded ${
              isYT
                ? 'bg-red-500/15 text-red-400'
                : 'bg-orange-500/15 text-orange-400'
            }`}
          >
            {isYT ? (
              <YouTubeIcon className="w-2.5 h-2.5" />
            ) : (
              <SoundCloudIcon className="w-2.5 h-2.5" />
            )}
            <span className="hidden xs:inline">{isYT ? 'YT' : 'SC'}</span>
          </span>

          <span className="text-gray-400 text-xs truncate max-w-[130px] sm:max-w-[240px]">{song.artist}</span>

          {/* Mobile inline duration */}
          <span className="text-gray-500 text-[11px] font-mono sm:hidden">· {song.duration}</span>

          {song.likeCount && (
            <span className="hidden md:inline-flex text-gray-500 text-xs items-center gap-1">
              <span>·</span>
              <Heart className="w-3 h-3" />
              {song.likeCount}
            </span>
          )}
          {!song.likeCount && song.viewCount && (
            <span className="hidden md:inline-flex text-gray-500 text-xs items-center gap-1">
              <span>·</span>
              <Eye className="w-3 h-3" />
              {song.viewCount}
            </span>
          )}
        </div>
      </div>

      {/* Duration (Tablet & Desktop) */}
      <span className="text-gray-400 text-xs sm:text-sm font-mono flex-shrink-0 hidden sm:block">
        {song.duration}
      </span>

      {/* Action buttons (always visible on mobile/tablet, hover on desktop) */}
      <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-200 flex-shrink-0">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); addToQueue(song); }}
          className="hidden sm:inline-flex p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          title="Add to queue"
          aria-label="Add to queue"
          id={`queue-btn-${song.id}`}
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openDownloadModal(song); }}
          className={`flex items-center gap-1 px-2.5 py-1.5 sm:p-2 rounded-lg transition-all text-xs font-medium ${
            isYT
              ? 'text-red-300 sm:text-gray-400 hover:text-red-400 bg-red-500/10 sm:bg-transparent hover:bg-red-500/15'
              : 'text-orange-300 sm:text-gray-400 hover:text-orange-400 bg-orange-500/10 sm:bg-transparent hover:bg-orange-500/15'
          }`}
          title="Download MP3 / Audio"
          aria-label="Download song"
          id={`download-btn-${song.id}`}
        >
          <Download className="w-4 h-4" />
          <span className="sm:hidden">MP3</span>
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Download, Repeat, Shuffle, ChevronDown, Music2,
} from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';

export default function AudioPlayer() {
  const {
    currentSong, isPlaying, currentTime, duration, volume, isMuted, isLoading,
    togglePlay, setCurrentTime, setDuration, setVolume, toggleMute, setLoading,
    playNext, playPrev, openDownloadModal,
  } = usePlayerStore();

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const streamUrlRef = useRef<string>('');

  // Load stream URL when song changes
  useEffect(() => {
    if (!currentSong) return;

    const loadStream = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/stream?url=${encodeURIComponent(currentSong.url)}`);
        const data = await res.json();
        if (data.streamUrl && audioRef.current) {
          streamUrlRef.current = data.streamUrl;
          audioRef.current.src = data.streamUrl;
          audioRef.current.load();
          if (isPlaying) audioRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.error('Stream load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id]);

  // Handle play/pause
  useEffect(() => {
    if (!audioRef.current || isLoading) return;
    if (isPlaying) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, isLoading]);

  // Handle volume
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  }, [setCurrentTime]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setLoading(false);
      if (isPlaying) audioRef.current.play().catch(() => {});
    }
  }, [setDuration, setLoading, isPlaying]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const newTime = ratio * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (s: number) => {
    if (isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!currentSong) return null;

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={playNext}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        crossOrigin="anonymous"
        preload="auto"
      />

      <div className="fixed bottom-0 left-0 right-0 z-50 sw-slide-up-panel">
        {/* Blur backdrop */}
        <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-2xl border-t border-white/10" />

        {/* Progress bar (top) */}
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className="relative h-1 cursor-pointer group"
          aria-label="Seek"
          id="player-seekbar"
        >
          <div className="absolute inset-0 bg-white/10" />
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-100"
            style={{ width: `${progressPercent}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progressPercent}%`, transform: 'translateX(-50%) translateY(-50%)' }}
          />
        </div>

        <div className="relative px-4 py-3 flex items-center gap-4">
          {/* Song info */}
          <div className="flex items-center gap-3 w-64 min-w-0 flex-shrink-0">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 shadow-lg">
              {currentSong.thumbnail ? (
                <img
                  src={currentSong.thumbnail}
                  alt={currentSong.title}
                  className={`w-full h-full object-cover transition-all duration-300 ${isPlaying ? 'scale-110' : 'scale-100'}`}
                />
              ) : (
                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                  <Music2 className="w-5 h-5 text-gray-500" />
                </div>
              )}
              {isLoading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{currentSong.title}</p>
              <p className="text-gray-400 text-xs truncate">{currentSong.artist}</p>
            </div>
          </div>

          {/* Center controls */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="flex items-center gap-3">
              <button className="text-gray-400 hover:text-white transition-colors p-1" aria-label="Shuffle" id="player-shuffle">
                <Shuffle className="w-4 h-4" />
              </button>
              <button
                onClick={playPrev}
                className="text-gray-200 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
                aria-label="Previous"
                id="player-prev"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={togglePlay}
                disabled={isLoading}
                className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-60 shadow-lg shadow-orange-500/30"
                aria-label={isPlaying ? 'Pause' : 'Play'}
                id="player-play-pause"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4 text-white fill-white" />
                ) : (
                  <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                )}
              </button>
              <button
                onClick={playNext}
                className="text-gray-200 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
                aria-label="Next"
                id="player-next"
              >
                <SkipForward className="w-5 h-5" />
              </button>
              <button className="text-gray-400 hover:text-white transition-colors p-1" aria-label="Repeat" id="player-repeat">
                <Repeat className="w-4 h-4" />
              </button>
            </div>

            {/* Time */}
            <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
              <span>{formatTime(currentTime)}</span>
              <span className="text-gray-600">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3 w-64 justify-end flex-shrink-0">
            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="text-gray-400 hover:text-white transition-colors p-1"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                id="player-mute"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 h-1 appearance-none rounded-full cursor-pointer volume-slider"
                aria-label="Volume"
                id="player-volume"
              />
            </div>

            {/* Download */}
            <button
              onClick={() => openDownloadModal(currentSong)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 hover:border-orange-400/60 text-orange-300 hover:text-white rounded-lg transition-all text-xs font-medium"
              aria-label="Download current song"
              id="player-download-btn"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

'use client';

import { useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Download, Repeat, Shuffle, Music2,
} from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { YouTubeIcon, SoundCloudIcon } from './SearchBar';

export default function AudioPlayer() {
  const {
    currentSong, isPlaying, currentTime, duration, volume, isMuted, isLoading,
    togglePlay, setIsPlaying, setCurrentTime, setDuration, setVolume, toggleMute, setLoading,
    playNext, playPrev, openDownloadModal,
  } = usePlayerStore();

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const fallbackAttemptedRef = useRef<boolean>(false);
  const isSwitchingRef = useRef<boolean>(false);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      destroyHls();
    };
  }, [destroyHls]);

  const playDirectFallback = useCallback((songUrl: string, songId: string, songSource = 'soundcloud', songTitle = '') => {
    if (!audioRef.current || fallbackAttemptedRef.current) {
      setLoading(false);
      return;
    }
    fallbackAttemptedRef.current = true;
    isSwitchingRef.current = false;
    destroyHls();

    const params = new URLSearchParams({
      url: songUrl,
      id: songId,
      source: songSource,
      title: songTitle,
      format: 'mp3-128',
    });
    const fallbackUrl = `/api/download?${params.toString()}`;
    audioRef.current.src = fallbackUrl;
    audioRef.current.load();
    setLoading(false);
    if (usePlayerStore.getState().isPlaying) {
      audioRef.current.play().catch((err) => {
        console.error('Fallback playback error:', err);
      });
    }
  }, [destroyHls, setLoading]);

  // Load stream URL when song changes
  useEffect(() => {
    if (!currentSong) return;

    let cancelled = false;
    fallbackAttemptedRef.current = false;
    isSwitchingRef.current = true;
    const songSource = currentSong.source || 'soundcloud';

    if (currentSong.durationSeconds && currentSong.durationSeconds > 0) {
      setDuration(currentSong.durationSeconds);
    }
    setCurrentTime(0);

    const loadStream = async () => {
      setLoading(true);
      destroyHls();

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      const fullTitle = `${currentSong.artist} - ${currentSong.title}`;
      try {
        const params = new URLSearchParams({
          url: currentSong.url,
          id: currentSong.id,
          source: songSource,
          title: fullTitle,
        });
        const res = await fetch(`/api/stream?${params.toString()}`);
        const data = await res.json();

        if (cancelled || !audioRef.current) return;

        if (!res.ok || !data.streamUrl) {
          playDirectFallback(currentSong.url, currentSong.id, songSource, fullTitle);
          return;
        }

        if (typeof data.durationSeconds === 'number' && data.durationSeconds > 0) {
          const existingDur = usePlayerStore.getState().duration;
          if (!existingDur || existingDur <= 0) {
            setDuration(data.durationSeconds);
          }
        }

        const isHls = Boolean(data.isHls || data.streamUrl.includes('.m3u8'));

        if (isHls && Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
          });
          hlsRef.current = hls;

          hls.loadSource(data.streamUrl);
          hls.attachMedia(audioRef.current);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (cancelled) return;
            isSwitchingRef.current = false;
            setLoading(false);
            if (usePlayerStore.getState().isPlaying) {
              audioRef.current?.play().catch(() => {});
            }
          });

          hls.on(Hls.Events.LEVEL_LOADED, (_event, levelData) => {
            if (cancelled) return;
            const totalDur = levelData?.details?.totalduration;
            if (typeof totalDur === 'number' && Number.isFinite(totalDur) && totalDur > 1) {
              setDuration(totalDur);
            }
          });

          hls.on(Hls.Events.ERROR, (_event, errData) => {
            if (cancelled) return;
            if (errData.fatal) {
              console.warn('HLS fatal error, switching to direct stream fallback:', errData.type, errData.details);
              playDirectFallback(currentSong.url, currentSong.id, songSource, fullTitle);
            }
          });
        } else {
          audioRef.current.src = data.streamUrl;
          audioRef.current.load();
          isSwitchingRef.current = false;
          setLoading(false);
          if (usePlayerStore.getState().isPlaying) {
            audioRef.current.play().catch(() => {});
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Stream load error:', err);
          playDirectFallback(currentSong.url, currentSong.id, songSource, fullTitle);
        }
      }
    };

    loadStream();

    return () => {
      cancelled = true;
    };
  }, [currentSong?.id, currentSong?.url, currentSong?.source, currentSong?.durationSeconds, destroyHls, playDirectFallback, setCurrentTime, setDuration, setLoading]);

  // Handle play/pause toggle from UI
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isLoading || !audio.src) return;

    if (isPlaying) {
      if (audio.paused) {
        audio.play().catch(() => {});
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isPlaying, isLoading]);

  // Handle volume
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Active polling timer while playing so currentTime and duration always update smoothly
  useEffect(() => {
    if (!currentSong) return;
    const timer = setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;
      if (!audio.paused && Number.isFinite(audio.currentTime)) {
        setCurrentTime(audio.currentTime);
      }
      const d = audio.duration;
      if (Number.isFinite(d) && d > 1) {
        const storeDur = usePlayerStore.getState().duration;
        if (!storeDur || Math.abs(storeDur - d) > 2) {
          setDuration(d);
        }
      }
    }, 250);
    return () => clearInterval(timer);
  }, [currentSong, isPlaying, setCurrentTime, setDuration]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Number.isFinite(audio.currentTime)) {
      setCurrentTime(audio.currentTime);
    }
    const d = audio.duration;
    if (Number.isFinite(d) && d > 1 && usePlayerStore.getState().duration <= 0) {
      setDuration(d);
    }
  }, [setCurrentTime, setDuration]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (Number.isFinite(d) && d > 1) {
        setDuration(d);
      }
      setLoading(false);
      if (usePlayerStore.getState().isPlaying && audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [setDuration, setLoading]);

  const handleAudioError = useCallback(() => {
    if (isSwitchingRef.current) return;
    if (currentSong && !fallbackAttemptedRef.current) {
      playDirectFallback(
        currentSong.url,
        currentSong.id,
        currentSong.source || 'soundcloud',
        `${currentSong.artist} - ${currentSong.title}`
      );
    } else {
      setLoading(false);
    }
  }, [currentSong, playDirectFallback, setLoading]);

  const effectiveDuration =
    duration > 0
      ? duration
      : currentSong?.durationSeconds && currentSong.durationSeconds > 0
      ? currentSong.durationSeconds
      : 0;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current || effectiveDuration <= 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = ratio * effectiveDuration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (s: number) => {
    if (!Number.isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const progressPercent =
    effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;
  const isYT = currentSong?.source === 'youtube';

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleLoadedMetadata}
        onEnded={playNext}
        onPlay={() => setIsPlaying(true)}
        onPause={() => {
          if (audioRef.current && !audioRef.current.ended && !usePlayerStore.getState().isLoading) {
            setIsPlaying(false);
          }
        }}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        onError={handleAudioError}
        preload="auto"
      />

      {currentSong && (
        <div className="fixed bottom-0 left-0 right-0 z-50 sw-slide-up-panel">
          {/* Blur backdrop */}
          <div className="absolute inset-0 bg-gray-950/95 backdrop-blur-2xl border-t border-white/10" />

          {/* Interactive Seek Bar + Live Playing Time Row (Visible on Mobile, Tablet & Desktop) */}
          <div className="relative max-w-7xl mx-auto px-3 sm:px-6 pt-2 pb-0.5 flex items-center gap-2.5 sm:gap-3">
            <span
              className={`text-[11px] sm:text-xs font-mono font-semibold tabular-nums min-w-[34px] text-right ${
                isYT ? 'text-red-400' : 'text-orange-400'
              }`}
              id="player-current-time"
            >
              {formatTime(currentTime)}
            </span>

            <div
              ref={progressRef}
              onClick={handleProgressClick}
              className="relative flex-1 h-2 sm:h-2 bg-white/15 rounded-full cursor-pointer group flex items-center"
              aria-label="Seek"
              id="player-seekbar"
            >
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  isYT
                    ? 'bg-gradient-to-r from-red-600 to-rose-500'
                    : 'bg-gradient-to-r from-orange-500 to-red-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg transition-transform group-hover:scale-125"
                style={{ left: `${progressPercent}%`, transform: 'translateX(-50%) translateY(-50%)' }}
              />
            </div>

            <span
              className="text-[11px] sm:text-xs font-mono font-medium text-gray-300 tabular-nums min-w-[34px]"
              id="player-total-duration"
            >
              {formatTime(effectiveDuration)}
            </span>
          </div>

          <div className="relative max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4">
            {/* Song info (flexible on mobile, fixed width on tablet/desktop) */}
            <div className="flex items-center gap-2.5 sm:gap-3 flex-1 sm:flex-initial sm:w-52 md:w-64 min-w-0">
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden flex-shrink-0 shadow-lg bg-gray-800">
                {currentSong.thumbnail ? (
                  <img
                    src={currentSong.thumbnail}
                    alt={currentSong.title}
                    className={`w-full h-full object-cover transition-all duration-300 ${isPlaying ? 'scale-110' : 'scale-100'}`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music2 className="w-5 h-5 text-gray-500" />
                  </div>
                )}
                {isLoading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${isYT ? 'border-red-400' : 'border-orange-400'}`} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={isYT ? 'text-red-500 flex-shrink-0' : 'text-orange-400 flex-shrink-0'}>
                    {isYT ? <YouTubeIcon className="w-3 h-3" /> : <SoundCloudIcon className="w-3 h-3" />}
                  </span>
                  <p className="text-white text-xs sm:text-sm font-medium truncate">{currentSong.title}</p>
                </div>
                <p className="text-gray-400 text-[11px] sm:text-xs truncate">{currentSong.artist}</p>
              </div>
            </div>

            {/* Center controls */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0 sm:flex-1">
              <div className="flex items-center gap-1 sm:gap-3">
                <button type="button" className="text-gray-400 hover:text-white transition-colors p-1 hidden lg:block" aria-label="Shuffle" id="player-shuffle">
                  <Shuffle className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={playPrev}
                  className="text-gray-200 hover:text-white transition-colors p-1.5 sm:p-2 hover:bg-white/10 rounded-full"
                  aria-label="Previous"
                  id="player-prev"
                >
                  <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg ${
                    isYT
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-600/30'
                      : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 shadow-orange-500/30'
                  }`}
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
                  type="button"
                  onClick={playNext}
                  className="text-gray-200 hover:text-white transition-colors p-1.5 sm:p-2 hover:bg-white/10 rounded-full"
                  aria-label="Next"
                  id="player-next"
                >
                  <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button type="button" className="text-gray-400 hover:text-white transition-colors p-1 hidden lg:block" aria-label="Repeat" id="player-repeat">
                  <Repeat className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2 sm:gap-3 sm:w-52 md:w-64 justify-end flex-shrink-0">
              {/* Volume (Tablet landscape / Desktop) */}
              <div className="hidden md:flex items-center gap-2">
                <button
                  type="button"
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
                type="button"
                onClick={() => openDownloadModal(currentSong)}
                className={`flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 border rounded-lg transition-all text-xs font-medium ${
                  isYT
                    ? 'bg-red-500/20 hover:bg-red-500/30 border-red-500/40 hover:border-red-400/60 text-red-300 hover:text-white'
                    : 'bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/40 hover:border-orange-400/60 text-orange-300 hover:text-white'
                }`}
                aria-label="Download current song"
                id="player-download-btn"
              >
                <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Download</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

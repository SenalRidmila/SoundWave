import { create } from 'zustand';
import { Song, AudioFormat } from '@/types';

interface PlayerStore {
  // Playback state
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  
  // Queue
  queue: Song[];
  currentIndex: number;
  
  // Download modal
  downloadSong: Song | null;
  isDownloadModalOpen: boolean;
  
  // Actions
  playSong: (song: Song, queue?: Song[]) => void;
  togglePlay: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setLoading: (loading: boolean) => void;
  playNext: () => void;
  playPrev: () => void;
  addToQueue: (song: Song) => void;
  openDownloadModal: (song: Song) => void;
  closeDownloadModal: () => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  isLoading: false,
  queue: [],
  currentIndex: -1,
  downloadSong: null,
  isDownloadModalOpen: false,

  playSong: (song, queue) => {
    const newQueue = queue || [song];
    const index = newQueue.findIndex((s) => s.id === song.id);
    set({
      currentSong: song,
      isPlaying: true,
      currentTime: 0,
      queue: newQueue,
      currentIndex: index !== -1 ? index : 0,
      isLoading: true,
    });
  },

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume, isMuted: volume === 0 }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setLoading: (loading) => set({ isLoading: loading }),

  playNext: () => {
    const { queue, currentIndex } = get();
    if (currentIndex < queue.length - 1) {
      const nextSong = queue[currentIndex + 1];
      set({ currentSong: nextSong, currentIndex: currentIndex + 1, isPlaying: true, currentTime: 0, isLoading: true });
    }
  },

  playPrev: () => {
    const { queue, currentIndex } = get();
    if (currentIndex > 0) {
      const prevSong = queue[currentIndex - 1];
      set({ currentSong: prevSong, currentIndex: currentIndex - 1, isPlaying: true, currentTime: 0, isLoading: true });
    }
  },

  addToQueue: (song) => set((state) => ({ queue: [...state.queue, song] })),

  openDownloadModal: (song) => set({ downloadSong: song, isDownloadModalOpen: true }),
  closeDownloadModal: () => set({ isDownloadModalOpen: false }),
}));

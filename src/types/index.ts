export interface Song {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: string;
  durationSeconds: number;
  viewCount?: string;
  likeCount?: string;
  /** SoundCloud track URL — used for streaming & downloading */
  url: string;
}

export interface SearchResult {
  songs: Song[];
}

export type AudioFormat = 'mp3-128' | 'mp3-256' | 'mp3-320' | 'flac' | 'wav';

export interface FormatOption {
  id: AudioFormat;
  label: string;
  description: string;
  quality: 'standard' | 'high' | 'ultra' | 'lossless';
  icon: string;
}

export interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  queue: Song[];
  currentIndex: number;
}

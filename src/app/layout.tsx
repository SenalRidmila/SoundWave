import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AudioPlayer from '@/components/AudioPlayer';
import DownloadModal from '@/components/DownloadModal';

const inter = Inter({ subsets: ['latin'], display: 'swap', preload: false });

export const metadata: Metadata = {
  title: 'SoundWave – Free Music Streaming & Download',
  description: 'Stream and download music in MP3, FLAC, WAV formats. Search millions of songs. High quality audio, free forever.',
  keywords: 'music download, mp3 download, free music, stream music, FLAC download, high quality audio',
  openGraph: {
    title: 'SoundWave – Free Music Streaming & Download',
    description: 'Stream and download music in MP3, FLAC, WAV formats.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#0a0a0f" />
      </head>
      <body className={`${inter.className} bg-gray-950 text-white antialiased min-h-screen`}>
        {children}
        <AudioPlayer />
        <DownloadModal />
      </body>
    </html>
  );
}

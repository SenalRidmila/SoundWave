'use client';

import { useState } from 'react';
import { X, Download, Music, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { AudioFormat, FormatOption } from '@/types';

const FORMAT_OPTIONS: FormatOption[] = [
  { id: 'mp3-320', label: 'MP3 320kbps', description: 'Best MP3 quality', quality: 'ultra', icon: '🎵' },
  { id: 'mp3-256', label: 'MP3 256kbps', description: 'High quality MP3', quality: 'high', icon: '🎵' },
  { id: 'mp3-128', label: 'MP3 128kbps', description: 'Standard quality', quality: 'standard', icon: '🎵' },
  { id: 'flac',    label: 'FLAC',       description: 'Lossless audio', quality: 'lossless', icon: '🎼' },
  { id: 'wav',     label: 'WAV',        description: 'Uncompressed lossless', quality: 'lossless', icon: '🎼' },
];

const QUALITY_COLORS: Record<string, string> = {
  standard: 'text-gray-400 border-gray-600',
  high:     'text-blue-400 border-blue-600',
  ultra:    'text-purple-400 border-purple-600',
  lossless: 'text-emerald-400 border-emerald-600',
};

const QUALITY_BADGES: Record<string, string> = {
  standard: 'bg-gray-800 text-gray-300',
  high:     'bg-blue-900/50 text-blue-300',
  ultra:    'bg-purple-900/50 text-purple-300',
  lossless: 'bg-emerald-900/50 text-emerald-300',
};

type DownloadStatus = 'idle' | 'loading' | 'done' | 'error';

export default function DownloadModal() {
  const { downloadSong, isDownloadModalOpen, closeDownloadModal } = usePlayerStore();
  const [selectedFormat, setSelectedFormat] = useState<AudioFormat>('mp3-320');
  const [status, setStatus] = useState<DownloadStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleDownload = async () => {
    if (!downloadSong) return;
    setStatus('loading');
    setErrorMsg('');

    try {
      const fullTitle = `${downloadSong.artist} - ${downloadSong.title}`;
      const params = new URLSearchParams({
        url: downloadSong.url,
        format: selectedFormat,
        title: fullTitle,
      });
      const response = await fetch(`/api/download?${params}`);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Download failed');
      }

      const blob = await response.blob();
      
      // Use the exact original track name directly (bypassing header parsing completely)
      const ext = selectedFormat.split('-')[0];
      const filename = `${fullTitle}.${ext}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setStatus('done');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      setErrorMsg(msg);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  if (!isDownloadModalOpen || !downloadSong) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] sw-fade-in"
        onClick={closeDownloadModal}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="bg-gray-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl w-full max-w-md shadow-2xl sw-zoom-in">

          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4">
            <h2 className="text-white font-bold text-lg">Download Track</h2>
            <button
              onClick={closeDownloadModal}
              className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
              aria-label="Close download modal"
              id="download-modal-close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Song info */}
          <div className="px-6 pb-5">
            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                {downloadSong.thumbnail ? (
                  <img
                    src={downloadSong.thumbnail}
                    alt={downloadSong.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <Music className="w-6 h-6 text-gray-500" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm truncate">{downloadSong.title}</p>
                <p className="text-gray-400 text-xs mt-1 truncate">{downloadSong.artist}</p>
                <p className="text-gray-500 text-xs mt-1">{downloadSong.duration}</p>
              </div>
            </div>
          </div>

          {/* Format selector */}
          <div className="px-6 pb-5">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">Select Format</p>
            <div className="space-y-2">
              {FORMAT_OPTIONS.map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left ${
                    selectedFormat === fmt.id
                      ? `${QUALITY_COLORS[fmt.quality]} bg-white/5`
                      : 'border-transparent hover:border-white/10 hover:bg-white/5 text-gray-400'
                  }`}
                  id={`format-${fmt.id}`}
                >
                  <span className="text-xl">{fmt.icon}</span>
                  <div className="flex-1">
                    <span className={`font-semibold text-sm ${selectedFormat === fmt.id ? '' : 'text-gray-300'}`}>
                      {fmt.label}
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">{fmt.description}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${QUALITY_BADGES[fmt.quality]}`}>
                    {fmt.quality}
                  </span>
                  {selectedFormat === fmt.id && (
                    <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Status message */}
          {status === 'error' && (
            <div className="mx-6 mb-4 flex items-center gap-2 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {status === 'done' && (
            <div className="mx-6 mb-4 flex items-center gap-2 p-3 bg-emerald-900/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Download started!</span>
            </div>
          )}

          {/* Download button */}
          <div className="p-6 pt-2">
            <button
              onClick={handleDownload}
              disabled={status === 'loading'}
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 disabled:opacity-60 text-white font-bold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30"
              id="download-confirm-btn"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Converting & Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download {FORMAT_OPTIONS.find(f => f.id === selectedFormat)?.label}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

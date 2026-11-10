'use client';

import { useState } from 'react';
import { X, Download, Music, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { AudioFormat, FormatOption } from '@/types';
import { YouTubeIcon, SoundCloudIcon } from './SearchBar';

const FORMAT_OPTIONS: FormatOption[] = [
  { id: 'mp3-320', label: 'MP3 320kbps', description: 'Best MP3 quality · Studio', quality: 'ultra',    icon: '🎵', kbps: 320 },
  { id: 'mp3-256', label: 'MP3 256kbps', description: 'High quality · Balanced',   quality: 'high',     icon: '🎵', kbps: 256 },
  { id: 'mp3-128', label: 'MP3 128kbps', description: 'Standard · Smaller size',   quality: 'standard', icon: '🎵', kbps: 128 },
  { id: 'flac',    label: 'FLAC',        description: 'Lossless compressed audio', quality: 'lossless', icon: '🎼', kbps: 850 },
  { id: 'wav',     label: 'WAV',         description: 'Uncompressed PCM audio',    quality: 'lossless', icon: '🎼', kbps: 1411 },
];

const QUALITY_COLORS: Record<string, string> = {
  standard: 'text-gray-300 border-gray-500',
  high:     'text-blue-400 border-blue-500',
  ultra:    'text-orange-400 border-orange-500',
  lossless: 'text-emerald-400 border-emerald-500',
};

const QUALITY_BADGES: Record<string, string> = {
  standard: 'bg-gray-800 text-gray-300',
  high:     'bg-blue-900/50 text-blue-300',
  ultra:    'bg-orange-900/50 text-orange-300',
  lossless: 'bg-emerald-900/50 text-emerald-300',
};

function estimateFileSizeMB(durationSeconds: number, kbps = 320): string {
  if (!durationSeconds || durationSeconds <= 0) return '';
  const megabytes = (durationSeconds * kbps) / 8 / 1024;
  if (megabytes < 1) {
    return `~${Math.max(100, Math.round(megabytes * 1024))} KB`;
  }
  return `~${megabytes.toFixed(1)} MB`;
}

type DownloadStatus = 'idle' | 'loading' | 'done' | 'error';

export default function DownloadModal() {
  const { downloadSong, isDownloadModalOpen, closeDownloadModal } = usePlayerStore();
  const [selectedFormat, setSelectedFormat] = useState<AudioFormat>('mp3-320');
  const [status, setStatus] = useState<DownloadStatus>('idle');
  const [progressText, setProgressText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isDownloadModalOpen || !downloadSong) return null;

  const isYT = downloadSong.source === 'youtube';

  const handleDownload = async () => {
    setStatus('loading');
    setProgressText('Starting...');
    setErrorMsg('');

    try {
      const fullTitle = `${downloadSong.artist} - ${downloadSong.title}`;
      const params = new URLSearchParams({
        url: downloadSong.url,
        id: downloadSong.id,
        source: downloadSong.source || 'soundcloud',
        format: selectedFormat,
        title: fullTitle,
      });
      const response = await fetch(`/api/download?${params.toString()}`);

      if (!response.ok) {
        let message = 'Download failed';
        try {
          const err = await response.json();
          if (err?.error) message = err.error;
        } catch {
          // Ignore non-JSON error body
        }
        throw new Error(message);
      }

      const contentLength = Number(response.headers.get('content-length') || 0);
      let blob: Blob;

      if (response.body) {
        const reader = response.body.getReader();
        const chunks: BlobPart[] = [];
        let receivedBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value.slice());
            receivedBytes += value.byteLength;
            const mb = (receivedBytes / (1024 * 1024)).toFixed(1);
            if (contentLength > 0) {
              const pct = Math.min(99, Math.round((receivedBytes / contentLength) * 100));
              setProgressText(`Downloading ${pct}% (${mb} MB)...`);
            } else {
              setProgressText(`Downloading (${mb} MB)...`);
            }
          }
        }

        const mimeType = response.headers.get('content-type') || 'audio/mpeg';
        blob = new Blob(chunks, { type: mimeType });
      } else {
        blob = await response.blob();
      }

      if (blob.size === 0) {
        throw new Error('The server returned an empty audio file');
      }
      
      const ext = selectedFormat === 'flac' || selectedFormat === 'wav'
        ? selectedFormat
        : 'mp3';
      const filename = `${fullTitle}.${ext}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);

      setStatus('done');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      setErrorMsg(msg);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  const selectedOption = FORMAT_OPTIONS.find((f) => f.id === selectedFormat);
  const selectedSizeEst = estimateFileSizeMB(downloadSong.durationSeconds, selectedOption?.kbps);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[60] sw-fade-in"
        onClick={closeDownloadModal}
      />

      {/* Modal container — scrollable on small mobile screens */}
      <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-2 sm:p-4 pointer-events-none">
        <div className="pointer-events-auto bg-gray-900/95 backdrop-blur-2xl border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl sw-zoom-in">

          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 pb-3 sm:pb-4 sticky top-0 bg-gray-900/95 backdrop-blur-xl z-10 border-b border-white/5 sm:border-none">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-bold text-base sm:text-lg">Download Track</h2>
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  isYT
                    ? 'bg-red-500/15 text-red-400 border-red-500/30'
                    : 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                }`}
              >
                {isYT ? <YouTubeIcon className="w-3 h-3" /> : <SoundCloudIcon className="w-3 h-3" />}
                {isYT ? 'YouTube' : 'SoundCloud'}
              </span>
            </div>
            <button
              type="button"
              onClick={closeDownloadModal}
              className="text-gray-400 hover:text-white transition-colors p-1.5 sm:p-2 hover:bg-white/10 rounded-full"
              aria-label="Close download modal"
              id="download-modal-close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Song info */}
          <div className="px-4 sm:px-6 pt-2 pb-4">
            <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-lg bg-gray-800">
                {downloadSong.thumbnail ? (
                  <img
                    src={downloadSong.thumbnail}
                    alt={downloadSong.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-6 h-6 text-gray-500" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white font-semibold text-xs sm:text-sm truncate">{downloadSong.title}</p>
                <p className="text-gray-400 text-xs mt-0.5 truncate">{downloadSong.artist}</p>
                <p className="text-gray-500 text-xs mt-1 font-mono">{downloadSong.duration}</p>
              </div>
            </div>
          </div>

          {/* Format selector with file size estimates */}
          <div className="px-4 sm:px-6 pb-4">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Select Format &amp; Size</p>
              <span className="text-gray-500 text-[11px]">Estimated Size</span>
            </div>
            <div className="space-y-2">
              {FORMAT_OPTIONS.map((fmt) => {
                const sizeEst = estimateFileSizeMB(downloadSong.durationSeconds, fmt.kbps);
                const isSelected = selectedFormat === fmt.id;
                return (
                  <button
                    type="button"
                    key={fmt.id}
                    onClick={() => setSelectedFormat(fmt.id)}
                    className={`w-full flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl border transition-all duration-200 text-left ${
                      isSelected
                        ? `${QUALITY_COLORS[fmt.quality]} bg-white/10`
                        : 'border-white/5 hover:border-white/15 hover:bg-white/5 text-gray-400'
                    }`}
                    id={`format-${fmt.id}`}
                  >
                    <span className="text-lg sm:text-xl flex-shrink-0">{fmt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-xs sm:text-sm ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                          {fmt.label}
                        </span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${QUALITY_BADGES[fmt.quality]}`}>
                          {fmt.quality}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 truncate">{fmt.description}</p>
                    </div>
                    {sizeEst && (
                      <span className="text-xs font-mono text-gray-300 bg-black/30 px-2 py-1 rounded-lg border border-white/5 flex-shrink-0">
                        {sizeEst}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status message */}
          {status === 'error' && (
            <div className="mx-4 sm:mx-6 mb-3 flex items-center gap-2 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-300 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="break-words">{errorMsg}</span>
            </div>
          )}
          {status === 'done' && (
            <div className="mx-4 sm:mx-6 mb-3 flex items-center gap-2 p-3 bg-emerald-900/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs sm:text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Download complete!</span>
            </div>
          )}

          {/* Download button */}
          <div className="p-4 sm:p-6 pt-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={status === 'loading'}
              className={`w-full py-3 sm:py-3.5 disabled:opacity-60 text-white font-bold text-sm sm:text-base rounded-xl transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 shadow-lg ${
                isYT
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-600/30'
                  : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 shadow-orange-500/30'
              }`}
              id="download-confirm-btn"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{progressText || 'Preparing Download...'}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    Download {selectedOption?.label}
                    {selectedSizeEst ? ` (${selectedSizeEst})` : ''}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

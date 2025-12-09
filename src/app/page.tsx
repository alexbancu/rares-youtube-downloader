'use client';

import { useState, useRef } from 'react';

interface VideoFormat {
  format_id: string;
  ext: string;
  acodec: string;
  abr?: number;
  filesize?: number;
  format_note?: string;
}

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  formats: VideoFormat[];
}

type DownloadState = 'idle' | 'fetching' | 'ready' | 'downloading' | 'complete' | 'error';

const AUDIO_FORMATS = [
  { value: 'mp3', label: 'MP3', desc: 'Universal compatibility', icon: '🎵' },
  { value: 'aac', label: 'AAC', desc: 'Great quality, small size', icon: '🔊' },
  { value: 'm4a', label: 'M4A', desc: 'Apple devices', icon: '🍎' },
  { value: 'opus', label: 'Opus', desc: 'Best compression', icon: '⚡' },
  { value: 'flac', label: 'FLAC', desc: 'Lossless quality', icon: '💎' },
  { value: 'wav', label: 'WAV', desc: 'Uncompressed', icon: '📀' },
];

export default function Home() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [state, setState] = useState<DownloadState>('idle');
  const [error, setError] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('mp3');
  const abortControllerRef = useRef<AbortController | null>(null);

  const resetState = () => {
    setState('idle');
    setVideoInfo(null);
    setError('');
  };

  const fetchVideoInfo = async () => {
    if (!url.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    setState('fetching');
    setError('');
    setVideoInfo(null);

    try {
      const response = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch video info');
      }

      setVideoInfo(data);
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setState('error');
    }
  };

  const handleDownload = async (original: boolean, format?: string) => {
    setState('downloading');
    setError('');

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, original, format }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Download failed');
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'audio-file';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = decodeURIComponent(match[1]);
        }
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      setState('complete');
      setTimeout(() => setState('ready'), 3000);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setState('ready');
        return;
      }
      setError(err instanceof Error ? err.message : 'Download failed. Please try again.');
      setState('error');
    }
  };

  const cancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isValidYouTubeUrl = (url: string) => {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
            </div>
            <div>
              <h1 className="font-semibold text-lg">Audio Extractor</h1>
              <p className="text-xs text-white/40">YouTube to Audio</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Extract Audio from YouTube
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Download high-quality audio with preserved metadata and artwork. No conversion losses.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden">
          {/* URL Input Section */}
          <div className="p-6 md:p-8">
            <label className="block text-sm font-medium text-white/60 mb-3">
              YouTube URL
            </label>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (state === 'error') setError('');
                  }}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full px-4 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all text-base"
                  onKeyDown={(e) => e.key === 'Enter' && state !== 'fetching' && fetchVideoInfo()}
                  disabled={state === 'fetching' || state === 'downloading'}
                />
                {url && isValidYouTubeUrl(url) && state === 'idle' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              <button
                onClick={state === 'ready' || state === 'complete' ? resetState : fetchVideoInfo}
                disabled={state === 'fetching' || state === 'downloading'}
                className="px-6 py-3.5 bg-white text-black font-medium rounded-xl hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 min-w-[120px] justify-center"
              >
                {state === 'fetching' ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Loading</span>
                  </>
                ) : state === 'ready' || state === 'complete' ? (
                  'New URL'
                ) : (
                  'Extract'
                )}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-red-400 text-sm font-medium">Error</p>
                  <p className="text-red-400/70 text-sm mt-0.5">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Loading Skeleton */}
          {state === 'fetching' && (
            <div className="border-t border-white/[0.05] p-6 md:p-8">
              <div className="flex gap-5 animate-pulse">
                <div className="w-40 h-24 bg-white/[0.05] rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 bg-white/[0.05] rounded w-3/4" />
                  <div className="h-4 bg-white/[0.05] rounded w-1/2" />
                  <div className="h-4 bg-white/[0.05] rounded w-1/4" />
                </div>
              </div>
            </div>
          )}

          {/* Video Info */}
          {videoInfo && (state === 'ready' || state === 'downloading' || state === 'complete') && (
            <>
              <div className="border-t border-white/[0.05] p-6 md:p-8">
                <div className="flex gap-5">
                  <div className="relative flex-shrink-0">
                    <img
                      src={videoInfo.thumbnail}
                      alt={videoInfo.title}
                      className="w-40 h-24 object-cover rounded-lg"
                    />
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-xs font-medium">
                      {formatDuration(videoInfo.duration)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white line-clamp-2 mb-1">
                      {videoInfo.title}
                    </h3>
                    <p className="text-white/50 text-sm">{videoInfo.uploader}</p>
                    {videoInfo.formats.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {videoInfo.formats.slice(0, 4).map((f) => (
                          <span
                            key={f.format_id}
                            className="px-2 py-0.5 bg-white/[0.05] rounded text-xs text-white/50"
                          >
                            {f.acodec} {f.abr ? `${f.abr}k` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Download Options */}
              <div className="border-t border-white/[0.05] p-6 md:p-8 space-y-6">
                {/* Original Quality Download */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-white">Original Quality</h4>
                      <p className="text-sm text-white/40">Best audio quality, no conversion</p>
                    </div>
                    <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs font-medium rounded-full">
                      Recommended
                    </span>
                  </div>
                  <button
                    onClick={() => handleDownload(true)}
                    disabled={state === 'downloading'}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-white/10 disabled:to-white/10 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-3"
                  >
                    {state === 'downloading' ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Downloading...</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); cancelDownload(); }}
                          className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : state === 'complete' ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Downloaded!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Download Original</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/[0.05]"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-[#0a0a0a] text-white/30 text-sm">or convert to</span>
                  </div>
                </div>

                {/* Format Selection */}
                <div>
                  <h4 className="font-medium text-white mb-3">Convert Format</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                    {AUDIO_FORMATS.map((format) => (
                      <button
                        key={format.value}
                        onClick={() => setSelectedFormat(format.value)}
                        disabled={state === 'downloading'}
                        className={`p-3 rounded-xl border transition-all text-left ${
                          selectedFormat === format.value
                            ? 'border-white/20 bg-white/[0.05]'
                            : 'border-white/[0.05] hover:border-white/10 hover:bg-white/[0.02]'
                        } disabled:opacity-50`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">{format.icon}</span>
                          <span className="font-medium text-sm">{format.label}</span>
                        </div>
                        <p className="text-xs text-white/40">{format.desc}</p>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => handleDownload(false, selectedFormat)}
                    disabled={state === 'downloading'}
                    className="w-full py-4 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] disabled:opacity-50 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-3"
                  >
                    {state === 'downloading' ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Converting...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        <span>Convert to {selectedFormat.toUpperCase()}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 bg-white/[0.02] border border-white/[0.05] rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h3 className="font-medium mb-1">High Quality</h3>
            <p className="text-sm text-white/40">Original audio quality preserved with no re-encoding</p>
          </div>
          <div className="p-5 bg-white/[0.02] border border-white/[0.05] rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <h3 className="font-medium mb-1">Full Metadata</h3>
            <p className="text-sm text-white/40">Title, artist, and thumbnail embedded automatically</p>
          </div>
          <div className="p-5 bg-white/[0.02] border border-white/[0.05] rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="font-medium mb-1">Secure & Private</h3>
            <p className="text-sm text-white/40">Files processed server-side and deleted after download</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.05] mt-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center text-white/30 text-sm">
          For personal use only. Respect copyright and content creators.
        </div>
      </footer>
    </div>
  );
}

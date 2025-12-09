'use client';

import { useState } from 'react';

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

const AUDIO_FORMATS = [
  { value: 'mp3', label: 'MP3', desc: 'Universal compatibility' },
  { value: 'aac', label: 'AAC', desc: 'Good quality, small size' },
  { value: 'm4a', label: 'M4A', desc: 'Apple format, good quality' },
  { value: 'opus', label: 'Opus', desc: 'Best quality/size ratio' },
  { value: 'flac', label: 'FLAC', desc: 'Lossless audio' },
  { value: 'wav', label: 'WAV', desc: 'Uncompressed audio' },
  { value: 'vorbis', label: 'Vorbis (OGG)', desc: 'Open format' },
  { value: 'alac', label: 'ALAC', desc: 'Apple lossless' },
];

export default function Home() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('mp3');
  const [showFormatDropdown, setShowFormatDropdown] = useState(false);

  const fetchVideoInfo = async () => {
    if (!url.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    setLoading(true);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (original: boolean, format?: string) => {
    setDownloading(true);
    setError('');

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, original, format }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Download failed');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'audio-file';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = decodeURIComponent(match[1]);
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">
            YouTube Audio Downloader
          </h1>
          <p className="text-gray-400">
            Download audio from YouTube with preserved quality and metadata
          </p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-6 shadow-2xl border border-gray-700">
          {/* URL Input */}
          <div className="flex gap-3 mb-6">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste YouTube URL here..."
              className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && fetchVideoInfo()}
            />
            <button
              onClick={fetchVideoInfo}
              disabled={loading}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-medium rounded-xl transition-all duration-200 flex items-center gap-2"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                'Fetch'
              )}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
              {error}
            </div>
          )}

          {/* Video Info */}
          {videoInfo && (
            <div className="space-y-6">
              {/* Video Preview */}
              <div className="flex gap-4 p-4 bg-gray-900/50 rounded-xl">
                <img
                  src={videoInfo.thumbnail}
                  alt={videoInfo.title}
                  className="w-32 h-24 object-cover rounded-lg"
                />
                <div className="flex-1 min-w-0">
                  <h2 className="text-white font-semibold truncate mb-1">
                    {videoInfo.title}
                  </h2>
                  <p className="text-gray-400 text-sm mb-1">{videoInfo.uploader}</p>
                  <p className="text-gray-500 text-sm">
                    Duration: {formatDuration(videoInfo.duration)}
                  </p>
                </div>
              </div>

              {/* Available Source Formats */}
              {videoInfo.formats.length > 0 && (
                <div className="p-4 bg-gray-900/30 rounded-xl">
                  <h3 className="text-gray-300 text-sm font-medium mb-2">Available Source Formats:</h3>
                  <div className="flex flex-wrap gap-2">
                    {videoInfo.formats.map((f) => (
                      <span
                        key={f.format_id}
                        className="px-2 py-1 bg-gray-700/50 rounded text-xs text-gray-300"
                      >
                        {f.ext.toUpperCase()} - {f.acodec} {f.abr ? `(${f.abr}kbps)` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Download Buttons */}
              <div className="space-y-4">
                {/* Original Format Button */}
                <button
                  onClick={() => handleDownload(true)}
                  disabled={downloading}
                  className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-3"
                >
                  {downloading ? (
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  )}
                  <span>Download Original Audio</span>
                  <span className="text-green-200 text-sm">(Best Quality - No Conversion)</span>
                </button>

                {/* Format Selection Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowFormatDropdown(!showFormatDropdown)}
                    disabled={downloading}
                    className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      <span>Convert to {selectedFormat.toUpperCase()}</span>
                    </div>
                    <svg className={`w-5 h-5 transition-transform ${showFormatDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {showFormatDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-10 overflow-hidden">
                      <div className="p-2">
                        {AUDIO_FORMATS.map((format) => (
                          <button
                            key={format.value}
                            onClick={() => {
                              setSelectedFormat(format.value);
                              setShowFormatDropdown(false);
                            }}
                            className={`w-full px-4 py-3 text-left rounded-lg transition-colors flex items-center justify-between ${
                              selectedFormat === format.value
                                ? 'bg-purple-600/20 text-purple-300'
                                : 'text-gray-300 hover:bg-gray-700/50'
                            }`}
                          >
                            <div>
                              <span className="font-medium">{format.label}</span>
                              <span className="text-gray-500 text-sm ml-2">- {format.desc}</span>
                            </div>
                            {selectedFormat === format.value && (
                              <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="p-3 border-t border-gray-700">
                        <button
                          onClick={() => {
                            handleDownload(false, selectedFormat);
                            setShowFormatDropdown(false);
                          }}
                          disabled={downloading}
                          className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          {downloading ? (
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Download as {selectedFormat.toUpperCase()}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Info Note */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <p className="text-blue-300 text-sm">
                  <span className="font-medium">Note:</span> Original audio preserves the exact quality as uploaded to YouTube (typically Opus or AAC).
                  Converting to other formats may reduce quality. Metadata and thumbnail are embedded in all downloads.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>Requires yt-dlp and ffmpeg installed on the server</p>
        </div>
      </div>
    </div>
  );
}

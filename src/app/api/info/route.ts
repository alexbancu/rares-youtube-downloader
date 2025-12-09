import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

interface VideoFormat {
  format_id: string;
  ext: string;
  acodec: string;
  vcodec: string;
  abr?: number;
  filesize?: number;
  format_note?: string;
  audio_ext: string;
}

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  formats: VideoFormat[];
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(url)) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    const info = await getVideoInfo(url);
    return NextResponse.json(info);
  } catch (error) {
    console.error('Error fetching video info:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch video info' },
      { status: 500 }
    );
  }
}

function getVideoInfo(url: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const args = [
      '-j',
      '--no-warnings',
      url
    ];

    const ytdlp = spawn('yt-dlp', args);
    let stdout = '';
    let stderr = '';

    ytdlp.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || 'Failed to get video info'));
        return;
      }

      try {
        const data = JSON.parse(stdout);

        // Filter audio-only formats
        const audioFormats = data.formats
          .filter((f: VideoFormat) =>
            f.vcodec === 'none' && f.acodec !== 'none'
          )
          .map((f: VideoFormat) => ({
            format_id: f.format_id,
            ext: f.audio_ext || f.ext,
            acodec: f.acodec,
            abr: f.abr,
            filesize: f.filesize,
            format_note: f.format_note
          }));

        resolve({
          title: data.title,
          thumbnail: data.thumbnail,
          duration: data.duration,
          uploader: data.uploader,
          formats: audioFormats
        });
      } catch (e) {
        reject(new Error('Failed to parse video info'));
      }
    });

    ytdlp.on('error', (err) => {
      reject(new Error(`yt-dlp not found. Please install it: ${err.message}`));
    });
  });
}

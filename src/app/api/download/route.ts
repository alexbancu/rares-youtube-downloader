import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { mkdir, readdir, unlink, stat, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';

// Available audio formats from yt-dlp
const AUDIO_FORMATS = ['best', 'aac', 'alac', 'flac', 'm4a', 'mp3', 'opus', 'vorbis', 'wav'];

export async function POST(request: NextRequest) {
  try {
    const { url, format, original } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(url)) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    if (!original && format && !AUDIO_FORMATS.includes(format)) {
      return NextResponse.json({ error: 'Invalid audio format' }, { status: 400 });
    }

    // Create a unique temp directory for this download
    const downloadId = uuidv4();
    const tempDir = join(tmpdir(), 'yt-audio-downloads', downloadId);
    await mkdir(tempDir, { recursive: true });

    const outputTemplate = join(tempDir, '%(title)s.%(ext)s');

    // Build yt-dlp arguments
    const args: string[] = [];

    if (original) {
      // Download best audio in original format without conversion
      args.push(
        '-f', 'bestaudio',
        '--embed-thumbnail',
        '--embed-metadata',
        '--add-metadata',
        '-o', outputTemplate,
        '--no-warnings',
        url
      );
    } else {
      // Convert to specified format
      args.push(
        '-x',
        '--audio-format', format || 'best',
        '--audio-quality', '0', // Best quality
        '--embed-thumbnail',
        '--embed-metadata',
        '--add-metadata',
        '-o', outputTemplate,
        '--no-warnings',
        url
      );
    }

    // Execute yt-dlp
    await runYtDlp(args);

    // Find the downloaded file
    const files = await readdir(tempDir);
    if (files.length === 0) {
      return NextResponse.json({ error: 'Download failed - no file created' }, { status: 500 });
    }

    const filename = files[0];
    const filePath = join(tempDir, filename);
    const fileStats = await stat(filePath);
    const fileBuffer = await readFile(filePath);

    // Determine content type
    const ext = filename.split('.').pop()?.toLowerCase() || 'audio';
    const contentTypes: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'm4a': 'audio/mp4',
      'aac': 'audio/aac',
      'opus': 'audio/opus',
      'ogg': 'audio/ogg',
      'webm': 'audio/webm',
      'flac': 'audio/flac',
      'wav': 'audio/wav',
      'alac': 'audio/mp4',
      'vorbis': 'audio/ogg'
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Clean up temp file
    try {
      await unlink(filePath);
    } catch {
      // Ignore cleanup errors
    }

    // Return the file
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': fileStats.size.toString()
      }
    });
  } catch (error) {
    console.error('Error downloading audio:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to download audio' },
      { status: 500 }
    );
  }
}

function runYtDlp(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn('yt-dlp', args);
    let stderr = '';

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log('yt-dlp:', data.toString());
    });

    ytdlp.stdout.on('data', (data) => {
      console.log('yt-dlp:', data.toString());
    });

    ytdlp.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || 'yt-dlp failed'));
        return;
      }
      resolve();
    });

    ytdlp.on('error', (err) => {
      reject(new Error(`yt-dlp not found. Please ensure yt-dlp is installed: ${err.message}`));
    });
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { mkdir, readdir, unlink, stat, readFile, rmdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';

// Available audio formats from yt-dlp
const AUDIO_FORMATS = ['best', 'aac', 'alac', 'flac', 'm4a', 'mp3', 'opus', 'vorbis', 'wav'];

// Formats that support thumbnail embedding
const THUMBNAIL_SUPPORTED = ['mp3', 'mkv', 'mka', 'ogg', 'opus', 'flac', 'm4a', 'mp4', 'm4v', 'mov'];

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;

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
    tempDir = join(tmpdir(), 'yt-audio-downloads', downloadId);
    await mkdir(tempDir, { recursive: true });

    const outputTemplate = join(tempDir, '%(title)s.%(ext)s');

    // Build yt-dlp arguments
    const args: string[] = [];

    if (original) {
      // For "original" quality, extract to opus format (same codec YouTube uses)
      // This preserves quality while allowing thumbnail embedding
      // opus in ogg container supports thumbnails, webm does not
      args.push(
        '-x',
        '--audio-format', 'opus',
        '--audio-quality', '0',
        '--embed-metadata',
        '--parse-metadata', 'description:(?s)(?P<meta_comment>.+)',
        '-o', outputTemplate,
        '--no-warnings',
        '--no-playlist',
        url
      );
    } else {
      // Convert to specified format
      const targetFormat = format || 'mp3';
      args.push(
        '-x',
        '--audio-format', targetFormat,
        '--audio-quality', '0',
        '--embed-metadata',
        '--parse-metadata', 'description:(?s)(?P<meta_comment>.+)',
        '-o', outputTemplate,
        '--no-warnings',
        '--no-playlist',
        url
      );

      // Only add thumbnail embedding for supported formats
      if (THUMBNAIL_SUPPORTED.includes(targetFormat)) {
        args.splice(args.indexOf('--embed-metadata'), 0, '--embed-thumbnail');
      }
    }

    // Add thumbnail for opus (original) - it's supported
    if (original) {
      args.splice(args.indexOf('--embed-metadata'), 0, '--embed-thumbnail');
    }

    // Execute yt-dlp
    await runYtDlp(args);

    // Find the downloaded file
    const files = await readdir(tempDir);
    if (files.length === 0) {
      return NextResponse.json({ error: 'Download failed - no file created' }, { status: 500 });
    }

    // Filter out any non-audio files (like .jpg thumbnails if embedding failed)
    const audioFiles = files.filter(f => !f.endsWith('.jpg') && !f.endsWith('.png') && !f.endsWith('.webp'));
    if (audioFiles.length === 0) {
      return NextResponse.json({ error: 'Download failed - no audio file created' }, { status: 500 });
    }

    const filename = audioFiles[0];
    const filePath = join(tempDir, filename);
    const fileStats = await stat(filePath);
    const fileBuffer = await readFile(filePath);

    // Determine content type
    const ext = filename.split('.').pop()?.toLowerCase() || 'audio';
    const contentTypes: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'm4a': 'audio/mp4',
      'aac': 'audio/aac',
      'opus': 'audio/ogg',
      'ogg': 'audio/ogg',
      'webm': 'audio/webm',
      'flac': 'audio/flac',
      'wav': 'audio/wav',
      'alac': 'audio/mp4',
      'vorbis': 'audio/ogg'
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Clean up temp files
    for (const file of files) {
      try {
        await unlink(join(tempDir, file));
      } catch {
        // Ignore cleanup errors
      }
    }
    try {
      await rmdir(tempDir);
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

    // Clean up on error
    if (tempDir) {
      try {
        const files = await readdir(tempDir);
        for (const file of files) {
          await unlink(join(tempDir, file)).catch(() => {});
        }
        await rmdir(tempDir).catch(() => {});
      } catch {
        // Ignore cleanup errors
      }
    }

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
    let stdout = '';

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('yt-dlp stderr:', data.toString());
    });

    ytdlp.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('yt-dlp stdout:', data.toString());
    });

    ytdlp.on('close', (code) => {
      if (code !== 0) {
        console.error('yt-dlp failed with code:', code);
        console.error('stderr:', stderr);
        console.error('stdout:', stdout);
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

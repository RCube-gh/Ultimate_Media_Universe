import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import sharp from "sharp";
import crypto from "crypto"; // For hash

// 📂 Target: ../library (Local) or ./library (Docker/Production)
let LIBRARY_ROOT = path.resolve(process.cwd(), "..", "library");
if (!fs.existsSync(LIBRARY_ROOT)) {
    LIBRARY_ROOT = path.join(process.cwd(), "library");
}
const PROCESS_ROOT = process.cwd(); // app root
const CACHE_ROOT = path.join(PROCESS_ROOT, ".cache", "thumbnails");

// Ensure cache root exists
if (!fs.existsSync(CACHE_ROOT)) {
    fs.mkdirSync(CACHE_ROOT, { recursive: true });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path: pathSegments } = await params;
    const searchParams = req.nextUrl.searchParams;
    const isThumb = searchParams.has("thumb");

    // 2. Construct safe file path
    const relativePath = pathSegments.join("/");
    const fullPath = path.resolve(LIBRARY_ROOT, relativePath);

    // 🛡️ Security Check
    if (!fullPath.startsWith(LIBRARY_ROOT)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    // 3. Check if file exists
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
        return new NextResponse("Not Found", { status: 404 });
    }

    const ext = path.extname(fullPath).toLowerCase();

    // 🎥 Standard File Request (Stream & Range Support)
    if (!isThumb) {
        const stat = fs.statSync(fullPath);
        const fileSize = stat.size;
        const range = req.headers.get("range");

        // Comprehensive MIME Map
        const MIME_TYPES: Record<string, string> = {
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".ogg": "video/ogg",
            ".avi": "video/x-msvideo",
            ".mov": "video/quicktime",
            ".mkv": "video/x-matroska",
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".flac": "audio/flac",
            ".m4a": "audio/mp4",
            ".aac": "audio/aac",
            ".wma": "audio/x-ms-wma",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif",
            ".svg": "image/svg+xml",
            ".avif": "image/avif"
        };

        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        // Debug logging
        // console.log(`📡 Serving: ${relativePath} | Ext: ${ext} | Type: ${contentType}`);

        // 📏 Range Request Handling
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);

            // 🚀 Optimized Chunking Strategy for Raspberry Pi
            // Instead of streaming the whole file (which chokes the Pi), 
            // we send small, manageable chunks (e.g., 2MB).
            const MAX_CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
            const fileSizeRemaining = fileSize - 1;

            let end = parts[1] ? parseInt(parts[1], 10) : fileSizeRemaining;

            // Cap the chunk size to prevent memory pressure / connection timeout
            if (end - start > MAX_CHUNK_SIZE) {
                end = start + MAX_CHUNK_SIZE;
            }

            // Ensure we don't exceed file size
            if (end > fileSizeRemaining) {
                end = fileSizeRemaining;
            }

            const chunksize = (end - start) + 1;

            // Increased buffer for better throughput
            const fileStream = fs.createReadStream(fullPath, {
                start,
                end,
                highWaterMark: 512 * 1024 // 512KB buffer 
            });

            return new NextResponse(fileStream as any, {
                status: 206,
                headers: {
                    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                    "Accept-Ranges": "bytes",
                    "Content-Length": chunksize.toString(),
                    "Content-Type": contentType,
                    "Cache-Control": "public, max-age=31536000, immutable",
                },
            });
        } else {
            // Full Stream (Fallback)
            const fileStream = fs.createReadStream(fullPath, {
                highWaterMark: 512 * 1024
            });
            return new NextResponse(fileStream as any, {
                status: 200,
                headers: {
                    "Content-Length": fileSize.toString(),
                    "Content-Type": contentType,
                    "Cache-Control": "public, max-age=31536000, immutable",
                },
            });
        }
    }

    // 🖼️ Thumbnail Request Logic
    // Only support images for now (and Videos via FFmpeg)
    const isImage = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"].includes(ext);
    const isVideo = [".mp4", ".webm", ".mkv", ".avi", ".mov", ".m4v"].includes(ext);

    if (!isImage && !isVideo) {
        return new NextResponse("Not an image or video", { status: 400 });
    }

    try {
        // Video Thumbnail Logic (Seekbar Preview)
        if (isVideo) {
            const isSprite = searchParams.has("sprite");
            if (isSprite) {
                const hash = crypto.createHash("md5").update(fullPath).digest("hex");
                const spriteFilename = `${hash}_sprite.jpg`;
                const spritePath = path.join(CACHE_ROOT, spriteFilename);

                if (fs.existsSync(spritePath)) {
                    const stats = fs.statSync(spritePath);
                    if (stats.size > 0) {
                        const spriteBuffer = await fsPromises.readFile(spritePath);
                        return new NextResponse(spriteBuffer, {
                            headers: {
                                "Content-Type": "image/jpeg",
                                "Cache-Control": "public, max-age=31536000, immutable",
                                "X-Cache": "HIT",
                            },
                        });
                    } else {
                        return new NextResponse("Sprite Empty", { status: 404 });
                    }
                } else {
                    return new NextResponse("Sprite not found", { status: 404 });
                }
            }

            const timeParam = searchParams.get("time");
            // If no time is specified for a video, we might want a default thumb (e.g. at 10s or 10%)
            // For now, let's assume time=0 if not provided, or handle as "poster" request
            const time = parseFloat(timeParam || "0");

            // Unique cache for this specific timestamp
            const hashKey = `${fullPath}_time_${time}`;
            const hash = crypto.createHash("md5").update(hashKey).digest("hex");
            const cacheFilename = `${hash}_vid_thumb.jpg`; // Use JPG for speed/compatibility from FFmpeg
            const cachePath = path.join(CACHE_ROOT, cacheFilename);

            // A. Check Cache
            if (fs.existsSync(cachePath)) {
                // Check if file is empty (sometimes ffmpeg fails)
                const stat = fs.statSync(cachePath);
                if (stat.size > 0) {
                    const cachedBuffer = await fsPromises.readFile(cachePath);
                    return new NextResponse(cachedBuffer, {
                        headers: {
                            "Content-Type": "image/jpeg",
                            "Cache-Control": "public, max-age=31536000, immutable",
                            "X-Cache": "HIT",
                        },
                    });
                }
            }

            // B. Generate Fallback (MISS)
            // console.log(`🎥 Generating video thumb: ${relativePath} @ ${time}s`);

            // Construct FFmpeg command
            // -y: Overwrite
            // -ss: Seek to time (fast seek before input)
            // -i: Input
            // -vframes 1: Only one frame
            // -vf scale: Resize height to 180 (optimizing for small preview), width auto. 
            // NOTE: Preview is usually small, standard is often 160-200px height.
            const ffmpegCmd = `ffmpeg -y -ss ${time} -i "${fullPath}" -vframes 1 -vf "scale=-1:180" -q:v 5 "${cachePath}"`;

            const { exec } = await import("child_process");
            const util = await import("util");
            const execAsync = util.promisify(exec);

            await execAsync(ffmpegCmd);

            // Read back
            if (fs.existsSync(cachePath)) {
                const generatedBuffer = await fsPromises.readFile(cachePath);
                return new NextResponse(generatedBuffer, {
                    headers: {
                        "Content-Type": "image/jpeg",
                        "Cache-Control": "public, max-age=31536000, immutable",
                        "X-Cache": "MISS",
                    },
                });
            } else {
                throw new Error("FFmpeg failed to generate output file");
            }
        }

        // Image Logic (Existing)
        const hash = crypto.createHash("md5").update(fullPath).digest("hex");
        const cacheFilename = `${hash}_thumb.webp`; // Flat structure or subdir? Flat for simplicity in fallback.
        const cachePath = path.join(CACHE_ROOT, cacheFilename);

        // A. Check Cache
        if (fs.existsSync(cachePath)) {
            const cachedBuffer = await fsPromises.readFile(cachePath);
            return new NextResponse(cachedBuffer, {
                headers: {
                    "Content-Type": "image/webp",
                    "Cache-Control": "public, max-age=31536000, immutable",
                    "X-Cache": "HIT",
                },
            });
        }

        // B. Generate Fallback (MISS)
        // console.log(`🎨 Generating fallback thumb: ${relativePath}`);
        const imageBuffer = await fsPromises.readFile(fullPath);

        const processedBuffer = await sharp(imageBuffer)
            .resize({ height: 300, withoutEnlargement: true }) // Fixed height 300px
            .webp({ quality: 75 })
            .toBuffer();

        // Save to cache
        await fsPromises.writeFile(cachePath, processedBuffer);

        return new NextResponse(processedBuffer as any, {
            headers: {
                "Content-Type": "image/webp",
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Cache": "MISS",
            },
        });

    } catch (e) {
        console.error("Thumbnail processing failed:", e);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

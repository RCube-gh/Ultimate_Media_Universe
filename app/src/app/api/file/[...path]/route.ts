import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import sharp from "sharp";
import crypto from "crypto"; // For hash

// 📂 Target: ../library
const LIBRARY_ROOT = path.resolve(process.cwd(), "..", "library");
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
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const fileStream = fs.createReadStream(fullPath, { start, end });

            return new NextResponse(fileStream as any, {
                status: 206,
                headers: {
                    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                    "Accept-Ranges": "bytes",
                    "Content-Length": chunksize.toString(),
                    "Content-Type": contentType,
                    "Cache-Control": "public, max-age=31536000, immutable", // Optional: long cache
                },
            });
        } else {
            // Full Stream
            const fileStream = fs.createReadStream(fullPath);
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
    // Only support images for now
    const isImage = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"].includes(ext);
    if (!isImage) {
        return new NextResponse("Not an image", { status: 400 });
    }

    try {
        // Create unique cache filename
        // Consistent with scanner logic if possible, or independent hashing
        // Scanner uses: [itemId]/[hash].webp. Here we don't know itemId easily.
        // So we use a flat hash of the full path for fallback generation.
        // NOTE: If we want to align with Scanner cache, we need to know the structure.
        // For now, let's use a simple hash of the path to keep it robust and independent.

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

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

    // 🎥 Standard File Request (Not a thumbnail request)
    if (!isThumb) {
        // Stream original file
        const fileBuffer = await fsPromises.readFile(fullPath);

        let contentType = "application/octet-stream";
        if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
        else if (ext === ".png") contentType = "image/png";
        else if (ext === ".webp") contentType = "image/webp";
        else if (ext === ".mp4") contentType = "video/mp4";

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
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

        return new NextResponse(processedBuffer, {
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

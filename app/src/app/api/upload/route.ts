import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, unlink, rename } from "fs/promises";
import { createWriteStream } from "fs";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import AdmZip from "adm-zip";
import busboy from "busboy";
import { scanMangaFolder, scanAudioFolder } from "@/lib/scanner";

const execAsync = promisify(exec);

// 🕵️‍♀️ Helper: Get Video Duration
async function getVideoDuration(filePath: string): Promise<number | null> {
    try {
        const { stdout } = await execAsync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
        );
        const duration = parseFloat(stdout.trim());
        if (!isNaN(duration)) return Math.floor(duration);
    } catch (error) {
        console.error("💥 ffprobe failed:", error);
    }
    return null;
}

// 🎞️ Helper: Generate Sprite Sheet
async function generateSpriteSheet(videoPath: string, spritePath: string, duration: number) {
    const interval = 10;
    const thumbWidth = 160;
    const thumbHeight = 90;
    const columns = 10;
    const totalImages = Math.ceil(duration / interval);
    const rows = Math.ceil(totalImages / columns);

    const cmd = `ffmpeg -y -i "${videoPath}" -vf "fps=1/${interval},scale=${thumbWidth}:${thumbHeight}:force_original_aspect_ratio=decrease,pad=${thumbWidth}:${thumbHeight}:(ow-iw)/2:(oh-ih)/2,tile=${columns}x${rows}" -frames:v 1 -q:v 2 "${spritePath}"`;

    console.log(`🎬 Generating Sprite Sheet: ${spritePath}`);

    try {
        await execAsync(cmd);
        console.log("✅ Sprite Sheet Generated!");
    } catch (e) {
        console.error("❌ Sprite Gen Failed:", e);
    }
}

export async function POST(req: NextRequest) {
    console.log("🔥 [API] Streaming Upload Request Received (Busboy Mode)");

    // 1. Setup Directories
    const projectRoot = process.cwd();
    let libraryDir = join(projectRoot, "..", "library");
    if (!require("fs").existsSync(libraryDir)) {
        libraryDir = join(projectRoot, "library");
    }
    const uploadDir = join(libraryDir, "uploads");
    const thumbDir = join(libraryDir, "thumbnails");
    const tempDir = join(libraryDir, "temp");

    // Ensure Dirs
    await mkdir(uploadDir, { recursive: true });
    await mkdir(thumbDir, { recursive: true });
    await mkdir(tempDir, { recursive: true });

    // 2. Parse Multipart Stream with Busboy
    // Create new headers object compatible with busboy
    const headers: any = {};
    req.headers.forEach((val, key) => { headers[key] = val; });

    const bb = busboy({ headers });

    const fields: Record<string, string> = {};
    const files: Record<string, { path: string, originalName: string, size: number }> = {};
    const fileWrites: Promise<void>[] = [];

    // Promise Wrapper for Busboy Events
    const parsingPromise = new Promise<void>((resolve, reject) => {

        bb.on('file', (name, file, info) => {
            const { filename } = info;
            console.log(`📂 Streaming File: ${name} -> ${filename}`);

            const tempName = `${Date.now()}_${Math.random().toString(36).substring(7)}_${filename}`;
            const savePath = join(tempDir, tempName);

            const writeStream = createWriteStream(savePath);
            let bytesWritten = 0;

            file.on('data', (data) => {
                bytesWritten += data.length;
            });

            const writePromise = pipeline(file, writeStream).then(() => {
                console.log(`✅ File Streamed: ${name} (${bytesWritten} bytes)`);
                files[name] = {
                    path: savePath,
                    originalName: filename,
                    size: bytesWritten
                };
            }).catch(err => {
                console.error(`❌ File Stream Error (${name}):`, err);
                reject(err);
            });

            fileWrites.push(writePromise);
        });

        bb.on('field', (name, val) => {
            fields[name] = val;
        });

        bb.on('close', async () => {
            console.log("🏁 Stream Parsing Complete.");
            try {
                await Promise.all(fileWrites);
                resolve();
            } catch (e) {
                reject(e);
            }
        });

        bb.on('error', (err) => {
            console.error("❌ Busboy Error:", err);
            reject(err);
        });
    });

    // Start Piping
    // Convert Web ReadableStream to Node Readable
    // @ts-ignore
    const nodeStream = Readable.fromWeb(req.body);
    nodeStream.pipe(bb);

    try {
        // Wait for parsing to finish
        await parsingPromise;

        // ============================================
        // 3. Process Logic (After Stream is on Disk)
        // ============================================

        const title = fields.title;
        const type = fields.type;
        const description = fields.description;
        const sourceUrl = fields.source_url;
        const url = fields.url; // Use 'url' if provided (link mode) or 'source_url'

        const mainFileEntry = files.mainFile;
        const thumbnailFileEntry = files.thumbnailFile;

        if (!title || !type) {
            return NextResponse.json({ success: false, message: "Title and Type are required!" }, { status: 400 });
        }

        let thumbnailPath: string | null = null;
        let filePath: string | null = null;
        let isArchived = false;
        let duration: number | null = null;

        // Process Thumbnail (Move from temp)
        if (thumbnailFileEntry) {
            const { randomUUID } = await import('crypto');
            const ext = thumbnailFileEntry.originalName.split('.').pop() || 'jpg';
            const newFileName = `${Date.now()}_thumb_${randomUUID()}.${ext}`;
            const targetPath = join(thumbDir, newFileName);

            await rename(thumbnailFileEntry.path, targetPath);
            thumbnailPath = `/api/file/thumbnails/${newFileName}`;
        }

        const isZip = mainFileEntry && (mainFileEntry.originalName.toLowerCase().endsWith(".zip") || mainFileEntry.originalName.toLowerCase().endsWith(".cbz"));
        const isZipTarget = (type === "MANGA" || type === "AUDIO");

        // === ZIP PROCESSING ===
        if (isZipTarget && isZip && mainFileEntry) {
            const label = type === "MANGA" ? "MANGA" : "AUDIO";
            const targetDirName = type === "MANGA" ? "manga" : "audio";
            console.log(`📚 Processing ${label} ZIP: ${mainFileEntry.originalName}`);

            const { randomUUID } = await import('crypto');
            const folderName = randomUUID();
            const itemDir = join(libraryDir, targetDirName, folderName);

            await mkdir(itemDir, { recursive: true });

            try {
                const zip = new AdmZip(mainFileEntry.path);
                zip.extractAllTo(itemDir, true);
                console.log("✅ Extraction complete!");

                // Cleanup temp zip
                await unlink(mainFileEntry.path);
            } catch (err: any) {
                console.error("❌ ZIP Extraction Failed:", err);
                return NextResponse.json({ success: false, message: `ZIP Extraction Failed: ${err.message}` }, { status: 500 });
            }

            // Scanner
            let itemId = "";
            const trackTitles = fields.trackTitles ? JSON.parse(fields.trackTitles) : {};

            if (type === "MANGA") {
                itemId = await scanMangaFolder(itemDir, title);
            } else {
                itemId = await scanAudioFolder(itemDir, title, trackTitles);
            }

            // Update Metadata
            const updateData: any = {};
            if (sourceUrl) updateData.url = sourceUrl;
            if (description) updateData.description = description;
            if (fields.tags) {
                try {
                    const tagsList = JSON.parse(fields.tags);
                    updateData.tags = {
                        connectOrCreate: tagsList.map((t: string) => ({ where: { name: t }, create: { name: t } }))
                    };
                } catch (e) { }
            }

            if (Object.keys(updateData).length > 0) {
                await prisma.mediaItem.update({ where: { id: itemId }, data: updateData });
            }

            return NextResponse.json({ success: true, message: `${label} Uploaded & Scanned!`, itemId });
        }

        // === SINGLE FILE PROCESSING ===
        else if (mainFileEntry) {
            console.log("🚚 Processing Main File...");

            const { randomUUID } = await import('crypto');
            const ext = mainFileEntry.originalName.split('.').pop() || 'bin';
            const newFileName = `${Date.now()}_file_${randomUUID()}.${ext}`;
            const targetPath = join(uploadDir, newFileName);

            await rename(mainFileEntry.path, targetPath);

            filePath = `/api/file/uploads/${newFileName}`;
            isArchived = true;

            if (type === "VIDEO") {
                duration = await getVideoDuration(targetPath);
            }

            // If Image type and no thumbnail, use self
            if (type === "IMAGE" && !thumbnailPath) {
                thumbnailPath = filePath;
            }

            // Create DB Entry
            let tagData = undefined;
            if (fields.tags) {
                try {
                    const tagsList = JSON.parse(fields.tags);
                    tagData = { connectOrCreate: tagsList.map((t: string) => ({ where: { name: t }, create: { name: t } })) };
                } catch (e) { }
            }

            const newItem = await prisma.mediaItem.create({
                data: {
                    title,
                    url: url || sourceUrl || null,
                    type,
                    description,
                    isArchived,
                    filePath,
                    thumbnail: thumbnailPath,
                    size: BigInt(mainFileEntry.size),
                    duration,
                    status: (type === "VIDEO") ? "PROCESSING" : "READY",
                    tags: tagData,
                },
            });

            // Background Processing
            if (type === "VIDEO" && duration) {
                (async () => {
                    try {
                        console.log("⚡ Starting Background Processing:", newItem.id);
                        const { createHash } = await import("crypto");
                        const hash = createHash("md5").update(targetPath).digest("hex");

                        const spriteName = `${hash}_sprite.jpg`;
                        const PROCESS_ROOT = process.cwd();
                        const CACHE_ROOT = join(PROCESS_ROOT, ".cache", "thumbnails");
                        await mkdir(CACHE_ROOT, { recursive: true });
                        const targetSpritePath = join(CACHE_ROOT, spriteName);

                        await generateSpriteSheet(targetPath, targetSpritePath, duration!);

                        let finalThumbPath = thumbnailPath;
                        if (!finalThumbPath) {
                            const thumbName = `${hash}_thumb_auto.jpg`;
                            const targetThumbPath = join(thumbDir, thumbName);
                            // Auto-thumb at 20%
                            const time = Math.min(Math.max(duration! * 0.2, 1), 10);
                            await execAsync(`ffmpeg -y -ss ${time} -i "${targetPath}" -vframes 1 -q:v 2 "${targetThumbPath}"`);
                            finalThumbPath = `/api/file/thumbnails/${thumbName}`;
                        }

                        // Update
                        await prisma.mediaItem.update({
                            where: { id: newItem.id },
                            data: { status: "READY", thumbnail: finalThumbPath }
                        });
                        console.log("✅ Background Processing Complete!", newItem.id);
                    } catch (bgError) {
                        console.error("❌ Background Processing Failed", bgError);
                        // Mark ready even if bg failed
                        await prisma.mediaItem.update({
                            where: { id: newItem.id },
                            data: { status: "READY" }
                        });
                    }
                })();
            }

            return NextResponse.json({ success: true, message: "Upload Complete! 💓" });
        }

        // === URL ONLY ===
        else {
            let tagData = undefined;
            if (fields.tags) {
                try {
                    const tagsList = JSON.parse(fields.tags);
                    tagData = { connectOrCreate: tagsList.map((t: string) => ({ where: { name: t }, create: { name: t } })) };
                } catch (e) { }
            }

            await prisma.mediaItem.create({
                data: {
                    title,
                    url: url || sourceUrl || null,
                    type,
                    description,
                    isArchived: false,
                    thumbnail: thumbnailPath,
                    status: "READY",
                    tags: tagData,
                },
            });
            return NextResponse.json({ success: true, message: "Link Saved! 🔗" });
        }

    } catch (e: any) {
        console.error("💥 General API Error:", e);
        return NextResponse.json({ success: false, message: `Server Error: ${e.message}` }, { status: 500 });
    }
}

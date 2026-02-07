import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { createWriteStream } from "fs";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import AdmZip from "adm-zip";
import { scanMangaFolder, scanAudioFolder } from "@/lib/scanner"; // 1. Static Import

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
    // Configuration
    const interval = 10; // Capture every 10 seconds
    const thumbWidth = 160; // Standard preview width
    const thumbHeight = 90; // Standard preview height (16:9)
    const columns = 10; // 10 images per row

    // Calculate required grid
    const totalImages = Math.ceil(duration / interval);
    const rows = Math.ceil(totalImages / columns);

    // FFmpeg Command
    // -vf select: pick frames
    // -vf scale: resize each frame
    // -vf tile: stitch grid
    // -vsync 0: process frames as they come
    const cmd = `ffmpeg -y -i "${videoPath}" -vf "select='not(mod(n,${interval}*24))',scale=${thumbWidth}:${thumbHeight},tile=${columns}x${rows}" -frames:v 1 -q:v 2 "${spritePath}"`;

    // NOTE: 'select' filter with time is tricky. Using fps filter is easier:
    // fps=1/10 means 1 frame every 10 seconds.
    // scale=${thumbWidth}:${thumbHeight}:force_original_aspect_ratio=decrease,pad=${thumbWidth}:${thumbHeight}:(ow-iw)/2:(oh-ih)/2
    const cmd2 = `ffmpeg -y -i "${videoPath}" -vf "fps=1/${interval},scale=${thumbWidth}:${thumbHeight}:force_original_aspect_ratio=decrease,pad=${thumbWidth}:${thumbHeight}:(ow-iw)/2:(oh-ih)/2,tile=${columns}x${rows}" -frames:v 1 -q:v 2 "${spritePath}"`;

    console.log(`🎬 Generating Sprite Sheet: ${spritePath}`);
    // console.log(`Command: ${cmd2}`);

    try {
        await execAsync(cmd2);
        console.log("✅ Sprite Sheet Generated!");
    } catch (e) {
        console.error("❌ Sprite Gen Failed:", e);
    }
}

export async function POST(req: NextRequest) {
    console.log("🔥 [API] Upload Request Received");

    try {
        const formData = await req.formData();

        const url = formData.get("url") as string;
        const sourceUrl = formData.get("source_url") as string;
        const title = formData.get("title") as string;
        const type = formData.get("type") as string;
        const description = formData.get("description") as string;

        const thumbnailFile = formData.get("thumbnailFile") as File | null;
        const mainFile = formData.get("mainFile") as File | null;

        if (!title || !type) {
            return NextResponse.json({ success: false, message: "Title and Type are required!" }, { status: 400 });
        }

        // Docker: /app/library (Mounted at /app/library)

        const projectRoot = process.cwd();
        let libraryDir = join(projectRoot, "..", "library"); // Local dev / Docker root

        // 🛡️ Fallback: If not found, try inner directory (old config)
        if (!require("fs").existsSync(libraryDir)) {
            libraryDir = join(projectRoot, "library");
        }
        const uploadDir = join(libraryDir, "uploads");
        const thumbDir = join(libraryDir, "thumbnails");

        await mkdir(uploadDir, { recursive: true });
        await mkdir(thumbDir, { recursive: true });

        let thumbnailPath: string | null = null;
        let filePath: string | null = null;
        let isArchived = false;
        let duration: number | null = null;

        // Parse Tags
        const tagsJson = formData.get("tags") as string;
        let tagData: any = undefined;
        if (tagsJson) {
            try {
                const tagsList = JSON.parse(tagsJson);
                if (Array.isArray(tagsList)) {
                    tagData = {
                        connectOrCreate: tagsList.map((tagName: string) => ({
                            where: { name: tagName },
                            create: { name: tagName },
                        })),
                    };
                }
            } catch (e) { console.error("Failed to parse tags", e); }
        }

        // 1️⃣ Process Thumbnail
        if (thumbnailFile && thumbnailFile.size > 0 && thumbnailFile.name !== "undefined") {
            try {
                const bytes = await thumbnailFile.arrayBuffer();
                const buffer = Buffer.from(bytes);
                const safeName = thumbnailFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
                const fileName = `${Date.now()}_thumb_${safeName}`;
                const savePath = join(thumbDir, fileName);

                await writeFile(savePath, buffer);
                thumbnailPath = `/api/file/thumbnails/${fileName}`;
            } catch (e) {
                console.error("Thumbnail save failed", e);
            }
        }

        // 2️⃣ Process Main Content
        const isZip = mainFile && mainFile.name.toLowerCase().endsWith(".zip");
        const isZipTarget = (type === "MANGA" || type === "AUDIO");

        // 2️⃣ Process Main Content (ZIPs)
        if (isZipTarget && isZip) {
            const uploadedFile = mainFile;
            if (uploadedFile && uploadedFile.size > 0) {
                const label = type === "MANGA" ? "MANGA" : "AUDIO";
                const targetDirName = type === "MANGA" ? "manga" : "audio";
                console.log(`📚 Processing ${label} ZIP Upload: ${uploadedFile.name}`);

                const safeTitle = title.replace(/[^a-zA-Z0-9.\-_]/g, "_");
                let itemDir = join(libraryDir, targetDirName, safeTitle);
                let finalTitle = title;

                // 🛡️ Safety Check: If folder exists, append timestamp to make it unique
                try {
                    await mkdir(itemDir, { recursive: true }); // Try creating (recursive for parents)
                } catch (e: any) {
                    if (e.code === 'EEXIST') {
                        console.log("⚠️ Folder exists, creating unique path.");
                        const timestamp = Date.now();
                        finalTitle = `${title} (${timestamp})`; // Update title for DB
                        const safeUnique = `${safeTitle}_${timestamp}`;
                        itemDir = join(libraryDir, targetDirName, safeUnique);
                        await mkdir(itemDir, { recursive: true });
                    } else {
                        throw e; // Real error
                    }
                }

                // STREAM ZIP to Disk
                const tempZipPath = join(uploadDir, `${Date.now()}_temp_${safeTitle}.zip`);

                const stream = uploadedFile.stream();
                const body = Readable.fromWeb(stream as any);
                await pipeline(body, createWriteStream(tempZipPath));

                console.log("🔓 Extracting ZIP (from File)...");
                try {
                    // Use File Path to avoid memory load
                    const zip = new AdmZip(tempZipPath);
                    zip.extractAllTo(itemDir, true);
                    console.log("✅ Extraction complete!");
                } catch (err: any) {
                    console.error("❌ ZIP Extraction Failed:", err);
                    return NextResponse.json({
                        success: false,
                        message: `ZIP Extraction Failed: ${err.message}`
                    }, { status: 500 });
                }

                // Scan
                const sourceUrl = formData.get("source_url") as string;
                try {
                    console.log("🕵️‍♀️ Starting Scanner...");
                    let itemId = "";

                    // Parse Custom Track Titles
                    const trackTitlesJson = formData.get("trackTitles") as string;
                    let trackTitles: Record<string, string> = {};
                    if (trackTitlesJson) {
                        try {
                            trackTitles = JSON.parse(trackTitlesJson);
                        } catch (e) {
                            console.warn("Failed to parse track custom titles JSON", e);
                        }
                    }

                    if (type === "MANGA") {
                        itemId = await scanMangaFolder(itemDir, finalTitle);
                    } else {
                        itemId = await scanAudioFolder(itemDir, finalTitle, trackTitles);
                    }

                    // Update with URL, Description AND TAGS
                    const updateData: any = {};
                    if (sourceUrl) updateData.url = sourceUrl;
                    if (description) updateData.description = description;
                    if (tagData) updateData.tags = tagData; // Add Tags!

                    if (Object.keys(updateData).length > 0) {
                        await prisma.mediaItem.update({
                            where: { id: itemId },
                            data: updateData
                        });
                    }

                    console.log(`✅ ${label} Registered via Scanner:`, itemId);
                    return NextResponse.json({ success: true, message: `${label} Uploaded & Scanned! 🎵`, itemId });

                } catch (scanErr: any) {
                    console.error("❌ Scan Failed:", scanErr);
                    return NextResponse.json({
                        success: false,
                        message: `Scanner Failed: ${scanErr.message}`
                    }, { status: 500 });
                }

            } else {
                return NextResponse.json({ success: false, message: "No ZIP file provided." }, { status: 400 });
            }
        }
        else if (mainFile && mainFile.size > 0 && mainFile.name !== "undefined") {
            // Processing Single File (Video, Image, or Single Audio)
            // If try to upload ZIP for Video/Link, it falls here (treated as file)
            // If Single Audio (not zip), it falls here.

            console.log("🚚 Processing Main File Upload (Stream Mode)...");
            // Stream the file instead of buffering into memory to avoid 502/OOM errors on large files
            const stream = mainFile.stream();
            const body = Readable.fromWeb(stream as any); // Convert Web Stream to Node Stream

            const safeName = mainFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
            const fileName = `${Date.now()}_file_${safeName}`;
            const savePath = join(uploadDir, fileName);

            // Use imported createWriteStream
            const fileStream = createWriteStream(savePath);
            await pipeline(body, fileStream);

            filePath = `/api/file/uploads/${fileName}`;
            isArchived = true;

            if (type === "VIDEO") {
                duration = await getVideoDuration(savePath);
            } else if (type === "IMAGE") {
                // 🖼️ For Image type, use the file itself as thumbnail if not provided
                if (!thumbnailPath) {
                    thumbnailPath = filePath;
                }
            }

            // 3️⃣ DB Create (Initial - Status PROCESSING)
            let newItem;
            if (type !== "MANGA") {
                newItem = await prisma.mediaItem.create({
                    data: {
                        title,
                        url: url || sourceUrl || null,
                        type,
                        description,
                        isArchived,
                        filePath,
                        thumbnail: thumbnailPath, // Maybe null initially if auto-gen needed
                        size: mainFile ? BigInt(mainFile.size) : null,
                        duration,
                        status: (type === "VIDEO") ? "PROCESSING" : "READY", // Always process video for sprites
                        tags: tagData,
                    },
                });
                console.log("✅ Created Item (Processing):", newItem.id);

                // ⚡ Background Processing (Fire & Forget)
                if (type === "VIDEO" && duration) {
                    (async () => {
                        try {
                            console.log("⚡ Starting Background Processing for:", newItem.id);
                            const { createHash } = await import("crypto");
                            const hash = createHash("md5").update(savePath).digest("hex");

                            // 1. Sprite Sheet
                            const spriteName = `${hash}_sprite.jpg`;
                            const PROCESS_ROOT = process.cwd();
                            const CACHE_ROOT = join(PROCESS_ROOT, ".cache", "thumbnails");
                            await mkdir(CACHE_ROOT, { recursive: true });
                            const targetSpritePath = join(CACHE_ROOT, spriteName);

                            await generateSpriteSheet(savePath, targetSpritePath, duration!);

                            // 2. Auto-Thumbnail (if needed)
                            let finalThumbPath = thumbnailPath;
                            if (!finalThumbPath) {
                                console.log("🖼️ Auto-generating thumbnail...");
                                const thumbName = `${hash}_thumb_auto.jpg`;
                                const targetThumbPath = join(thumbDir, thumbName);
                                // Extract at 20% or 5s
                                const time = Math.min(Math.max(duration! * 0.2, 1), 10);
                                try {
                                    await execAsync(`ffmpeg -y -ss ${time} -i "${savePath}" -vframes 1 -q:v 2 "${targetThumbPath}"`);
                                    finalThumbPath = `/api/file/thumbnails/${thumbName}`;
                                } catch (e) {
                                    console.error("❌ Auto-Thumbnail Failed", e);
                                }
                            }

                            // 3. Update Status to READY
                            await prisma.mediaItem.update({
                                where: { id: newItem.id },
                                data: {
                                    status: "READY",
                                    thumbnail: finalThumbPath
                                }
                            });
                            console.log("✅ Background Processing Complete!", newItem.id);
                        } catch (bgError) {
                            console.error("❌ Background Processing Failed", bgError);
                            // Mark as READY anyway so it's viewable (just missing sprite/thumb)
                            await prisma.mediaItem.update({
                                where: { id: newItem!.id },
                                data: { status: "READY" }
                            });
                        }
                    })();
                }
            }



            return NextResponse.json({ success: true, message: "Upload Complete! 💓" });
        } // Close else if (mainFile)

    } catch (e: any) {
        console.error("💥 General API Error:", e);
        return NextResponse.json({ success: false, message: `Server Error: ${e.message}` }, { status: 500 });
    }
}

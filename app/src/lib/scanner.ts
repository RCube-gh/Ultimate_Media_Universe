import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { prisma } from './prisma';
import crypto from "crypto";

// 📂 Constants
const CACHE_DIR = path.join(process.cwd(), '.cache', 'thumbnails');

// 🧬 Types
export type PageMeta = {
    file: string; // Relative path from manga root
    w: number;
    h: number;
    size: number;
    index: number;
};

export type ScanResult = {
    success: boolean;
    pages: PageMeta[];
    totalSize: number;
    error?: string;
};

// 🛠️ Helper: Natural Sort
const naturalSort = (a: string, b: string) => {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

/**
 * 🕵️‍♀️ Scan a folder for images and register/update in DB
 */
export async function scanMangaFolder(absolutePath: string, title?: string): Promise<string> {
    try {
        console.log(`🌸 Moca is scanning: ${absolutePath}`);

        // 1. Get all images recursively
        console.log("📂 Searching for images...");
        const files = await getImagesRecursively(absolutePath);
        if (files.length === 0) {
            console.error("❌ No images found in directory!");
            throw new Error("No images found in this folder!");
        }
        console.log(`✅ Found ${files.length} images.`);

        // 2. Sort naturally
        files.sort((a, b) => naturalSort(a, b));

        // 3. Analyze images (Get Width/Height) parallelly
        console.log("📐 Analyzing image metadata...");
        let totalSize = 0;
        const pages: PageMeta[] = await Promise.all(
            files.map(async (file, index) => {
                const fullPath = path.join(absolutePath, file);
                const stats = await fs.stat(fullPath);

                // Safe metadata extraction
                let width = 0;
                let height = 0;
                try {
                    const metadata = await sharp(fullPath).metadata();
                    width = metadata.width || 0;
                    height = metadata.height || 0;
                } catch (e) {
                    console.warn(`⚠️ Failed to read metadata for ${file}, assuming 0x0`);
                }

                totalSize += stats.size;

                return {
                    file, // Relative path
                    w: width,
                    h: height,
                    size: stats.size,
                    index
                };
            })
        );

        // 4. Register to DB
        const folderName = path.basename(absolutePath);
        const finalTitle = title || folderName;

        // 🖼️ Construct Thumbnail Path from the first page
        let thumbnailPath: string | null = null;
        if (pages.length > 0) {
            try {
                // Normalize absolutePath to forward slashes for easier parsing
                const normalizedAbsPath = absolutePath.replaceAll('\\', '/');
                // Find position of "/library/" case-insensitive
                const libIndex = normalizedAbsPath.toLowerCase().lastIndexOf('/library/');

                if (libIndex !== -1) {
                    // Extract "manga/Title" -> /library/ is 9 chars
                    const relativeRoot = normalizedAbsPath.substring(libIndex + 9);
                    const firstPage = pages[0].file.replaceAll('\\', '/');

                    thumbnailPath = `/api/file/${relativeRoot}/${firstPage}`;
                    console.log("🖼️ Generated Thumbnail Path:", thumbnailPath);
                } else {
                    console.warn("⚠️ Could not find '/library/' in path for thumbnail generation:", normalizedAbsPath);
                }
            } catch (err) {
                console.error("⚠️ Error generating thumbnail path:", err);
            }
        }

        console.log("💾 Upserting to Database...");
        const item = await prisma.mediaItem.upsert({
            where: { filePath: absolutePath },
            update: {
                type: "MANGA",
                pages: pages.length,
                size: BigInt(totalSize),
                metadata: JSON.stringify({ pages }),
                isArchived: true,
                thumbnail: thumbnailPath,
            },
            create: {
                title: finalTitle,
                type: "MANGA",
                filePath: absolutePath,
                isArchived: true,
                pages: pages.length,
                size: BigInt(totalSize),
                metadata: JSON.stringify({ pages }),
                thumbnail: thumbnailPath,
            }
        });

        console.log(`✨ Registered to DB: ${item.title} (${pages.length} pages)`);

        // 5. Trigger Thumbnail Generation
        generateThumbnailCache(item.id, absolutePath, pages).catch(err => {
            console.error(`❌ Thumbnail generation failed for ${item.title}:`, err);
        });

        return item.id;

    } catch (error) {
        console.error("💥 Scanning failed in scanMangaFolder:", error);
        throw error;
    }
}

/**
 * 🎨 Generate lightweight thumbnails for ALL pages
 * Matching API logic: MD5 hash of absolute path -> [hash]_thumb.webp
 * Saved in a flat directory for easy lookup without ItemID
 */
export async function generateThumbnailCache(itemId: string, rootPath: string, pages: PageMeta[]) {
    // Shared cache root (Must match route.ts)
    const APP_ROOT = process.cwd();
    const THUMB_ROOT = path.join(APP_ROOT, ".cache", "thumbnails");

    await fs.mkdir(THUMB_ROOT, { recursive: true });

    // Process in chunks
    const CHUNK_SIZE = 5;
    for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
        const chunk = pages.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (page) => {
            const srcPath = path.join(rootPath, page.file);

            // Generate Hash (Must match route.ts logic!)
            const hash = crypto.createHash("md5").update(srcPath).digest("hex");
            const destPath = path.join(THUMB_ROOT, `${hash}_thumb.webp`);

            try {
                // Check if exists
                await fs.access(destPath);
                return;
            } catch {
                // Generate
                try {
                    await sharp(srcPath)
                        .resize({ height: 300, withoutEnlargement: true }) // Fixed height 300px
                        .webp({ quality: 75 })
                        .toFile(destPath);
                } catch (e) {
                    console.warn(`Failed to gen thumb for ${srcPath}`, e);
                }
            }
        }));
    }
}

// --- Internal Helpers ---

async function getImagesRecursively(dir: string, baseDir = ''): Promise<string[]> {
    let results: string[] = [];

    try {
        const list = await fs.readdir(dir, { withFileTypes: true });

        for (const dirent of list) {
            const relativePath = path.join(baseDir, dirent.name);
            const fullPath = path.join(dir, dirent.name);

            if (dirent.isDirectory()) {
                const subResults = await getImagesRecursively(fullPath, relativePath);
                results = results.concat(subResults);
            } else {
                if (/\.(jpg|jpeg|png|webp|avif|gif)$/i.test(dirent.name)) {
                    results.push(relativePath);
                }
            }
        }
    } catch (e) {
        console.error("Error reading directory:", dir, e);
    }
    return results;
}

/**
 * 🎧 Scan a folder for AUDIO content (ASMR, Voice Works)
 */
export async function scanAudioFolder(absolutePath: string, title?: string, customTrackTitles?: Record<string, string>): Promise<string> {
    try {
        console.log(`🎧 Moca is scanning AUDIO: ${absolutePath}`);

        // 1. Get all files
        console.log("📂 Searching for files...");
        const validExtensions = /\.(mp3|wav|ogg|m4a|flac|aac|wma|jpg|jpeg|png|webp|avif|gif)$/i;
        const allFiles = await getFilesRecursively(absolutePath, validExtensions);

        if (allFiles.length === 0) {
            throw new Error("No media files found in this folder!");
        }

        // 2. Separate Audio and Images
        const tracks: { file: string, size: number, index: number, title: string }[] = [];
        const images: PageMeta[] = [];
        let totalSize = 0;

        // Helper check
        const isAudio = (f: string) => /\.(mp3|wav|ogg|m4a|flac|aac|wma)$/i.test(f);
        const isImage = (f: string) => /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(f);

        // Sort globally first
        allFiles.sort((a, b) => naturalSort(a, b));

        let trackIndex = 0;
        let imageIndex = 0;

        for (const file of allFiles) {
            const fullPath = path.join(absolutePath, file);
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;

            if (isAudio(file)) {
                let trackTitle = path.basename(file, path.extname(file)); // Default to filename
                try {
                    const { parseFile } = await import('music-metadata');
                    const metadata = await parseFile(fullPath);
                    if (metadata.common.title) {
                        trackTitle = metadata.common.title;
                    }
                } catch (e) {
                    console.warn(`⚠️ Failed to parse metadata for ${file}`, e);
                }

                // 🌟 Apply Custom Title Override
                const normalizedKey = file.replaceAll('\\', '/');
                if (customTrackTitles && customTrackTitles[normalizedKey]) {
                    trackTitle = customTrackTitles[normalizedKey];
                    // console.log(`✏️ Applied custom title for ${file}: ${trackTitle}`);
                }

                tracks.push({
                    file, // Relative path
                    title: trackTitle,
                    size: stats.size,
                    index: trackIndex++
                });
            } else if (isImage(file)) {
                // Get Image Metadata
                let width = 0;
                let height = 0;
                try {
                    const metadata = await sharp(fullPath).metadata();
                    width = metadata.width || 0;
                    height = metadata.height || 0;
                } catch (e) {
                    console.warn(`⚠️ Failed to read metadata for ${file}, assuming 0x0`);
                }

                images.push({
                    file,
                    w: width,
                    h: height,
                    size: stats.size,
                    index: imageIndex++
                });
            }
        }

        console.log(`✅ Found ${tracks.length} tracks and ${images.length} images.`);

        if (tracks.length === 0) {
            console.warn("⚠️ No audio tracks found, but registering as AUDIO anyway (might be images only?)");
        }

        // 3. Register to DB
        const folderName = path.basename(absolutePath);
        const finalTitle = title || folderName;

        // 🖼️ Construct Thumbnail Path
        // Priority: "cover", "front", "folder" -> then first image
        let thumbnailPath: string | null = null;
        if (images.length > 0) {
            let coverImage = images.find(img => {
                const lower = path.basename(img.file).toLowerCase();
                return lower.includes("cover") || lower.includes("front") || lower.includes("folder") || lower.includes("main");
            });

            if (!coverImage) {
                coverImage = images[0]; // Fallback to first image
            }

            try {
                const normalizedAbsPath = absolutePath.replaceAll('\\', '/');
                const libIndex = normalizedAbsPath.toLowerCase().lastIndexOf('/library/');

                if (libIndex !== -1) {
                    const relativeRoot = normalizedAbsPath.substring(libIndex + 9);
                    const thumbFile = coverImage.file.replaceAll('\\', '/');
                    thumbnailPath = `/api/file/${relativeRoot}/${thumbFile}`;
                }
            } catch (err) {
                console.error("⚠️ Error generating thumbnail path:", err);
            }
        }

        // Store both in metadata
        const metadata = {
            tracks,
            images
        };

        console.log("💾 Upserting to Database...");
        const item = await prisma.mediaItem.upsert({
            where: { filePath: absolutePath },
            update: {
                type: "AUDIO",
                pages: images.length,
                size: BigInt(totalSize),
                metadata: JSON.stringify(metadata),
                isArchived: true,
                thumbnail: thumbnailPath,
            },
            create: {
                title: finalTitle,
                type: "AUDIO",
                filePath: absolutePath,
                isArchived: true,
                pages: images.length,
                size: BigInt(totalSize),
                metadata: JSON.stringify(metadata),
                thumbnail: thumbnailPath,
            }
        });

        console.log(`✨ Registered AUDIO to DB: ${item.title} (${tracks.length} tracks, ${images.length} images)`);

        // 4. Trigger Thumbnail Generation (Only for images)
        if (images.length > 0) {
            generateThumbnailCache(item.id, absolutePath, images).catch(err => {
                console.error(`❌ Thumbnail generation failed for ${item.title}:`, err);
            });
        }

        return item.id;

    } catch (error) {
        console.error("💥 Scanning failed in scanAudioFolder:", error);
        throw error;
    }
}

async function getFilesRecursively(dir: string, pattern: RegExp, baseDir = ''): Promise<string[]> {
    let results: string[] = [];
    try {
        const list = await fs.readdir(dir, { withFileTypes: true });
        for (const dirent of list) {
            const relativePath = path.join(baseDir, dirent.name);
            const fullPath = path.join(dir, dirent.name);

            if (dirent.isDirectory()) {
                const subResults = await getFilesRecursively(fullPath, pattern, relativePath);
                results = results.concat(subResults);
            } else {
                if (pattern.test(dirent.name)) {
                    results.push(relativePath);
                }
            }
        }
    } catch (e) {
        console.error("Error reading directory:", dir, e);
    }
    return results;
}

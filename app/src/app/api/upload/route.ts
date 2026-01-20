import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import AdmZip from "adm-zip";
import { scanMangaFolder } from "@/lib/scanner"; // 1. Static Import

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

export async function POST(req: NextRequest) {
    console.log("🔥 [API] Upload Request Received");

    try {
        const formData = await req.formData();

        const url = formData.get("url") as string;
        const title = formData.get("title") as string;
        const type = formData.get("type") as string;
        const description = formData.get("description") as string;

        const thumbnailFile = formData.get("thumbnailFile") as File | null;
        const mainFile = formData.get("mainFile") as File | null;

        if (!title || !type) {
            return NextResponse.json({ success: false, message: "Title and Type are required!" }, { status: 400 });
        }

        const projectRoot = join(process.cwd(), "..");
        const libraryDir = join(projectRoot, "library");
        const uploadDir = join(libraryDir, "uploads");
        const thumbDir = join(libraryDir, "thumbnails");

        await mkdir(uploadDir, { recursive: true });
        await mkdir(thumbDir, { recursive: true });

        let thumbnailPath: string | null = null;
        let filePath: string | null = null;
        let isArchived = false;
        let duration: number | null = null;

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
        if (type === "MANGA") {
            const uploadedFile = mainFile;
            if (uploadedFile && uploadedFile.size > 0) {
                console.log(`📚 Processing MANGA ZIP Upload: ${uploadedFile.name}`);

                const safeTitle = title.replace(/[^a-zA-Z0-9.\-_]/g, "_");
                let mangaDir = join(libraryDir, "manga", safeTitle);
                let finalTitle = title;

                // 🛡️ Safety Check: If folder exists, append timestamp to make it unique
                try {
                    await mkdir(mangaDir); // Try creating. If fails (exists), it throws EEXIST
                } catch (e: any) {
                    if (e.code === 'EEXIST') {
                        console.log("⚠️ Folder exists, preventing overwrite by creating unique path.");
                        const timestamp = Date.now();
                        finalTitle = `${title} (${timestamp})`;
                        const safeUnique = `${safeTitle}_${timestamp}`;
                        mangaDir = join(libraryDir, "manga", safeUnique);
                        await mkdir(mangaDir, { recursive: true });
                    } else {
                        throw e; // Real error
                    }
                }

                const bytes = await uploadedFile.arrayBuffer();
                const buffer = Buffer.from(bytes);

                // Save ZIP for backup? or just discard? Let's save just in case for now.
                // Or maybe we DON'T check file lock if we use buffer directly for unzip.
                const tempZipPath = join(uploadDir, `${Date.now()}_temp_${safeTitle}.zip`);
                await writeFile(tempZipPath, buffer);

                console.log("🔓 Extracting ZIP (from Buffer)...");
                try {
                    // 2. Use Buffer directly to avoid File Lock issues!
                    const zip = new AdmZip(buffer);
                    zip.extractAllTo(mangaDir, true);
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
                    // Directly call imported function
                    const itemId = await scanMangaFolder(mangaDir, finalTitle);

                    if (sourceUrl) {
                        await prisma.mediaItem.update({
                            where: { id: itemId },
                            data: { url: sourceUrl, description: description }
                        });
                    }

                    console.log("✅ Manga Registered via Scanner:", itemId);
                    return NextResponse.json({ success: true, message: "Manga Uploaded & Scanned! 📚", itemId });

                } catch (scanErr: any) {
                    console.error("❌ Scan Failed:", scanErr);
                    return NextResponse.json({
                        success: false,
                        message: `Scanner Failed: ${scanErr.message}`
                    }, { status: 500 });
                }

            } else {
                return NextResponse.json({ success: false, message: "No ZIP file provided for Manga." }, { status: 400 });
            }

        } else if (mainFile && mainFile.size > 0 && mainFile.name !== "undefined") {
            // Video / Audio / Image
            console.log("🚚 Processing Main File Upload...");
            const bytes = await mainFile.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const safeName = mainFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
            const fileName = `${Date.now()}_file_${safeName}`;
            const savePath = join(uploadDir, fileName);

            await writeFile(savePath, buffer);
            filePath = `/api/file/uploads/${fileName}`;
            isArchived = true;

            if (type === "VIDEO") {
                duration = await getVideoDuration(savePath);
            }
        }

        // DB Create for Non-Manga
        if (type !== "MANGA") {
            const newItem = await prisma.mediaItem.create({
                data: {
                    title,
                    url: url || null,
                    type,
                    description,
                    isArchived,
                    filePath,
                    thumbnail: thumbnailPath,
                    size: mainFile ? BigInt(mainFile.size) : null,
                    duration,
                },
            });
            console.log("✅ Success! Item ID:", newItem.id);
        }

        return NextResponse.json({ success: true, message: "Upload Complete! 💓" });

    } catch (e: any) {
        console.error("💥 General API Error:", e);
        return NextResponse.json({ success: false, message: `Server Error: ${e.message}` }, { status: 500 });
    }
}

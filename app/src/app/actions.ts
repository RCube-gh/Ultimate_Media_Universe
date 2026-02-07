"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir, rmdir } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import AdmZip from "adm-zip";

const execAsync = promisify(exec);

// 📝 登録フォームから受け取るデータの型
interface AddItemState {
    message: string;
    success: boolean;
}

// 🕵️‍♀️ Helper: Get Video Duration using ffprobe
async function getVideoDuration(filePath: string): Promise<number | null> {
    try {
        console.log("🕵️‍♀️ Probing video duration:", filePath);
        // ffprobeでJSON形式でメタデータを取得
        const { stdout } = await execAsync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
        );
        const duration = parseFloat(stdout.trim());
        if (!isNaN(duration)) {
            console.log("⏱️ Duration found:", duration);
            return Math.floor(duration); // 秒単位の整数で返す
        }
    } catch (error) {
        console.error("💥 ffprobe failed:", error);
    }
    return null;
}

export async function addMediaItem(prevState: AddItemState, formData: FormData): Promise<AddItemState> {
    console.log("🔥 [Server Action] Function called!");

    try {
        const url = formData.get("url") as string;
        // Sanitization for Title to be folder-safe if needed, but we use safeTitle later
        const title = formData.get("title") as string;
        const description = formData.get("description") as string;

        // 📁 Files
        const thumbnailFile = formData.get("thumbnailFile") as File | null;
        const mainFile = formData.get("mainFile") as File | null;

        // Sanitize Type
        const rawType = formData.get("type") as string;
        if (!title || !rawType) {
            return { success: false, message: "Title and Type are required!" };
        }
        const type = rawType.trim().toUpperCase();

        // 📂 Ensure directories exist outside of app for Docker compatibility
        // Path: /library (Parent of app)
        // Path: app/library (Parent of app if local, but in Docker it is mounted at /app/library)
        // Check Dockerfile CMD: WORKDIR /app
        // So process.cwd() is /app
        const projectRoot = process.cwd();
        const libraryDir = join(projectRoot, "library");

        const uploadDir = join(libraryDir, "uploads");
        const thumbDir = join(libraryDir, "thumbnails");

        await mkdir(uploadDir, { recursive: true });
        await mkdir(thumbDir, { recursive: true });

        let thumbnailPath: string | null = null;
        let filePath: string | null = null;
        let isArchived = false;
        let duration: number | null = null;

        // 1️⃣ Process Thumbnail (Common for all types)
        if (thumbnailFile && thumbnailFile.size > 0 && thumbnailFile.name !== "undefined") {
            const bytes = await thumbnailFile.arrayBuffer();
            const buffer = Buffer.from(bytes);
            const safeName = thumbnailFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
            const fileName = `${Date.now()}_thumb_${safeName}`;
            const savePath = join(thumbDir, fileName);

            await writeFile(savePath, buffer);
            // Public path needs to be served via API
            thumbnailPath = `/api/file/thumbnails/${fileName}`;
        }

        // 2️⃣ Process Main Content
        // Logic branches based on TYPE
        const isZip = mainFile && mainFile.name.toLowerCase().endsWith(".zip");

        console.log("🔍 Debug Upload Logic:", {
            type,
            fileName: mainFile?.name,
            isZip,
            paramMatch: type === "MANGA" || type === "AUDIO"
        });

        if ((type === "MANGA" || type === "AUDIO") && isZip) {
            // Expecting a Single ZIP File: Extract and Scan
            const uploadedFile = mainFile;

            if (uploadedFile && uploadedFile.size > 0) {
                const isManga = type === "MANGA";
                const label = isManga ? "MANGA" : "AUDIO";
                const targetDirName = isManga ? "manga" : "audio";

                console.log(`📚 Processing ${label} ZIP Upload: ${uploadedFile.name}`);

                // 📁 Create localized folder: ../library/[type]/[Title]
                const safeTitle = title.replace(/[^a-zA-Z0-9.\-_]/g, "_");
                const itemDir = join(libraryDir, targetDirName, safeTitle);

                // Clear directory if exists to avoid mixing or ensure clean state? 
                // Just recursive create for now.
                await mkdir(itemDir, { recursive: true });

                // 📦 Save ZIP temporarily
                const bytes = await uploadedFile.arrayBuffer();
                const buffer = Buffer.from(bytes);
                const tempZipPath = join(uploadDir, `${Date.now()}_temp_${safeTitle}.zip`);
                await writeFile(tempZipPath, buffer);

                // 🔓 Extract ZIP
                console.log("🔓 Extracting ZIP...");
                try {
                    const zip = new AdmZip(tempZipPath);
                    zip.extractAllTo(itemDir, true); // overwrite = true
                    console.log("✅ Extraction complete!");

                    // Cleanup ZIP (Future: unlink)
                } catch (err) {
                    console.error("❌ ZIP Extraction Failed:", err);
                    return { success: false, message: "Failed to extract ZIP file!" };
                }

                // 🕵️‍♀️ Scan & Register 
                const sourceUrl = formData.get("source_url") as string;
                /* Note: Dynamic import to avoid circular dependencies if any */
                const { scanMangaFolder, scanAudioFolder } = await import("@/lib/scanner");

                let itemId = "";
                if (isManga) {
                    itemId = await scanMangaFolder(itemDir, title);
                } else {
                    itemId = await scanAudioFolder(itemDir, title);
                }

                // Update URL if exists (Patch)
                if (sourceUrl) {
                    await prisma.mediaItem.update({
                        where: { id: itemId },
                        data: { url: sourceUrl, description: description }
                    });
                }

                console.log(`✅ ${label} Registered via Scanner:`, itemId);
                revalidatePath("/");
                return { success: true, message: `${label} Uploaded & Scanned! 🎵` };
            } else {
                return { success: false, message: `No ${type} ZIP file found!` };
            }

        } else if (mainFile && mainFile.size > 0 && mainFile.name !== "undefined") {
            // ... (Existing Video/Audio/Image Logic) ...
            console.log("🚚 Processing Main File Upload...");

            const bytes = await mainFile.arrayBuffer();
            const buffer = Buffer.from(bytes);

            const safeName = mainFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
            const fileName = `${Date.now()}_file_${safeName}`;
            const savePath = join(uploadDir, fileName);

            await writeFile(savePath, buffer);
            console.log("💾 Main File saved to:", savePath);

            filePath = `/api/file/uploads/${fileName}`;
            isArchived = true;

            // 🕵️‍♀️ 解析: 動画なら長さを取得！
            if (type === "VIDEO") {
                duration = await getVideoDuration(savePath);
            }
        }

        // 🛠️ Creating Database Record (FOR NON-MANGA ITEMS)
        console.log("🛠️ Creating Database Record...");
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

        revalidatePath("/videos");
        revalidatePath("/links");
        revalidatePath("/");

        return { success: true, message: "Upload Complete! 💓" };
    } catch (e) {
        console.error("💥 FAILED to upload/register:", e);
        return { success: false, message: "Failed to upload... 😭" };
    }
}

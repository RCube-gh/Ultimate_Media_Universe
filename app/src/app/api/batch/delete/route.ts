import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import { join } from "path";

export async function POST(req: NextRequest) {
    try {
        const { ids } = await req.json();

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ success: false, message: "No IDs provided" }, { status: 400 });
        }

        console.log(`🗑️ Batch Delete Requested for ${ids.length} items.`);

        // 1. Fetch items to get file paths before deleting
        const items = await prisma.mediaItem.findMany({
            where: { id: { in: ids } },
            select: { id: true, filePath: true, thumbnail: true }
        });

        // 2. Delete files from disk (Best effort)
        const PROCESS_ROOT = process.cwd();

        await Promise.all(items.map(async (item) => {
            // Delete Main File
            if (item.filePath) {
                try {
                    // Assuming filePath starts with /api/file/uploads/ or similar, we need to resolve it to absolute path
                    // Actually, let's assume standard structure: public/ or uploads/
                    // Currently filePath is stored as web path e.g. "/api/file/uploads/..."
                    // We need to map it back to system path.
                    // Based on previous upload logic: 
                    // filePath = `/api/file/uploads/${fileName}`;
                    // Directory is `data/uploads` usually maped in next.config or served via API.

                    // Wait, usually we serve via API route reading from specific dir.
                    // Let's resolve relative to Process Root if possible, or just skip if too complex for safety.
                    // BUT, to free space we MUST delete.

                    // Let's rely on Prisma delete clearly, and try to delete common file locations.
                    // In `upload/route.ts`: const uploadDir = join(process.cwd(), "data", "uploads");

                    const fileName = item.filePath.split('/').pop();
                    if (fileName) {
                        const systemPath = join(PROCESS_ROOT, "data", "uploads", fileName);
                        await unlink(systemPath).catch(() => console.warn(`Failed to delete file: ${systemPath}`));
                    }
                } catch (e) { console.error(e); }
            }

            // Delete Thumbnail (if local)
            if (item.thumbnail && item.thumbnail.includes("/thumbnails/")) {
                try {
                    const thumbName = item.thumbnail.split('/').pop();
                    if (thumbName) {
                        const thumbPath = join(PROCESS_ROOT, "data", "thumbnails", thumbName);
                        await unlink(thumbPath).catch(() => console.warn(`Failed to delete thumb: ${thumbPath}`));
                    }
                } catch (e) { console.error(e); }
            }
        }));

        // 3. Delete DB Records
        const result = await prisma.mediaItem.deleteMany({
            where: { id: { in: ids } }
        });

        return NextResponse.json({
            success: true,
            message: `Successfully deleted ${result.count} items.`,
            count: result.count
        });

    } catch (e: any) {
        console.error("💥 Batch Delete Error:", e);
        return NextResponse.json({ success: false, message: e.message }, { status: 500 });
    }
}

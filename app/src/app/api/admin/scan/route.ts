import { NextResponse } from "next/server";
import { join } from "path";
import { readdir, stat } from "fs/promises";
import { scanMangaFolder, scanAudioFolder } from "@/lib/scanner";

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        console.log("🕵️‍♀️ Starting Library Scan...");
        const libraryRoot = join(process.cwd(), "library");
        const results: string[] = [];

        // 1. Scan Manga
        const mangaRoot = join(libraryRoot, "manga");
        try {
            const mangaDirs = await readdir(mangaRoot);
            for (const dir of mangaDirs) {
                const fullPath = join(mangaRoot, dir);
                if ((await stat(fullPath)).isDirectory()) {
                    try {
                        await scanMangaFolder(fullPath);
                        results.push(`✅ Manga: ${dir}`);
                    } catch (e) {
                        console.error(`Failed to scan manga ${dir}`, e);
                        results.push(`❌ Manga Error: ${dir}`);
                    }
                }
            }
        } catch (e) {
            console.warn("Manga directory not found or empty", e);
        }

        // 2. Scan Audio
        const audioRoot = join(libraryRoot, "audio");
        try {
            const audioDirs = await readdir(audioRoot);
            for (const dir of audioDirs) {
                const fullPath = join(audioRoot, dir);
                if ((await stat(fullPath)).isDirectory()) {
                    try {
                        await scanAudioFolder(fullPath);
                        results.push(`✅ Audio: ${dir}`);
                    } catch (e) {
                        console.error(`Failed to scan audio ${dir}`, e);
                        results.push(`❌ Audio Error: ${dir}`);
                    }
                }
            }
        } catch (e) {
            console.warn("Audio directory not found or empty", e);
        }

        return NextResponse.json({ success: true, logs: results });
    } catch (e: any) {
        console.error("Scan failed", e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

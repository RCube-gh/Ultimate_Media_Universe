
// Use tsx to run this: npx tsx scripts/debug-scanner.ts
import { scanMangaFolder } from "../src/lib/scanner";
import path from "path";
import fs from "fs/promises";

async function main() {
    console.log("🐛 Starting Debug Scan...");

    // Path to the manually created folder
    // Adjust relative path carefully. We are in app/scripts (virtually) but running from app root usually.
    // Let's assume we run from app root.
    const projectRoot = process.cwd();
    const mockMangaDir = path.join(projectRoot, "../library/manga/debug-test");

    console.log(`📂 Target Dir: ${mockMangaDir}`);

    try {
        // Create a dummy text file pretending to be an image to see if it even finding files
        // Wait, scanner filters extension. Let's make a real 0 byte file with jpg extension.
        // Sharp will fail on it, but that proves scanner is running!
        await fs.mkdir(mockMangaDir, { recursive: true });
        await fs.writeFile(path.join(mockMangaDir, "01.jpg"), "fake image content");

        const result = await scanMangaFolder(mockMangaDir, "Debug Manga Title");
        console.log("✅ Scan Success! ID:", result);
    } catch (e) {
        console.error("💥 Scan Failed!");
        console.error(e);
    }
}

main();

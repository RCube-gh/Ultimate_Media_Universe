import { prisma } from '../src/lib/prisma';
import { scanAudioFolder } from '../src/lib/scanner';
import fs from 'fs';

async function main() {
    console.log("🌸 Starting Audio Duration Fix...");

    // 1. Get all AUDIO items
    const audioItems = await prisma.mediaItem.findMany({
        where: { type: "AUDIO" }
    });

    console.log(`📂 Found ${audioItems.length} audio items to check.`);

    let successCount = 0;
    let failCount = 0;

    for (const item of audioItems) {
        if (!item.filePath) {
            console.warn(`⚠️ Skipping item without path: ${item.title} (${item.id})`);
            continue;
        }

        console.log(`\n🎧 Processing: ${item.title}`);

        try {
            // Verify path exists
            if (!fs.existsSync(item.filePath)) {
                console.error(`❌ Path not found: ${item.filePath}`);
                failCount++;
                continue;
            }

            // Rescan using the updated logic
            // providing the current title to preserve it
            // providing undefined for customTrackTitles for now
            await scanAudioFolder(item.filePath, item.title, undefined);

            console.log(`✅ Fixed!`);
            successCount++;
        } catch (e) {
            console.error(`💥 Failed to fix ${item.title}:`, e);
            failCount++;
        }
    }

    console.log(`\n✨ Finished!`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const item = await prisma.mediaItem.findFirst({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                title: true, // "たいとる"
                type: true, // "AUDIO"
                filePath: true,
                metadata: true
            }
        });

        // Parse metadata if it's a string to ensure it's a valid JSON structure in the output
        if (item && typeof item.metadata === 'string') {
            try {
                item.metadata = JSON.parse(item.metadata);
            } catch (e) {
                // If parsing fails, keep it as a string or handle the error as appropriate
                console.error("Failed to parse metadata string:", e);
            }
        }

        return NextResponse.json(item);
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

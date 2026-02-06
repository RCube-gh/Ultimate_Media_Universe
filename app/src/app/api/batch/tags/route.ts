import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const { ids, action, tags } = await req.json();

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ success: false, message: "No IDs provided" }, { status: 400 });
        }
        if (!Array.isArray(tags) || tags.length === 0) {
            return NextResponse.json({ success: false, message: "No tags provided" }, { status: 400 });
        }

        console.log(`🏷️ Batch Tag ${action}: ${tags.join(", ")} for ${ids.length} items`);

        // 1. Ensure tags exist (Upsert logic mostly for "add")
        // Get tag IDs first
        const tagRecords = await Promise.all(
            tags.map(tagName =>
                prisma.tag.upsert({
                    where: { name: tagName },
                    update: {},
                    create: { name: tagName }
                })
            )
        );
        const tagIds = tagRecords.map(t => t.id);

        if (action === "add") {
            // Add tags to all items
            // Prisma doesn't support "connectMany" for many-to-many in updateMany nicely.
            // We have to iterate or use a raw query, or precise efficient transaction.
            // Transaction loop is safe enough for reasonable batch sizes.

            await prisma.$transaction(
                ids.map((itemId: string) =>
                    prisma.mediaItem.update({
                        where: { id: itemId },
                        data: {
                            tags: {
                                connect: tagIds.map(id => ({ id }))
                            }
                        }
                    })
                )
            );
        } else if (action === "remove") {
            // Remove tags from items
            await prisma.$transaction(
                ids.map((itemId: string) =>
                    prisma.mediaItem.update({
                        where: { id: itemId },
                        data: {
                            tags: {
                                disconnect: tagIds.map(id => ({ id }))
                            }
                        }
                    })
                )
            );
        } else {
            return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: `Updated tags for ${ids.length} items.` });

    } catch (e: any) {
        console.error("💥 Batch Tag Error:", e);
        return NextResponse.json({ success: false, message: e.message }, { status: 500 });
    }
}

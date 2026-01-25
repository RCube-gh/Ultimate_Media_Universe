import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const id = params.id;

        await prisma.mediaItem.update({
            where: { id },
            data: { viewCount: { increment: 1 } },
            select: { id: true, viewCount: true },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to count view" }, { status: 500 });
    }
}

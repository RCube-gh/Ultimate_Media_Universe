import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const id = params.id;
        const body = await request.json();
        const { type } = body;

        if (type === "like") {
            // Using 'rating' as a Like counter for simplicity
            const updated = await prisma.mediaItem.update({
                where: { id },
                data: { rating: { increment: 1 } },
                select: { id: true, rating: true, isFavorite: true },
            });
            return NextResponse.json(updated);
        }

        if (type === "favorite") {
            // Toggle Logic: 1. Get current 2. Update inverse
            const current = await prisma.mediaItem.findUnique({
                where: { id },
                select: { isFavorite: true }
            });

            if (!current) return NextResponse.json({ error: "Item not found" }, { status: 404 });

            const updated = await prisma.mediaItem.update({
                where: { id },
                data: { isFavorite: !current.isFavorite },
                select: { id: true, rating: true, isFavorite: true },
            });
            return NextResponse.json(updated);
        }

        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    } catch (error) {
        console.error("Interaction failed:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

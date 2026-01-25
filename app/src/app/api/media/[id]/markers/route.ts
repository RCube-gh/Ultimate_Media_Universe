import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Fetch markers for a specific MediaItem
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const id = params.id;
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        const markers = await prisma.marker.findMany({
            where: { itemId: id },
            orderBy: { time: "asc" },
        });

        return NextResponse.json(markers);
    } catch (error) {
        console.error("Failed to fetch markers:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// POST: Add a new marker
export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const id = params.id;
        const body = await request.json();
        const { time, label, icon } = body;

        if (time === undefined) {
            return NextResponse.json({ error: "Time is required" }, { status: 400 });
        }

        const marker = await prisma.marker.create({
            data: {
                itemId: id,
                time: Number(time),
                label: label || "",
                icon: icon || "📍",
            },
        });

        return NextResponse.json(marker);
    } catch (error) {
        console.error("Failed to create marker:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

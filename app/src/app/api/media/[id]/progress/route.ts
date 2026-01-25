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
        const { time } = body;

        if (typeof time !== "number") {
            return NextResponse.json({ error: "Time is required" }, { status: 400 });
        }

        const updated = await prisma.mediaItem.update({
            where: { id },
            data: { lastPos: time },
            select: { id: true, lastPos: true }, // Select only specific fields to avoid BigInt serialization issues with 'size'
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Failed to save progress:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

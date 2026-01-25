import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const id = params.id;
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        await prisma.marker.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete marker:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/settings
export async function GET() {
    try {
        let settings = await prisma.userSettings.findUnique({
            where: { id: "default" },
        });

        // Create default settings if they don't exist
        if (!settings) {
            settings = await prisma.userSettings.create({
                data: { id: "default" },
            });
        }

        return NextResponse.json(settings);
    } catch (error) {
        console.error("Failed to fetch settings:", error);
        return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
    }
}

// PUT /api/settings
export async function PUT(req: Request) {
    try {
        const body = await req.json();

        const settings = await prisma.userSettings.upsert({
            where: { id: "default" },
            update: body,
            create: { id: "default", ...body },
        });

        return NextResponse.json(settings);
    } catch (error) {
        console.error("Failed to update settings:", error);
        return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import axios from "axios";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        const item = await prisma.mediaItem.findUnique({
            where: { id },
            select: { thumbnail: true, type: true }
        });

        if (!item || !item.thumbnail) {
            return new NextResponse("Not Found", { status: 404 });
        }

        // If it's a local file path (starts with /api/file/...)
        if (item.thumbnail.startsWith("/api/file")) {
            // Forward to the file API locally
            // Construct full URL or redirect? Redirect is easier.
            const url = new URL(req.url); // Use request origin
            return NextResponse.redirect(`${url.origin}${item.thumbnail}`);
        }

        // If it's a remote URL (http...)
        if (item.thumbnail.startsWith("http")) {
            // Proxy the image to avoid Mixed Content & Hotlinking issues
            try {
                const response = await axios.get(item.thumbnail, {
                    responseType: 'arraybuffer',
                    timeout: 5000
                });

                return new NextResponse(response.data, {
                    status: 200,
                    headers: {
                        'Content-Type': response.headers['content-type'] || 'image/jpeg',
                        'Cache-Control': 'public, max-age=86400'
                    }
                });
            } catch (err) {
                console.error(`Failed to proxy image: ${item.thumbnail}`, err);
                // Fallback to redirect if proxy fails
                return NextResponse.redirect(item.thumbnail);
            }
        }

        return new NextResponse("Invalid thumbnail path", { status: 400 });

    } catch (e: any) {
        console.error("Image proxy failed", e);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}


import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const data = await request.json();

        // Prepare update object
        const updateData: any = {};

        if (typeof data.title === 'string') updateData.title = data.title;
        if (typeof data.description === 'string') updateData.description = data.description;
        if (typeof data.rating === 'number') updateData.rating = data.rating;
        if (typeof data.isFavorite === 'boolean') updateData.isFavorite = data.isFavorite;
        if (typeof data.url === 'string') updateData.url = data.url;

        // Handle Tags
        // Expecting data.tags to be an array of tag names ["tag1", "tag2"]
        if (Array.isArray(data.tags)) {
            updateData.tags = {
                set: [], // Disconnect all currently connected
                connectOrCreate: data.tags.map((tagName: string) => ({
                    where: { name: tagName },
                    create: { name: tagName },
                })),
            };
        }

        const updatedItem = await prisma.mediaItem.update({
            where: { id },
            data: updateData,
            include: {
                tags: true,
            },
        });

        return NextResponse.json(updatedItem);
    } catch (error) {
        console.error("Error updating media item:", error);
        return NextResponse.json({ error: "Failed to update media item" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await prisma.mediaItem.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting media item:", error);
        return NextResponse.json({ error: "Failed to delete media item" }, { status: 500 });
    }
}

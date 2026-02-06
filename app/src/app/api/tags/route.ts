
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const tags = await prisma.tag.findMany({
            orderBy: {
                name: 'asc'
            },
            include: {
                _count: {
                    select: { items: true }
                }
            }
        });
        return NextResponse.json(tags);
    } catch (error) {
        console.error("Error fetching tags:", error);
        return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { name } = await request.json();

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: "Invalid tag name" }, { status: 400 });
        }

        const tag = await prisma.tag.upsert({
            where: { name },
            update: {},
            create: { name }
        });

        return NextResponse.json(tag);
    } catch (error) {
        console.error("Error creating tag:", error);
        return NextResponse.json({ error: "Failed to create tag" }, { status: 500 });
    }
}

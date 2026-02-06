import { prisma } from "@/lib/prisma";
import { Film } from "lucide-react";
import { VideoGallery } from "@/components/VideoGallery";

export const dynamic = "force-dynamic";

type Props = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function VideosPage({ searchParams }: Props) {
    const { q } = await searchParams;
    const query = typeof q === 'string' ? q : undefined;

    const where: any = { type: "VIDEO" };

    if (query) {
        where.OR = [
            { title: { contains: query } },
            { description: { contains: query } },
            { tags: { some: { name: { contains: query } } } }
        ];
    }

    // 🎥 ビデオだけ取得！
    const videos = await prisma.mediaItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { tags: true },
    });

    return (
        <div className="p-8">
            <header className="mb-8 pl-2">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <span className="p-2 bg-pink-500/10 rounded-lg text-pink-500">
                        <Film size={32} />
                    </span>
                    Video Library
                </h1>
                <p className="text-zinc-500 mt-2">
                    Your personal collection of videos.
                </p>
            </header>

            <VideoGallery items={videos as any} />
        </div>
    );
}

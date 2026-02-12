import { prisma } from "@/lib/prisma";
import { Film } from "lucide-react";
import { VideoGallery } from "@/components/VideoGallery";

export const dynamic = "force-dynamic";

type Props = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function VideosPage({ searchParams }: Props) {
    const { q, sort } = await searchParams;
    const query = typeof q === 'string' ? q : undefined;
    const sortType = typeof sort === 'string' ? sort : "latest";

    const where: any = { type: "VIDEO" };

    if (query) {
        where.OR = [
            { title: { contains: query } },
            { description: { contains: query } },
            { tags: { some: { name: { contains: query } } } }
        ];
    }

    // 🎥 ビデオだけ取得！
    let videos = await prisma.mediaItem.findMany({
        where,
        // Remove standard orderBy here to allow custom sort
        include: {
            tags: true,
            _count: { select: { markers: true } } // Fetch marker count for "Fetish Rank"
        },
    });

    // 🧠 Moca's Sort Logic
    videos = videos.sort((a, b) => {
        switch (sortType) {
            case "oldest":
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            case "popular":
                return (b.viewCount || 0) - (a.viewCount || 0);
            case "rating":
                return (b.rating || 0) - (a.rating || 0);
            case "fetish": // 💦 Most Markers
                return ((b as any)._count?.markers || 0) - ((a as any)._count?.markers || 0);
            case "longest":
                return (b.duration || 0) - (a.duration || 0);
            case "shortest":
                return (a.duration || 0) - (b.duration || 0);
            case "title":
                return a.title.localeCompare(b.title);
            case "title_desc":
                return b.title.localeCompare(a.title);
            case "latest":
            default:
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
    });

    return (
        <div className="p-8">
            <header className="mb-6 pl-2 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="p-2 bg-pink-500/10 rounded-lg text-pink-500">
                            <Film size={32} />
                        </span>
                        Video Library
                    </h1>
                    <p className="text-zinc-500 mt-2">
                        Your personal collection of videos.
                    </p>
                </div>
            </header>

            <VideoGallery items={videos as any} />
        </div>
    );
}

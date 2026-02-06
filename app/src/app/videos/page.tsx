import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Play, Film } from "lucide-react";

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

            {videos.length === 0 ? (
                <EmptyState query={query} />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {videos.map((item) => (
                        <VideoCard key={item.id} item={item} />
                    ))}
                </div>
            )}
        </div>
    );
}



function VideoCard({ item }: { item: any }) {
    return (
        <Link
            href={`/videos/${item.id}`} // 👈 Route to Player Page!
            className="group relative block bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-pink-500/50 hover:shadow-xl hover:shadow-pink-500/10 transition-all duration-300 transform hover:-translate-y-1"
        >
            {/* 🎥 Thumbnail Area */}
            <div className="aspect-video overflow-hidden bg-zinc-950 relative">
                {item.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-80 group-hover:opacity-100"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700 bg-zinc-900 group-hover:bg-zinc-800 transition-colors">
                        <Film size={48} />
                    </div>
                )}

                {/* ▶ Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-16 h-16 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-lg shadow-pink-600/40 transform scale-50 group-hover:scale-100 transition-transform duration-300">
                        <Play size={32} fill="currentColor" className="ml-1" />
                    </div>
                </div>

                {/* 🏷️ Type Badge (左上) */}
                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded border border-white/10 uppercase">
                    VIDEO
                </div>
            </div>

            {/* 📝 Info Area */}
            <div className="p-4 bg-zinc-900 flex flex-col gap-1">
                <div className="flex flex-wrap gap-1 mb-1">
                    {item.tags?.map((tag: any) => (
                        <span key={tag.id} className="text-[10px] text-pink-300 bg-pink-500/10 px-1.5 py-0.5 rounded border border-pink-500/10">
                            #{tag.name}
                        </span>
                    ))}
                </div>
                <h3 className="font-bold text-white text-lg line-clamp-1 group-hover:text-pink-400 transition-colors">
                    {item.title}
                </h3>
                <div className="flex items-center justify-between text-xs text-zinc-500 mt-2">
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>

                    {/* ⏱ 時間表示 (MM:SS) */}
                    <span className="flex items-center gap-1 font-mono text-zinc-400 bg-zinc-800/50 px-2 py-0.5 rounded border border-zinc-700">
                        {item.duration
                            ? `${Math.floor(item.duration / 60)}:${(item.duration % 60).toString().padStart(2, '0')}`
                            : "--:--"}
                    </span>
                </div>
            </div>
        </Link>
    );
}

function EmptyState({ query }: { query?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20">
            <Film size={64} className="opacity-20 mb-4" />
            <p className="text-xl font-medium">
                {query ? `No videos matching "${query}" found.` : "No Videos yet."}
            </p>
            {!query && (
                <Link
                    href="/upload"
                    className="mt-6 px-6 py-2 bg-zinc-800 hover:bg-pink-600 hover:text-white text-zinc-300 rounded-full font-medium transition-colors"
                >
                    Add Video
                </Link>
            )}
        </div>
    );
}

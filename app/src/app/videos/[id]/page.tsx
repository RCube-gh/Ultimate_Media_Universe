import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Calendar, Clock, Share2, List, Play, Eye } from "lucide-react";
import { VideoPlayer } from "@/components/VideoPlayer";
import { MediaInfo } from "@/components/MediaInfo";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Props = {
    params: Promise<{ id: string }>;
};

export default async function VideoPlayerPage(props: Props) {
    const params = await props.params;
    const { id } = params;

    // 1️⃣ Fetch current video
    const item = await prisma.mediaItem.findUnique({
        where: { id },
        include: { markers: true, tags: true },
    });

    if (!item) return notFound();

    // 2️⃣ Fetch "Recommended" (Up Next) - Exclude current, take 10 latest
    // 2️⃣ Fetch "Recommended" (Up Next)
    // 🏷️ Logic: Tags Match -> Shuffle -> Slice
    const tagIds = item.tags.map(t => t.id);

    // Primary: Match by tags
    let candidates = await prisma.mediaItem.findMany({
        where: {
            type: "VIDEO",
            id: { not: id },
            ...(tagIds.length > 0 ? {
                tags: { some: { id: { in: tagIds } } }
            } : {})
        },
        orderBy: { createdAt: "desc" },
        take: 20
    });

    // Fallback: If finding by tags returned too few, simple recent fetch
    if (candidates.length < 5) {
        const more = await prisma.mediaItem.findMany({
            where: {
                type: "VIDEO",
                id: { not: id, notIn: candidates.map(c => c.id) }
            },
            orderBy: { createdAt: "desc" },
            take: 10
        });
        candidates = [...candidates, ...more];
    }

    // 🔀 Shuffle and Limit
    const recommendations = candidates.sort(() => Math.random() - 0.5).slice(0, 10);

    let src = item.filePath || item.url;
    if (src?.startsWith("/")) src = `/umu${src}`;

    let poster = item.thumbnail;
    if (poster?.startsWith("/")) poster = `/umu${poster}`;

    if (!src) return <div className="p-8">No source found.</div>;

    return (
        <div className="min-h-screen bg-zinc-950 text-white overflow-y-auto custom-scrollbar">

            {/* 🧭 Top Nav REMOVED - Using Browser Back / Sidebar logic */}

            <div className="max-w-[1800px] mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">

                {/* =============================
            📺 LEFT COLUMN (Player & Meta) 
            lg: span 2, xl: span 3
           ============================= */}
                <div className="lg:col-span-2 xl:col-span-3 flex flex-col gap-4">

                    {/* ⚠️ Processing Alert */}
                    {(item as any).status === "PROCESSING" && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-4 rounded-xl flex items-center gap-3 animate-pulse">
                            <Clock className="animate-spin" />
                            <div>
                                <h3 className="font-bold">Processing Video...</h3>
                                <p className="text-sm opacity-80">We are generating thumbnails and previews. Some features may be unavailable.</p>
                            </div>
                        </div>
                    )}

                    {/* 🎞️ Player Container (Wrapper for Aspect Ratio) */}
                    <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl shadow-black border border-zinc-800 relative z-10">
                        <VideoPlayer
                            key={item.id}
                            id={item.id}
                            src={src}
                            poster={poster || undefined}
                            className="w-full h-full"
                            initialLastPos={(item as any).lastPos}
                            serverDuration={item.duration || 0}
                        />
                    </div>

                    {/* 📝 Metadata Block */}
                    <MediaInfo item={item as any} />

                </div>

                {/* =============================
            📑 RIGHT COLUMN (Sidebar)
            span 1
           ============================= */}
                <div className="flex flex-col gap-6">

                    {/* 📺 Up Next (Recommendations) */}
                    <div className="flex flex-col gap-3">
                        <h3 className="font-bold text-sm text-zinc-400 px-1">Up Next</h3>
                        {recommendations.map((rec) => (
                            <Link key={rec.id} href={`/videos/${rec.id}`} className="flex gap-2 group p-2 rounded-xl hover:bg-white/5 transition-colors">
                                {/* Thumb */}
                                <div className="w-40 aspect-video bg-zinc-900 rounded-lg overflow-hidden relative shrink-0">
                                    {rec.thumbnail && (
                                        <>
                                            <div
                                                className="absolute inset-0 bg-cover bg-center opacity-40 blur-md scale-110"
                                                style={{ backgroundImage: `url('${rec.thumbnail?.startsWith("/") ? `/umu${rec.thumbnail}` : rec.thumbnail}')` }}
                                            />
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={rec.thumbnail?.startsWith("/") ? `/umu${rec.thumbnail}` : rec.thumbnail} alt="" className="absolute inset-0 w-full h-full object-contain z-10 transition-transform duration-500 group-hover:scale-105" />
                                        </>
                                    )}
                                    <div className="absolute bottom-1 right-1 bg-black/80 text-[10px] font-bold px-1 rounded text-white z-20">
                                        {rec.duration ? `${Math.floor(rec.duration / 60)}:${(rec.duration % 60).toString().padStart(2, '0')}` : "VID"}
                                    </div>
                                </div>
                                {/* Info */}
                                <div className="flex flex-col gap-1 min-w-0">
                                    <h4 className="font-bold text-sm leading-tight line-clamp-2 text-white group-hover:text-pink-400 transition-colors">
                                        {rec.title}
                                    </h4>
                                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                                        <span className="flex items-center gap-1">
                                            <Eye className="w-3 h-3" />
                                            {rec.viewCount}
                                        </span>
                                        <span>•</span>
                                        <span>{new Date(rec.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                        {recommendations.length === 0 && (
                            <p className="text-xs text-zinc-600 px-2">No other videos found.</p>
                        )}
                    </div>

                </div>

            </div>
        </div>
    );
}

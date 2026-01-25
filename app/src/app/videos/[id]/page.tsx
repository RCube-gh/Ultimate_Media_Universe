import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Calendar, Clock, Share2, List, Play } from "lucide-react";
import { VideoPlayer } from "@/components/VideoPlayer";
import { VideoActions } from "@/components/VideoActions";
import { MarkerStats } from "@/components/MarkerStats";

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
        include: { markers: true },
    });

    if (!item) return notFound();

    // 2️⃣ Fetch "Recommended" (Up Next) - Exclude current, take 10 latest
    const recommendations = await prisma.mediaItem.findMany({
        where: {
            type: "VIDEO",
            id: { not: id }
        },
        orderBy: { createdAt: "desc" },
        take: 10
    });

    const src = item.filePath || item.url;
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

                    {/* 🎞️ Player Container (Wrapper for Aspect Ratio) */}
                    <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl shadow-black border border-zinc-800 relative z-10">
                        <VideoPlayer
                            id={item.id}
                            src={src}
                            poster={item.thumbnail || undefined}
                            className="w-full h-full"
                            initialLastPos={(item as any).lastPos}
                            serverDuration={item.duration || 0}
                        // Force HMR update 2
                        // Force HMR update 3 matches user timestamp 15:11
                        />
                    </div>

                    {/* 📝 Metadata Block */}
                    <div className="space-y-4">
                        <h1 className="text-2xl font-bold leading-tight line-clamp-2">{item.title}</h1>

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            {/* Stats */}
                            <div className="flex items-center gap-2 text-sm text-zinc-400">
                                <span className="text-white font-bold">{item.viewCount.toLocaleString()} views</span>
                                <span>•</span>
                                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                                <MarkerStats id={id} />
                            </div>

                            {/* Actions Toolbar */}
                            <VideoActions
                                id={id}
                                initialLikes={item.rating || 0}
                                initialIsFavorite={item.isFavorite}
                            />
                        </div>

                        {/* Description Box */}
                        <div className="bg-zinc-900/50 rounded-xl p-4 text-sm text-zinc-300 whitespace-pre-wrap hover:bg-zinc-900 transition-colors cursor-pointer">
                            <div className="flex gap-2 font-bold mb-2">
                                <span>{item.duration ? `${Math.floor(item.duration / 60)} min` : "Unknown duration"}</span>
                            </div>
                            {item.description || "No description provided."}
                        </div>
                    </div>

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
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={rec.thumbnail} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                    )}
                                    <div className="absolute bottom-1 right-1 bg-black/80 text-[10px] font-bold px-1 rounded text-white">
                                        {rec.duration ? `${Math.floor(rec.duration / 60)}:${(rec.duration % 60).toString().padStart(2, '0')}` : "VID"}
                                    </div>
                                </div>
                                {/* Info */}
                                <div className="flex flex-col gap-1 min-w-0">
                                    <h4 className="font-bold text-sm leading-tight line-clamp-2 text-white group-hover:text-pink-400 transition-colors">
                                        {rec.title}
                                    </h4>
                                    <p className="text-xs text-zinc-500">
                                        {new Date(rec.createdAt).toLocaleDateString()}
                                    </p>
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

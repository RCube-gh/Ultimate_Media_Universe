import { Play, Book, Music, Clock, File } from "lucide-react";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

// Revalidate every 60 seconds (ISR equivalent) or 0 for dynamic
export const revalidate = 0;

export default async function Home() {
    // 🕵️‍♀️ Fetch Real Data
    const newArrivals = await prisma.mediaItem.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
    });

    const totalCount = await prisma.mediaItem.count();

    // Placeholder for continues (Using items with progress > 0 later)
    // For now, just show random 3 items or empty
    const continueWatching: any[] = [];

    return (
        <div className="p-8 space-y-12">

            {/* 🎬 Hero: Welcome Banner */}
            <section className="relative h-64 rounded-3xl overflow-hidden glass border-none shadow-2xl flex items-center px-10">
                <div className="absolute inset-0 bg-gradient-to-r from-pink-900/80 to-zinc-950/20 z-0"></div>
                {/* Optional: Use a random backdrop image from an item? */}

                <div className="relative z-10 max-w-2xl">
                    <h1 className="text-4xl font-extrabold text-white mb-2">
                        Welcome back, <span className="text-pink-500">Master.</span>
                    </h1>
                    <p className="text-zinc-300 text-lg">
                        {process.env.NEXT_PUBLIC_AI_NAME || "System"} has indexed <span className="text-pink-400 font-bold font-mono text-xl mx-1">{totalCount.toLocaleString()}</span> items for your pleasure today.
                        Where shall we start?
                    </p>
                    <div className="mt-6 flex gap-4">
                        <button className="px-6 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-bold shadow-lg shadow-pink-600/20 transition-all transform hover:scale-105">
                            Random Pick 🎲
                        </button>
                        <button className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold backdrop-blur-md transition-all">
                            {process.env.NEXT_PUBLIC_AI_NAME || "AI"}&apos;s Suggestion 🌸
                        </button>
                    </div>
                </div>
            </section>

            {/* ⏯️ Continue Watching (Hidden if empty) */}
            {continueWatching.length > 0 && (
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <Clock className="w-6 h-6 text-pink-500" />
                        <h2 className="text-2xl font-bold text-white">Continue Watching</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {continueWatching.map((item) => (
                            <div key={item.id} className="group relative h-48 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-pink-500/50 overflow-hidden cursor-pointer transition-all hover:shadow-xl hover:shadow-pink-500/10">
                                {/* ... content ... */}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ✨ New Arrivals */}
            <section>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-2 h-6 bg-pink-500 rounded-full" />
                    <h2 className="text-2xl font-bold text-white">New Arrivals</h2>
                </div>

                {newArrivals.length === 0 ? (
                    <div className="p-12 text-center border border-dashed border-zinc-800 rounded-3xl text-zinc-600">
                        <Book className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No items yet. Go upload something! 📤</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {newArrivals.map((item) => (
                            <Link href={item.type === "MANGA" ? `/manga/${item.id}` : `/video/${item.id}`} key={item.id} className="group flex flex-col gap-2 cursor-pointer">

                                {/* 🖼️ Cover Image */}
                                <div className="aspect-[3/4] rounded-xl bg-zinc-800 border border-zinc-800 group-hover:border-pink-500/50 transition-all overflow-hidden relative">
                                    {item.thumbnail ? (
                                        <img
                                            src={item.thumbnail}
                                            alt={item.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-zinc-700 bg-zinc-900">
                                            {item.type === 'VIDEO' ? <Play /> : item.type === 'MANGA' ? <Book /> : <File />}
                                        </div>
                                    )}

                                    {/* Type Badge */}
                                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-[10px] font-bold text-white border border-white/10">
                                        {item.type}
                                    </div>

                                    {/* Hover Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                                        <span className="text-xs text-pink-400 font-bold mb-1 flex items-center gap-1">
                                            {item.type === "MANGA" ? "READ NOW" : "WATCH NOW"}
                                            <Play size={10} className="fill-current" />
                                        </span>
                                    </div>
                                </div>

                                {/* 📝 Meta */}
                                <div>
                                    <h3 className="text-sm font-medium text-zinc-200 group-hover:text-pink-400 truncate transition-colors" title={item.title}>
                                        {item.title}
                                    </h3>
                                    <p className="text-xs text-zinc-500 flex justify-between">
                                        <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                                        {item.size && <span>{(Number(item.size) / (1024 * 1024)).toFixed(0)} MB</span>}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

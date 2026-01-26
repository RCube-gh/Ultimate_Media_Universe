import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Music, Play, Headphones } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Always fetch fresh data
export const revalidate = 0;

export default async function AudioCatalogPage() {
    // 🎧 Fetch ONLY Audio items
    const audios = await prisma.mediaItem.findMany({
        where: { type: "AUDIO" },
        orderBy: { createdAt: "desc" },
    });

    return (
        <div className="p-8 space-y-8 pb-32">
            {/* Header */}
            <header className="flex items-end justify-between border-b border-zinc-800 pb-6 animate-in slide-in-from-top-4 duration-500">
                <div>
                    <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
                        <Headphones className="text-pink-500 w-8 h-8" />
                        Audio Library
                    </h1>
                    <p className="text-zinc-500 mt-2">
                        ASMR, Voice Works, and Music. <span className="text-pink-400 font-bold">{audios.length}</span> albums indexed.
                    </p>
                </div>
                <Link href="/upload" className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-sm font-bold text-white rounded-lg transition-colors flex items-center gap-2">
                    Upload New
                </Link>
            </header>

            {/* Grid */}
            {audios.length === 0 ? (
                <div className="py-20 text-center text-zinc-600 animate-in fade-in zoom-in duration-500">
                    <Music className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-xl font-bold">No Audio Found</p>
                    <p className="text-sm mt-2">Upload some ZIP files (Albums) to get started!</p>
                    <Link href="/upload" className="inline-block mt-6 px-6 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-full transition-colors shadow-lg shadow-pink-900/20">
                        Go to Upload
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                    {audios.map((item, index) => (
                        <Link
                            href={`/audio/${item.id}`}
                            key={item.id}
                            className="group flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            {/* CD / Square Layout for Audio */}
                            <div className="aspect-square rounded-xl bg-zinc-800 border border-zinc-800 group-hover:border-pink-500/50 transition-all overflow-hidden relative shadow-lg group-hover:shadow-pink-500/10 group-hover:-translate-y-1 duration-300">
                                {item.thumbnail ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={item.thumbnail}
                                        alt={item.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-zinc-700 bg-gradient-to-br from-zinc-800 to-zinc-900">
                                        <Music size={48} strokeWidth={1} />
                                    </div>
                                )}

                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                    <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center shadow-xl transform scale-50 group-hover:scale-100 transition-all duration-300">
                                        <Play size={20} className="fill-white text-white ml-1" />
                                    </div>
                                </div>

                                {/* Track Count Badge */}
                                {item.metadata && (
                                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-[10px] font-mono text-white pointer-events-none border border-white/10 flex items-center gap-1">
                                        <Music size={10} />
                                        {/* Try to parse track count if possible, or fallback */}
                                        {(() => {
                                            try {
                                                const meta = JSON.parse(item.metadata as string);
                                                return meta.tracks?.length || "?";
                                            } catch { return "?"; }
                                        })()} Tr
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div>
                                <h3 className="text-sm font-bold text-zinc-200 group-hover:text-pink-400 line-clamp-2 transition-colors leading-snug" title={item.title}>
                                    {item.title}
                                </h3>
                                <div className="flex justify-between items-center mt-1 text-xs text-zinc-500 font-mono">
                                    <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

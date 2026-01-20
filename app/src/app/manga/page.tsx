import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Book, Play } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Always fetch fresh data
export const revalidate = 0;

export default async function MangaCatalogPage() {
    // 📚 Fetch ONLY Manga items
    const mangas = await prisma.mediaItem.findMany({
        where: { type: "MANGA" },
        orderBy: { createdAt: "desc" },
    });

    return (
        <div className="p-8 space-y-8">
            {/* Header */}
            <header className="flex items-end justify-between border-b border-zinc-800 pb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
                        <Book className="text-pink-500 w-8 h-8" />
                        Manga Library
                    </h1>
                    <p className="text-zinc-500 mt-2">
                        Your private collection. <span className="text-pink-400 font-bold">{mangas.length}</span> titles indexed.
                    </p>
                </div>
            </header>

            {/* Grid */}
            {mangas.length === 0 ? (
                <div className="py-20 text-center text-zinc-600">
                    <Book className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="text-xl font-bold">No Manga Found</p>
                    <p className="text-sm mt-2">Upload some ZIP/CBZ files to get started!</p>
                    <Link href="/upload" className="inline-block mt-6 px-6 py-2 bg-zinc-800 hover:bg-pink-600 text-white rounded-full transition-colors">
                        Go to Upload
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {mangas.map((item) => (
                        <Link href={`/manga/${item.id}`} key={item.id} className="group flex flex-col gap-3">
                            {/* Cover Art */}
                            <div className="aspect-[2/3] rounded-xl bg-zinc-800 border border-zinc-800 group-hover:border-pink-500/50 transition-all overflow-hidden relative shadow-lg group-hover:shadow-pink-500/10 group-hover:-translate-y-1 duration-300">
                                {item.thumbnail ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={item.thumbnail}
                                        alt={item.title}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-zinc-700 bg-zinc-900">
                                        <Book size={48} strokeWidth={1} />
                                    </div>
                                )}

                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                    <span className="px-4 py-2 bg-pink-600 text-white text-sm font-bold rounded-full flex items-center gap-2 transform scale-90 group-hover:scale-100 transition-transform">
                                        Read Now <Play size={12} className="fill-current" />
                                    </span>
                                </div>

                                {/* Page Count Badge */}
                                {item.pages && (
                                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-[10px] font-mono text-zinc-300 pointer-events-none">
                                        {item.pages}P
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div>
                                <h3 className="text-sm font-bold text-zinc-200 group-hover:text-pink-400 line-clamp-2 transition-colors leading-snug" title={item.title}>
                                    {item.title}
                                </h3>
                                <div className="flex justify-between items-center mt-1 text-xs text-zinc-500">
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

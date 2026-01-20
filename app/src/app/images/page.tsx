import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Image as ImageIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ImagesPage() {
    // 🧠 脳みそから「IMAGE」タイプのアイテムだけ取ってくる！
    const images = await prisma.mediaItem.findMany({
        where: { type: "IMAGE" },
        orderBy: { createdAt: "desc" },
    });

    return (
        <div className="p-8">
            <header className="mb-8 pl-2">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <span className="p-2 bg-pink-500/10 rounded-lg text-pink-500">
                        <ImageIcon size={32} />
                    </span>
                    Images Library
                </h1>
                <p className="text-zinc-500 mt-2">
                    Collection of Single CGs, GIFs, and Illustrations.
                </p>
            </header>

            {images.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {images.map((item) => (
                        <ImageCard key={item.id} item={item} />
                    ))}
                </div>
            )}
        </div>
    );
}

function ImageCard({ item }: { item: any }) {
    return (
        <a
            href={item.url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-pink-500/50 hover:shadow-xl hover:shadow-pink-500/10 transition-all duration-300 transform hover:-translate-y-1"
        >
            {/* 🖼️ Thumbnail Area (Maximizing visual impact) */}
            <div className="aspect-[3/4] overflow-hidden bg-zinc-950 relative">
                {item.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700 bg-zinc-900">
                        <ImageIcon size={48} />
                    </div>
                )}

                {/* 🏷️ Overlay Badge */}
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded border border-white/10 uppercase">
                    IMG
                </div>
            </div>

            {/* 📝 Info Area */}
            <div className="p-4 bg-zinc-900/90 absolute bottom-0 w-full backdrop-blur-sm translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                <h3 className="font-bold text-white text-sm line-clamp-1 group-hover:text-pink-400 transition-colors">
                    {item.title}
                </h3>
                {item.description && (
                    <p className="text-zinc-400 text-xs mt-1 line-clamp-2">
                        {item.description}
                    </p>
                )}
                <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-500 border-t border-white/5 pt-2">
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    <span>Open Original ↗</span>
                </div>
            </div>
        </a>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20">
            <ImageIcon size={64} className="opacity-20 mb-4" />
            <p className="text-xl font-medium">No Images yet.</p>
            <p className="text-sm mt-2">Go to Upload and select 'Image' to add some.</p>
            <Link
                href="/upload"
                className="mt-6 px-6 py-2 bg-zinc-800 hover:bg-pink-600 hover:text-white text-zinc-300 rounded-full font-medium transition-colors"
            >
                Add Image
            </Link>
        </div>
    );
}

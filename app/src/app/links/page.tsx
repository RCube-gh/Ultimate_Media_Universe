import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ExternalLink, Globe } from "lucide-react";

export const dynamic = "force-dynamic"; // 常に最新のデータを表示するよ！

export default async function LinksPage() {
    // 🧠 脳みそから「LINK」タイプのアイテムだけ取ってくる！
    const links = await prisma.mediaItem.findMany({
        where: { type: "LINK" },
        orderBy: { createdAt: "desc" },
    });

    return (
        <div className="p-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Globe className="text-pink-500" />
                    <span>Web Bookmarks</span>
                    <span className="text-sm font-normal text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
                        {links.length} items
                    </span>
                </h1>
                {/* ここに将来「Omni-Uploader」ボタンが来るよ！ */}
            </div>

            {/* Grid Content */}
            {links.length === 0 ? (
                // Empty State 🌑
                <div className="h-[60vh] flex flex-col items-center justify-center text-zinc-500 border-2 border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20">
                    <Globe className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-lg">No links found yet.</p>
                    <p className="text-sm">Feed Moca with some URL... 💓</p>
                </div>
            ) : (
                // Link Cards 🃏
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {links.map((link) => (
                        <div key={link.id} className="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-pink-500/50 transition-all hover:shadow-lg hover:shadow-pink-500/10 flex flex-col">

                            {/* Thumbnail Area */}
                            <div className="aspect-video bg-zinc-900 relative overflow-hidden">
                                {link.thumbnail ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={link.thumbnail}
                                        alt={link.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-zinc-800/50">
                                        <Globe className="w-10 h-10 text-zinc-700" />
                                    </div>
                                )}

                                {/* Overlay Action */}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-[2px]">
                                    <Link
                                        href={link.url || "#"}
                                        target="_blank"
                                        className="flex items-center gap-2 px-6 py-3 bg-pink-600 text-white rounded-full font-bold hover:bg-pink-500 transition-colors shadow-lg shadow-pink-600/20"
                                    >
                                        Open Site <ExternalLink size={16} />
                                    </Link>
                                </div>
                            </div>

                            {/* Info Area */}
                            <div className="p-4 flex-1 flex flex-col">
                                <h3 className="font-bold text-zinc-200 line-clamp-2 leading-snug group-hover:text-pink-400 transition-colors">
                                    {link.title}
                                </h3>
                                <p className="text-xs text-zinc-500 mt-2 line-clamp-2">
                                    {link.description || "No description provided."}
                                </p>
                                <div className="mt-auto pt-4 flex items-center justify-between text-xs text-zinc-600">
                                    <span>{new Date(link.createdAt).toLocaleDateString()}</span>
                                    <span className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">LINK</span>
                                </div>
                            </div>

                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import MangaReader from "@/components/MangaReader";

// No caching for reader to ensure fresh access
export const revalidate = 0;

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function MangaReaderPage({ params }: PageProps) {
    const { id } = await params;

    const item = await prisma.mediaItem.findUnique({
        where: { id },
    });

    if (!item || item.type !== "MANGA") {
        return notFound();
    }

    // 🕵️‍♀️ Parse Metadata to get pages
    let pages: { url: string; width: number; height: number }[] = [];
    try {
        // Force access metadata as any to avoid type errors if client isn't fully updated yet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawMeta = (item as any).metadata;
        const filePath = item.filePath;

        if (rawMeta && filePath) {
            const meta = JSON.parse(rawMeta as string);
            // meta.pages is Array<{ file: string, ... }>

            // We need to construct the base URL for the API
            // The item.filePath is absolute server path: "C:\...\library\manga\Title"
            // We need to convert this to "/api/file/manga/Title"

            // Robust cleaning of path
            const normalizedPath = filePath.replaceAll('\\', '/');
            const libIndex = normalizedPath.toLowerCase().lastIndexOf('/library/');

            if (libIndex !== -1) {
                const relativeRoot = normalizedPath.substring(libIndex + 9); // "manga/Title"

                pages = meta.pages.map((p: any) => {
                    const pageFile = p.file.replaceAll('\\', '/');
                    // Encode URI components just in case of spaces/special chars
                    // But usually scanner keeps them safe.
                    // const safeRoot = relativeRoot.split('/').map(encodeURIComponent).join('/');
                    // const safePage = pageFile.split('/').map(encodeURIComponent).join('/');

                    return {
                        url: `/api/file/${relativeRoot}/${pageFile}`,
                        width: p.w || 0,
                        height: p.h || 0
                    };
                });
            }
        }
    } catch (e) {
        console.error("Error parsing manga metadata:", e);
    }

    // 🔍 Recommendations
    const recommendations = await prisma.mediaItem.findMany({
        where: {
            type: "MANGA",
            id: { not: id },
        },
        orderBy: { createdAt: "desc" },
        take: 8
    });

    return (
        <div className="min-h-screen bg-zinc-950 text-white overflow-y-auto custom-scrollbar pb-20">
            <div className="max-w-[1920px] mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">

                {/* 📖 Left Column (Reader & Meta) */}
                <div className="lg:col-span-2 xl:col-span-3 flex flex-col gap-6">

                    {/* Reader Container */}
                    <div className="w-full h-[85vh] bg-black rounded-lg overflow-hidden shadow-2xl border border-zinc-800 relative z-10 ring-1 ring-white/10">
                        <MangaReader
                            title={item.title}
                            pages={pages}
                            backUrl="/manga"
                            className="w-full h-full"
                        />
                    </div>

                    {/* Metadata */}
                    <div className="space-y-4 px-2">
                        <h1 className="text-3xl font-bold leading-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">
                            {item.title}
                        </h1>

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                            <div className="flex items-center gap-3 text-sm text-zinc-400">
                                <span className="px-2 py-1 bg-zinc-800 rounded text-xs font-mono">{pages.length} Pages</span>
                                <span>•</span>
                                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-full font-medium text-sm transition-colors text-pink-200 hover:text-pink-100">
                                    ♥ Like
                                </button>
                                <button className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-full font-bold text-sm transition-colors shadow-lg shadow-pink-900/20">
                                    💧 Cum
                                </button>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="bg-zinc-900/30 rounded-xl p-4 text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                            {item.description || "No description provided."}
                        </div>
                    </div>
                </div>

                {/* 📚 Right Column (Sidebar) */}
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-3">
                        <h3 className="font-bold text-zinc-400 px-1 uppercase tracking-wider text-xs">Read Next</h3>
                        {recommendations.map((rec: any) => ( // Typings are loose for now
                            <a key={rec.id} href={`/manga/${rec.id}`} className="flex gap-3 group p-2 rounded-xl hover:bg-white/5 transition-colors">
                                {/* Thumb */}
                                <div className="w-24 h-32 bg-zinc-800 rounded shadow-lg overflow-hidden relative shrink-0">
                                    {rec.thumbnail && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={rec.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    )}
                                    <div className="absolute bottom-1 right-1 bg-black/80 text-[10px] font-bold px-1 rounded text-white">
                                        {rec.pages} P
                                    </div>
                                </div>
                                {/* Info */}
                                <div className="flex flex-col gap-1 min-w-0 py-1">
                                    <h4 className="font-bold text-sm leading-snug line-clamp-3 text-zinc-200 group-hover:text-pink-400 transition-colors">
                                        {rec.title}
                                    </h4>
                                    <p className="text-xs text-zinc-500 mt-auto">
                                        {new Date(rec.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </a>
                        ))}
                        {recommendations.length === 0 && (
                            <p className="text-xs text-zinc-600 p-4 text-center border border-dashed border-zinc-800 rounded">No other manga yet... Time to collect more!</p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AudioPlayer, { AudioTrack } from "@/components/AudioPlayer";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MediaInfo } from "@/components/MediaInfo";

export const revalidate = 0;

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function AudioPage({ params }: PageProps) {
    const { id } = await params;

    const item = await prisma.mediaItem.findUnique({
        where: { id },
        include: { tags: true, markers: true },
    });

    if (!item || item.type !== "AUDIO") {
        return notFound();
    }

    // 🕵️‍♀️ Parse Metadata
    let tracks: AudioTrack[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let coverUrl = item.thumbnail || undefined;
    let images: string[] = [];

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawMeta = (item as any).metadata;
        const hasMeta = rawMeta && (typeof rawMeta === 'string' ? rawMeta !== "{}" : Object.keys(rawMeta).length > 0);

        if (hasMeta && item.filePath) {
            const meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;

            const normalizedPath = item.filePath.replaceAll('\\', '/');

            // Try different anchors to find the root
            let relativeRoot = "";
            let libIndex = normalizedPath.toLowerCase().lastIndexOf('/library/');

            if (libIndex !== -1) {
                relativeRoot = normalizedPath.substring(libIndex + 9);
            } else {
                // Fallback: Try "/uploads/"
                const uploadIndex = normalizedPath.toLowerCase().lastIndexOf('/uploads/');
                if (uploadIndex !== -1) {
                    relativeRoot = "uploads" + normalizedPath.substring(uploadIndex + 8);
                } else {
                    console.warn("Could not determine relative root from path:", normalizedPath);
                }
            }

            if (relativeRoot || libIndex !== -1) {
                if (relativeRoot.startsWith('/')) relativeRoot = relativeRoot.substring(1);

                if (Array.isArray(meta.tracks)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    tracks = meta.tracks.map((t: any) => {
                        let rawTitle = t.title || "";

                        if (!rawTitle) {
                            rawTitle = t.file.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, "") || "Unknown";
                        }

                        rawTitle = rawTitle.replace(/[_-]/g, " ");
                        rawTitle = rawTitle.replace(/^\d+[\.\-\s]+/, "");
                        rawTitle = rawTitle.trim();

                        return {
                            url: `/api/file/${relativeRoot}/${t.file.replaceAll('\\', '/')}`,
                            title: rawTitle || "Unknown Track",
                            index: t.index,
                            duration: t.duration || undefined
                        };
                    });
                }

                if (Array.isArray(meta.images)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    images = meta.images.map((img: any) =>
                        `/api/file/${relativeRoot}/${img.file.replaceAll('\\', '/')}`
                    );
                }

                if (images.length === 0 && item.thumbnail) {
                    images.push(item.thumbnail);
                }
            }
        }
    } catch (e) {
        console.error("Error parsing audio metadata:", e);
    }

    // 🩹 Fallback for Single File Uploads
    if (tracks.length === 0 && item.filePath) {
        const isZip = item.filePath.toLowerCase().endsWith(".zip");
        if ((item.filePath.startsWith("/") || item.filePath.startsWith("http")) && !isZip) {
            tracks.push({
                url: item.filePath,
                title: item.title,
                index: 0,
                duration: item.duration || undefined
            });
            if (item.thumbnail) images.push(item.thumbnail);
        }
    }

    // 🔍 Recommendations (Tags + Random)
    const tagIds = item.tags.map(t => t.id);

    let candidates = await prisma.mediaItem.findMany({
        where: {
            type: "AUDIO",
            id: { not: id },
            ...(tagIds.length > 0 ? {
                tags: { some: { id: { in: tagIds } } }
            } : {})
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
            id: true,
            title: true,
            thumbnail: true,
            duration: true,
            viewCount: true,
            createdAt: true
        }
    });

    if (candidates.length < 5) {
        const more = await prisma.mediaItem.findMany({
            where: {
                type: "AUDIO",
                id: { not: id, notIn: candidates.map(c => c.id) }
            },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                id: true,
                title: true,
                thumbnail: true,
                duration: true,
                viewCount: true,
                createdAt: true
            }
        });
        candidates = [...candidates, ...more];
    }

    // 🔀 Shuffle
    const recommendations = candidates.sort(() => Math.random() - 0.5).slice(0, 10);

    if (tracks.length === 0) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4">
                    <span className="text-3xl">⚠️</span>
                </div>
                <h1 className="text-2xl font-bold">Unable to load media</h1>
                <p className="text-zinc-400 max-w-md">
                    No audio tracks were found for this item. <br />
                    If you uploaded a ZIP file, it might have failed to extract or scan correctly.
                    Please try deleting this item and re-uploading it.
                </p>
                <div className="text-xs font-mono bg-zinc-900 p-2 rounded text-zinc-500 mt-4">
                    Item ID: {item.id} <br />
                    Path: {item.filePath || "No Path"}
                </div>
                <Link href="/" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors">
                    Back to Library
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white overflow-y-auto custom-scrollbar pb-20">
            <AudioPlayer
                id={item.id}
                tracks={tracks}
                images={images}
                title={item.title}
                description={item.description || undefined}
                createdAt={item.createdAt}
                viewCount={item.viewCount}
                rating={item.rating || 0}
                isFavorite={item.isFavorite}
                recommendations={recommendations}
            >
                <MediaInfo item={item as any} />
            </AudioPlayer>
        </div>
    );
}

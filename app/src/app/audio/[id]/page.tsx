import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AudioPlayer, { AudioTrack } from "@/components/AudioPlayer"; // This will be the updated Client Component
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const revalidate = 0;

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function AudioPage({ params }: PageProps) {
    const { id } = await params;

    const item = await prisma.mediaItem.findUnique({
        where: { id },
    });

    if (!item || item.type !== "AUDIO") {
        return notFound();
    }

    // 🕵️‍♀️ Parse Metadata
    let tracks: AudioTrack[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let coverUrl = item.thumbnail || undefined; // Keep for fallback logic
    let images: string[] = [];

    // console.log("🔍 AudioPage Debug:", { id: item.id, filePath: item.filePath, metaType: typeof (item as any).metadata });
    // console.log("🔍 Raw Meta:", (item as any).metadata);

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawMeta = (item as any).metadata;
        const hasMeta = rawMeta && (typeof rawMeta === 'string' ? rawMeta !== "{}" : Object.keys(rawMeta).length > 0);

        if (hasMeta && item.filePath) {
            const meta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;

            // Construct Base URL
            // Strategy: Find relative path from "library" folder which serves as API root
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
                    relativeRoot = "uploads" + normalizedPath.substring(uploadIndex + 8); // include uploads/ part
                } else {
                    // Fallback: If path implies we are in a subfolder, just try to use the last segments
                    // But for now, we assume standard structure failed. 
                    // Let's try to assume the filePath IS the relative path? Unlikely.
                    console.warn("Could not determine relative root from path:", normalizedPath);
                }
            }

            if (relativeRoot || libIndex !== -1) {
                // Clean relative root leading slash
                if (relativeRoot.startsWith('/')) relativeRoot = relativeRoot.substring(1);

                if (Array.isArray(meta.tracks)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    tracks = meta.tracks.map((t: any) => {
                        let rawTitle = t.title || "";

                        // If no title from DB/Scanner, derive from file path
                        if (!rawTitle) {
                            rawTitle = t.file.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, "") || "Unknown";
                        }

                        // Common Cleanup (Apply to both ID3 and File-derived titles to be safe against "01. Title")
                        // Replace _ and - with space
                        rawTitle = rawTitle.replace(/[_-]/g, " ");
                        // Remove leading digits/dots (e.g. "01. ", "01 ", "1-")
                        // Regex: Start with digits, optional dot/hyphen, then whitespace
                        rawTitle = rawTitle.replace(/^\d+[\.\-\s]+/, "");
                        // Trim
                        rawTitle = rawTitle.trim();

                        return {
                            url: `/api/file/${relativeRoot}/${t.file.replaceAll('\\', '/')}`,
                            title: rawTitle || "Unknown Track",
                            index: t.index
                        };
                    });
                }

                // Parse Images
                if (Array.isArray(meta.images)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    images = meta.images.map((img: any) =>
                        `/api/file/${relativeRoot}/${img.file.replaceAll('\\', '/')}`
                    );
                }

                // If no images found but thumbnail exists, use thumbnail
                if (images.length === 0 && item.thumbnail) {
                    images.push(item.thumbnail);
                }
            }
        }
    } catch (e) {
        console.error("Error parsing audio metadata:", e);
    }

    // 🩹 Fallback for Single File Uploads (No Metadata or Failed Parse)
    if (tracks.length === 0 && item.filePath) {
        const isZip = item.filePath.toLowerCase().endsWith(".zip");
        // Check if it's already a public path (starts with /api or http) AND NOT A ZIP
        if ((item.filePath.startsWith("/") || item.filePath.startsWith("http")) && !isZip) {
            tracks.push({
                url: item.filePath,
                title: item.title, // Use Item Title for single file
                index: 0
            });
            if (item.thumbnail) images.push(item.thumbnail);
        }
    }

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
        <div className="min-h-screen bg-zinc-950 text-white overflow-y-auto custom-scrollbar">
            {/* Note: We remove the fixed header to match VideoPage style more closely, or keep it if preferred. 
                 VideoPage has no sticky header. Let's keep it clean. */}

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
            />
        </div>
    );
}

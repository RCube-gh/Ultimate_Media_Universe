"use client";

import { useState } from "react";
import { Edit2, Save, X, ThumbsUp, Heart, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { TagEditor } from "./TagEditor";
import { MarkerStats } from "./MarkerStats";
import { VideoActions } from "./VideoActions"; // Reusing VideoActions as it seems generic (Like/Fav)

interface MediaInfoProps {
    item: {
        id: string;
        title: string;
        description: string | null;
        tags: { id: string; name: string }[];
        rating: number;
        isFavorite: boolean;
        viewCount: number;
        createdAt: Date | string;
        duration: number | null;
        type: string; // VIDEO, AUDIO, MANGA
        pages?: number | null; // For Manga
    };
}

export function MediaInfo({ item }: MediaInfoProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(item.title);
    const [description, setDescription] = useState(item.description || "");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSave = async () => {
        setLoading(true);
        try {
            await fetch(`/umu/api/media/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, description }),
            });
            setIsEditing(false);
            router.refresh();
        } catch (error) {
            console.error("Failed to update media info", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setTitle(item.title);
        setDescription(item.description || "");
        setIsEditing(false);
    };

    return (
        <div className="space-y-4">
            {/* 🟢 Header: Title & Actions */}
            <div className="flex flex-col gap-2">
                {isEditing ? (
                    // ✏️ Editing Mode: Title Input
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xl font-bold text-white focus:outline-none focus:border-pink-500/50"
                            placeholder="Title"
                        />
                    </div>
                ) : (
                    // 📺 View Mode: Title Display
                    <div className="flex items-start justify-between gap-4">
                        <h1 className="text-2xl font-bold leading-tight line-clamp-2">{item.title}</h1>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-colors flex-shrink-0"
                            title="Edit Info"
                        >
                            <Edit2 size={18} />
                        </button>
                    </div>
                )}

                {/* 📊 Stats & Toolbar Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 border-b border-zinc-800/50">
                    {/* Stats */}
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <span className="text-white font-bold">{item.viewCount.toLocaleString()} views</span>
                        <span>•</span>
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        <MarkerStats id={item.id} />
                    </div>

                    {!isEditing && (
                        <VideoActions
                            id={item.id}
                            initialLikes={item.rating || 0}
                            initialIsFavorite={item.isFavorite}
                        />
                    )}

                    {/* ✏️ Edit Actions */}
                    {isEditing && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 rounded-full text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-600/20 transition-all active:scale-95 disabled:opacity-50"
                                disabled={loading}
                            >
                                <Save size={16} />
                                {loading ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* 📝 Description & Details */}
            <div className={isEditing ? "bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50" : "bg-zinc-900/50 rounded-xl p-4 text-sm text-zinc-300 whitespace-pre-wrap hover:bg-zinc-900 transition-colors"}>

                <div className="flex gap-2 font-bold mb-2 text-zinc-400 text-xs uppercase tracking-wider">
                    {item.type === "MANGA" ? (
                        <span>{item.pages ? `${item.pages} Pages` : "Unknown pages"}</span>
                    ) : (
                        <span>{item.duration ? `${Math.floor(item.duration / 60)} min` : "Unknown duration"}</span>
                    )}
                </div>

                {isEditing ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={6}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-pink-500/50 resize-y"
                                placeholder="Enter description..."
                            />
                        </div>

                        {/* Tag Editor integrated here in edit mode */}
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase">Tags</label>
                            <TagEditor mediaId={item.id} initialTags={item.tags} />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="mb-4 text-zinc-200">{item.description || "No description provided."}</div>

                        {item.tags && item.tags.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-zinc-800">
                                <div className="flex flex-wrap gap-2">
                                    {item.tags.map(tag => (
                                        <span key={tag.id} className="text-xs px-2.5 py-1 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20">
                                            #{tag.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

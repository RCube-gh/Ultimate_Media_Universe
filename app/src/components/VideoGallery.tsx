"use client";

import { useState, useEffect } from "react";
import { Film, Play, CheckCircle2, Trash2, Tag, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { TagEditor } from "./TagEditor";

interface VideoItem {
    id: string;
    title: string;
    description: string | null;
    thumbnail: string | null;
    createdAt: Date;
    duration: number | null;
    tags: { id: string, name: string }[];
    status?: string; // READY, PROCESSING
}

interface VideoGalleryProps {
    items: VideoItem[];
    initialSort?: string;
}

export function VideoGallery({ items, initialSort = "latest" }: VideoGalleryProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeSort = searchParams.get("sort") || initialSort;

    const [sortOpen, setSortOpen] = useState(false);

    // ⚡ Batch Selection State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // 🏷️ Batch Tagging State
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);
    const [tagsToAdd, setTagsToAdd] = useState<{ id: string, name: string }[]>([]);
    const [tagMode, setTagMode] = useState<'add' | 'remove'>('add');

    // Moca's Sort Options 🧠
    const sortOptions = [
        { id: 'latest', label: 'Newest (Default)', icon: '🕒' },
        { id: 'oldest', label: 'Oldest', icon: '🕰️' },
        { id: 'popular', label: 'Most Viewed', icon: '🔥' },
        { id: 'rating', label: 'Top Rated', icon: '⭐' },
        { id: 'fetish', label: 'Fetish Rank (Markers)', icon: '💦' },
        { id: 'longest', label: 'Longest', icon: '📏' },
        { id: 'shortest', label: 'Shortest', icon: '⚡' },
        { id: 'title', label: 'A-Z', icon: '🔤' },
        { id: 'title_desc', label: 'Z-A', icon: '🔠' },
    ];

    const currentSort = sortOptions.find(o => o.id === activeSort) || sortOptions[0];

    // 💾 Persist Sort Preference
    useEffect(() => {
        const urlSort = searchParams.get("sort");
        if (urlSort) {
            localStorage.setItem("umu_sort_order", urlSort);
        } else {
            const savedSort = localStorage.getItem("umu_sort_order");
            if (savedSort && sortOptions.some(o => o.id === savedSort) && savedSort !== "latest") {
                const url = new URL(window.location.href);
                url.searchParams.set("sort", savedSort);
                router.replace(url.toString());
            }
        }
    }, [searchParams, router]);

    const handleSort = (sortId: string) => {
        const url = new URL(window.location.href);
        url.searchParams.set("sort", sortId);
        localStorage.setItem("umu_sort_order", sortId);
        router.replace(url.toString());
        setSortOpen(false);
    };

    // 🖱️ Selection Handlers
    const toggleSelection = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        if (selectedIds.size === items.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(items.map(i => i.id)));
        }
    };

    // 🗑️ Batch Actions
    const handleBatchDelete = async () => {
        if (!confirm(`⚠️ Are you sure you want to delete ${selectedIds.size} items?\nThis action cannot be undone.`)) return;
        try {
            await axios.post("/umu/api/batch/delete", { ids: Array.from(selectedIds) });
            setSelectedIds(new Set());
            setIsSelectionMode(false);
            router.refresh();
        } catch (e: any) {
            alert("Delete failed: " + e.message);
        }
    };

    const openTagModal = () => {
        setTagsToAdd([]);
        setTagMode('add'); // Reset
        setIsTagModalOpen(true);
    };

    const confirmBatchTags = async () => {
        if (tagsToAdd.length === 0) return;

        try {
            await axios.post("/umu/api/batch/tags", {
                ids: Array.from(selectedIds),
                action: tagMode,
                tags: tagsToAdd.map(t => t.name)
            });
            alert(`Tags ${tagMode === 'add' ? 'added' : 'removed'}!`);
            setSelectedIds(new Set());
            setTagsToAdd([]);
            setIsTagModalOpen(false);
            setIsSelectionMode(false);
            router.refresh();
        } catch (e: any) {
            alert("Tag update failed: " + e.message);
        }
    };


    if (items.length === 0 && initialSort === "latest") { // Only show empty state on default view to allow clearing filters
        return (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20">
                <Film size={64} className="opacity-20 mb-4" />
                <p className="text-xl font-medium">No Videos yet.</p>
                <Link
                    href="/upload"
                    className="mt-6 px-6 py-2 bg-zinc-800 hover:bg-pink-600 hover:text-white text-zinc-300 rounded-full font-medium transition-colors"
                >
                    Add Video
                </Link>
            </div>
        );
    }

    return (
        <>
            {/* 🛠️ Toolbar */}
            <div className="flex items-center justify-between mb-6 bg-zinc-900/80 p-3 rounded-xl border border-zinc-800/50 backdrop-blur-md sticky top-4 z-40 shadow-xl">
                <div className="flex items-center gap-4">
                    <span className="text-zinc-400 text-sm font-medium px-2">
                        {items.length} items
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {/* 🔃 Sort Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setSortOpen(!sortOpen)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                        >
                            <span className="text-lg">{currentSort.icon}</span>
                            <span className="hidden sm:inline">{currentSort.label}</span>
                        </button>

                        {sortOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
                                <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col py-1">
                                    {sortOptions.map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => handleSort(opt.id)}
                                            className={`px-4 py-3 text-left text-sm font-medium flex items-center gap-3 hover:bg-pink-500/10 hover:text-pink-400 transition-colors ${initialSort === opt.id ? 'text-pink-500 bg-pink-500/5' : 'text-zinc-300'}`}
                                        >
                                            <span className="text-xl w-6 text-center">{opt.icon}</span>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <div className="w-px h-6 bg-zinc-700 mx-1" />

                    <button
                        onClick={() => {
                            setIsSelectionMode(!isSelectionMode);
                            setSelectedIds(new Set());
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${isSelectionMode
                            ? "bg-pink-600 text-white shadow-lg shadow-pink-500/20"
                            : "bg-zinc-800 text-zinc-400 hover:text-white"
                            }`}
                    >
                        {isSelectionMode ? <CheckCircle2 size={16} /> : <CheckCircle2 size={16} />}
                        {isSelectionMode ? "Done" : "Select"}
                    </button>
                </div>
            </div>

            {/* 🎥 Grid Content */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {items.map((item) => {
                    const isSelected = selectedIds.has(item.id);

                    const isProcessing = item.status === "PROCESSING";

                    return (
                        <Link
                            key={item.id}
                            href={(isSelectionMode || isProcessing) ? "#" : `/videos/${item.id}`} // Disable if selecting OR processing
                            onClick={(e) => {
                                if (isSelectionMode) toggleSelection(item.id, e);
                                else if (isProcessing) e.preventDefault();
                            }}
                            className={`group relative block bg-zinc-900 border rounded-xl overflow-hidden transition-all duration-300 transform ${isSelectionMode && isSelected
                                ? "border-pink-500 ring-2 ring-pink-500/50 scale-95"
                                : "border-zinc-800 hover:border-pink-500/50 hover:shadow-xl hover:shadow-pink-500/10 hover:-translate-y-1"
                                }`}
                        >
                            {/* Selection Checkbox Overlay */}
                            {isSelectionMode && (
                                <div className={`absolute top-2 right-2 z-30 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? "bg-pink-500 border-pink-500 text-white" : "bg-black/50 border-white/50"
                                    }`}>
                                    {isSelected && <CheckCircle2 size={14} />}
                                </div>
                            )}

                            {/* 🎥 Thumbnail Area */}
                            <div className={`aspect-video overflow-hidden bg-zinc-950 relative group/thumb ${isSelectionMode && isSelected ? "opacity-60" : ""}`}>
                                {item.thumbnail ? (
                                    <>
                                        {/* Layer 1: Blurred Background */}
                                        <div
                                            className="absolute inset-0 bg-cover bg-center opacity-40 blur-xl scale-110"
                                            style={{ backgroundImage: `url('${item.thumbnail?.startsWith("/") ? `/umu${item.thumbnail}` : item.thumbnail}')` }}
                                        />
                                        {/* Layer 2: Main Image (Contained) */}
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={item.thumbnail?.startsWith("/") ? `/umu${item.thumbnail}` : item.thumbnail}
                                            alt={item.title}
                                            className={`absolute inset-0 w-full h-full object-contain z-10 transition-transform duration-500 ${isProcessing ? "opacity-50 grayscale" : "group-hover:scale-105"}`}
                                        />
                                    </>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-700 bg-zinc-900 group-hover:bg-zinc-800 transition-colors">
                                        <Film size={48} />
                                    </div>
                                )}

                                {/* ⚙️ PROCESSING OVERLAY */}
                                {isProcessing && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/40 backdrop-blur-sm">
                                        <Loader2 size={32} className="text-pink-500 animate-spin mb-2" />
                                        <span className="text-xs font-bold text-white uppercase tracking-widest">Processing</span>
                                    </div>
                                )}

                                {/* ▶ Play Button Overlay (Only in View Mode & Ready) */}
                                {!isSelectionMode && !isProcessing && (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                                        <div className="w-16 h-16 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-lg shadow-pink-600/40 transform scale-50 group-hover:scale-100 transition-transform duration-300">
                                            <Play size={32} fill="currentColor" className="ml-1" />
                                        </div>
                                    </div>
                                )}

                                {/* 🏷️ Type Badge */}

                            </div>

                            {/* 📝 Info Area */}
                            <div className="p-4 bg-zinc-900 flex flex-col gap-1">
                                <div className="flex flex-wrap gap-1 mb-1">
                                    {item.tags?.map((tag: any) => (
                                        <span key={tag.id} className="text-[10px] text-pink-300 bg-pink-500/10 px-1.5 py-0.5 rounded border border-pink-500/10">
                                            #{tag.name}
                                        </span>
                                    ))}
                                </div>
                                <h3 className="font-bold text-white text-lg line-clamp-1 group-hover:text-pink-400 transition-colors">
                                    {item.title}
                                </h3>
                                <div className="flex items-center justify-between text-xs text-zinc-500 mt-2">
                                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                                    {/* ⏱ Duration */}
                                    <span className="flex items-center gap-1 font-mono text-zinc-400 bg-zinc-800/50 px-2 py-0.5 rounded border border-zinc-700">
                                        {item.duration
                                            ? `${Math.floor(item.duration / 60)}:${(item.duration % 60).toString().padStart(2, '0')}`
                                            : "--:--"}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* 🚀 Floating Action Bar (Batch Operations) */}
            {isSelectionMode && selectedIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-zinc-900/90 border border-zinc-700 backdrop-blur-xl p-4 rounded-2xl shadow-2xl z-50 flex items-center gap-6 animate-in slide-in-from-bottom-10 fade-in duration-300">
                    <span className="text-white font-bold text-sm min-w-[80px]">
                        {selectedIds.size} selected
                    </span>

                    <div className="h-6 w-px bg-zinc-700" /> {/* Divider */}

                    <button
                        onClick={openTagModal}
                        className="flex flex-col items-center gap-1 text-zinc-400 hover:text-pink-400 transition-colors"
                    >
                        <Tag size={20} />
                        <span className="text-[10px] font-medium">Tag</span>
                    </button>

                    <button
                        onClick={handleBatchDelete}
                        className="flex flex-col items-center gap-1 text-zinc-400 hover:text-red-500 transition-colors"
                    >
                        <Trash2 size={20} />
                        <span className="text-[10px] font-medium">Delete</span>
                    </button>

                    <div className="h-6 w-px bg-zinc-700" /> {/* Divider */}

                    <button
                        onClick={toggleAll}
                        className="text-xs text-zinc-500 hover:text-white"
                    >
                        {selectedIds.size === items.length ? "Deselect All" : "Select All"}
                    </button>
                </div>
            )}

            {/* 🏷️ Batch Tag Modal */}
            {isTagModalOpen && (
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Tag className={tagMode === 'add' ? "text-pink-500" : "text-red-500"} />
                                {tagMode === 'add' ? "Add Tags" : "Remove Tags"}
                            </h3>
                            <button onClick={() => setIsTagModalOpen(false)} className="text-zinc-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex bg-zinc-800 p-1 rounded-lg mb-4">
                            <button
                                onClick={() => setTagMode('add')}
                                className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${tagMode === 'add' ? 'bg-zinc-700 text-pink-400 shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Add
                            </button>
                            <button
                                onClick={() => setTagMode('remove')}
                                className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${tagMode === 'remove' ? 'bg-zinc-700 text-red-400 shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Remove
                            </button>
                        </div>

                        <p className="text-sm text-zinc-400 mb-4">
                            {tagMode === 'add' ? 'Adding' : 'Removing'} tags {tagMode === 'add' ? 'to' : 'from'} <span className="text-white font-bold">{selectedIds.size}</span> items.
                        </p>

                        <TagEditor initialTags={tagsToAdd} onChange={setTagsToAdd} />

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setIsTagModalOpen(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmBatchTags}
                                disabled={tagsToAdd.length === 0}
                                className={`px-5 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg ${tagMode === 'add'
                                    ? "bg-pink-600 hover:bg-pink-500 hover:shadow-pink-500/20"
                                    : "bg-red-600 hover:bg-red-500 hover:shadow-red-500/20"
                                    }`}
                            >
                                {tagMode === 'add' ? "Apply Tags" : "Remove Tags"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

"use client";

import { useState } from "react";
import { Music, Play, CheckCircle2, Trash2, Tag, X, Headphones } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { formatDistanceToNow } from "date-fns";
import { TagEditor } from "./TagEditor";

interface AudioItem {
    id: string;
    title: string;
    description: string | null;
    thumbnail: string | null;
    createdAt: Date;
    metadata: string | null; // For track count
    tags: { id: string, name: string }[];
}

interface AudioGalleryProps {
    items: AudioItem[];
    initialSort?: string;
}

export function AudioGallery({ items, initialSort = "latest" }: AudioGalleryProps) {
    const router = useRouter();

    const [sortOpen, setSortOpen] = useState(false);

    // ⚡ Batch Selection State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // 🏷️ Batch Tagging State
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);
    const [tagsToAdd, setTagsToAdd] = useState<{ id: string, name: string }[]>([]);
    const [tagMode, setTagMode] = useState<'add' | 'remove'>('add');

    // Sort Options for Audio 🎧
    const sortOptions = [
        { id: 'latest', label: 'Newest (Default)', icon: '🕒' },
        { id: 'oldest', label: 'Oldest', icon: '🕰️' },
        { id: 'title', label: 'A-Z', icon: '🔤' },
        { id: 'title_desc', label: 'Z-A', icon: '🔠' },
    ];

    const currentSort = sortOptions.find(o => o.id === initialSort) || sortOptions[0];

    const handleSort = (sortId: string) => {
        const url = new URL(window.location.href);
        url.searchParams.set("sort", sortId);
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
        setTagMode('add');
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


    if (items.length === 0 && initialSort === "latest") {
        return (
            <div className="py-20 text-center text-zinc-600 animate-in fade-in zoom-in duration-500">
                <Music className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-xl font-bold">No Audio Found</p>
                <p className="text-sm mt-2">Upload some ZIP files (Albums) to get started!</p>
                <Link href="/upload" className="inline-block mt-6 px-6 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-full transition-colors shadow-lg shadow-pink-900/20">
                    Go to Upload
                </Link>
            </div>
        );
    }

    return (
        <>
            {/* 🛠️ Toolbar */}
            <div className="flex items-center justify-between mb-6 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50 backdrop-blur-sm sticky top-4 z-40 shadow-xl">
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

            {/* 🎧 Grid Content */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                {items.map((item, index) => {
                    const isSelected = selectedIds.has(item.id);

                    return (
                        <Link
                            href={isSelectionMode ? "#" : `/audio/${item.id}`}
                            key={item.id}
                            onClick={(e) => {
                                if (isSelectionMode) toggleSelection(item.id, e);
                            }}
                            className={`group flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 ${isSelectionMode ? "" : "hover:-translate-y-1"}`}
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            {/* CD / Square Layout for Audio */}
                            <div className={`aspect-square rounded-xl bg-zinc-800 border transition-all overflow-hidden relative shadow-lg duration-300 ${isSelectionMode && isSelected
                                ? "border-pink-500 ring-2 ring-pink-500/50 scale-95"
                                : "border-zinc-800 group-hover:border-pink-500/50 group-hover:shadow-pink-500/10"
                                }`}>
                                {/* Selection Checkbox Overlay */}
                                {isSelectionMode && (
                                    <div className={`absolute top-2 right-2 z-30 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? "bg-pink-500 border-pink-500 text-white" : "bg-black/50 border-white/50"
                                        }`}>
                                        {isSelected && <CheckCircle2 size={14} />}
                                    </div>
                                )}

                                {item.thumbnail ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={item.thumbnail.startsWith("/") ? `/umu${item.thumbnail}` : item.thumbnail}
                                        alt={item.title}
                                        className={`w-full h-full object-cover transition-transform duration-700 ${!isSelectionMode && "group-hover:scale-105"
                                            } ${isSelectionMode && isSelected ? "opacity-60" : ""}`}
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-zinc-700 bg-gradient-to-br from-zinc-800 to-zinc-900">
                                        <Music size={48} strokeWidth={1} />
                                    </div>
                                )}

                                {/* Hover Overlay (Only in View Mode) */}
                                {!isSelectionMode && (
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                        <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center shadow-xl transform scale-50 group-hover:scale-100 transition-all duration-300">
                                            <Play size={20} className="fill-white text-white ml-1" />
                                        </div>
                                    </div>
                                )}

                                {/* Track Count Badge */}
                                {item.metadata && (
                                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-[10px] font-mono text-white pointer-events-none border border-white/10 flex items-center gap-1">
                                        <Music size={10} />
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

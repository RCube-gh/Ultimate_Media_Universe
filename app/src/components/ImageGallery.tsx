"use client";

import { useState, useEffect, useCallback } from "react";
import { Image as ImageIcon, X, ChevronLeft, ChevronRight, Maximize2, Download, Info, CheckCircle2, Trash2, Tag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TagEditor } from "./TagEditor";
import axios from "axios";

interface ImageItem {
    id: string;
    title: string;
    url: string | null;
    thumbnail: string | null;
    description: string | null;
    filePath: string | null;
    createdAt: Date;
    size: bigint | null;
    tags: { id: string, name: string }[];
}

export function ImageGallery({ items }: { items: ImageItem[] }) {
    const router = useRouter();
    const [selectedIndex, setSelectedIndex] = useState<number>(-1);

    // ⚡ Batch Selection State
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // 🏷️ Batch Tagging State
    const [isTagModalOpen, setIsTagModalOpen] = useState(false);
    const [tagsToAdd, setTagsToAdd] = useState<{ id: string, name: string }[]>([]);
    const [tagMode, setTagMode] = useState<'add' | 'remove'>('add');

    // ⌨️ Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (selectedIndex === -1) return;
            if (e.key === "Escape") setSelectedIndex(-1);
            else if (e.key === "ArrowLeft") setSelectedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
            else if (e.key === "ArrowRight") setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedIndex, items.length]);

    // Current Item (Lightbox)
    const currentItem = selectedIndex !== -1 ? items[selectedIndex] : null;

    // 🖱️ Selection Handlers
    const toggleSelection = (id: string, e: React.MouseEvent) => {
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
            await axios.post("/api/batch/delete", { ids: Array.from(selectedIds) });
            setSelectedIds(new Set());
            setIsSelectionMode(false);
            router.refresh(); // Refresh page data
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
            await axios.post("/api/batch/tags", {
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


    if (items.length === 0) {
        return <EmptyState />;
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
                    <button
                        onClick={() => {
                            setIsSelectionMode(!isSelectionMode);
                            setSelectedIds(new Set()); // Clear on toggle
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

            {/* 🖼️ Grid Layout */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {items.map((item, index) => {
                    const isSelected = selectedIds.has(item.id);

                    return (
                        <div
                            key={item.id}
                            onClick={(e) => {
                                if (isSelectionMode) toggleSelection(item.id, e);
                                else setSelectedIndex(index);
                            }}
                            className={`group relative aspect-[3/4] bg-zinc-900 border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 ${isSelectionMode && isSelected
                                ? "border-pink-500 ring-2 ring-pink-500/50 scale-95"
                                : "border-zinc-800 hover:border-pink-500/50 hover:shadow-xl hover:shadow-pink-500/10"
                                }`}
                        >
                            {/* Selection Checkbox Overlay */}
                            {isSelectionMode && (
                                <div className={`absolute top-2 right-2 z-20 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? "bg-pink-500 border-pink-500 text-white" : "bg-black/50 border-white/50"
                                    }`}>
                                    {isSelected && <CheckCircle2 size={14} />}
                                </div>
                            )}

                            {item.thumbnail || item.filePath ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={item.thumbnail || item.filePath || ""}
                                    alt={item.title}
                                    className={`w-full h-full object-cover transition-transform duration-500 ${!isSelectionMode && "group-hover:scale-110"
                                        } ${isSelectionMode && isSelected ? "opacity-60" : ""}`}
                                    loading="lazy"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-700">
                                    <ImageIcon size={48} />
                                </div>
                            )}

                            {/* Hover Overlay (Only in View Mode) */}
                            {!isSelectionMode && (
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                    <h3 className="text-white text-sm font-bold line-clamp-1">{item.title}</h3>
                                    <p className="text-pink-300 text-xs">Click to View</p>
                                </div>
                            )}
                        </div>
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

            {/* 🌑 Lightbox Modal */}
            {currentItem && (
                <LightboxModal
                    item={currentItem}
                    itemsLength={items.length}
                    selectedIndex={selectedIndex}
                    setSelectedIndex={setSelectedIndex}
                />
            )}
        </>
    );
}

function LightboxModal({
    item,
    itemsLength,
    selectedIndex,
    setSelectedIndex,
}: {
    item: ImageItem;
    itemsLength: number;
    selectedIndex: number;
    setSelectedIndex: (idx: number) => void;
}) {
    // 🖥️ UI State
    const [isPanelOpen, setIsPanelOpen] = useState(true);

    return (
        <div className="fixed inset-0 z-50 bg-black flex animate-in fade-in duration-200 overflow-hidden">

            {/* 👈 Left: Image Stage (Flexible) */}
            <div
                className={`relative flex-1 h-full flex items-center justify-center bg-black/50 transition-all duration-300 ease-in-out min-w-0`}
                onClick={() => setSelectedIndex(-1)}
            >

                {/* Image Wrapper */}
                <div className="relative w-full h-full flex items-center justify-center p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={item.filePath || item.thumbnail || ""}
                        alt={item.title}
                        className="w-auto h-auto max-w-full max-h-[80vh] object-contain shadow-2xl drop-shadow-2xl cursor-default"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>

                {/* 🧭 Navigation Overlay (On the Stage) */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIndex((selectedIndex > 0 ? selectedIndex - 1 : itemsLength - 1));
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/30 hover:text-white hover:bg-white/10 rounded-full transition-all z-20 hidden md:block"
                >
                    <ChevronLeft size={48} />
                </button>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIndex((selectedIndex < itemsLength - 1 ? selectedIndex + 1 : 0));
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/30 hover:text-white hover:bg-white/10 rounded-full transition-all z-20 hidden md:block"
                >
                    <ChevronRight size={48} />
                </button>

                {/* 🔝 Floating Toolbar (Top Right of Stage) */}
                <div className="absolute top-4 right-4 flex items-center gap-2 z-30" onClick={(e) => e.stopPropagation()}>

                    {/* Toggle Panel Button */}
                    <button
                        onClick={() => setIsPanelOpen(!isPanelOpen)}
                        className={`p-2 rounded-full transition-all ${isPanelOpen ? 'bg-pink-600 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]' : 'bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700'}`}
                        title="Toggle Info Panel"
                    >
                        <Info size={20} />
                    </button>

                    {/* Close Button */}
                    <button
                        onClick={() => setSelectedIndex(-1)}
                        className="p-2 bg-zinc-800/50 hover:bg-red-500/80 text-zinc-400 hover:text-white rounded-full transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* 👉 Right: Info Sidebar (Collapsible) */}
            <div
                className={`
                    h-full bg-zinc-950 border-l border-zinc-900 shadow-2xl z-40 flex flex-col min-h-0
                    transition-all duration-300 ease-in-out origin-right
                    ${isPanelOpen ? 'w-[360px] opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-[100%] overflow-hidden border-none'}
                `}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 🏗️ Header Frame (Fixed Title Area) */}
                <div className="relative pt-20 px-6 pb-6 border-b border-zinc-900 shrink-0 bg-zinc-950 z-10 w-[360px]">

                    {/* Inner Close Button */}
                    <button
                        onClick={() => setIsPanelOpen(false)}
                        className="absolute top-6 right-6 p-2 bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white rounded-full transition-colors"
                        title="Close Panel"
                    >
                        <ChevronRight size={18} />
                    </button>

                    <h2 className="text-xl font-bold text-white leading-relaxed break-words pr-8">{item.title}</h2>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mt-2 font-mono">
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                    </div>
                </div>

                {/* 📜 Scrollable Content Frame */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 w-[360px]">

                    {/* Actions */}
                    <div className="flex gap-2 mb-8 shrink-0">
                        <a
                            href={item.url || item.filePath || "#"}
                            download
                            className="w-full py-3 bg-zinc-900 hover:bg-pink-600 border border-zinc-800 hover:border-pink-500 text-zinc-300 hover:text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-all"
                        >
                            <Download size={16} />
                            Download
                        </a>
                    </div>

                    {/* Tags */}
                    {item.tags.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-xs font-bold text-zinc-600 mb-3 uppercase tracking-wider">Tags</h3>
                            <div className="flex flex-wrap gap-2">
                                {item.tags.map(t => (
                                    <span key={t.id} className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 hover:border-pink-500/50 rounded-md text-xs text-zinc-400 hover:text-pink-400 transition-colors cursor-pointer">
                                        #{t.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    {item.description && (
                        <div className="mb-8">
                            <h3 className="text-xs font-bold text-zinc-600 mb-3 uppercase tracking-wider">Description</h3>
                            <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
                                    {item.description}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Meta Stats */}
                    <div className="pt-6 border-t border-zinc-900">
                        <h3 className="text-xs font-bold text-zinc-600 mb-3 uppercase tracking-wider">File Info</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-900/30 p-3 rounded-lg border border-zinc-800/30">
                                <span className="block text-[10px] text-zinc-600 mb-1">SIZE</span>
                                <span className="text-xs font-mono text-zinc-300">
                                    {item.size ? (Number(item.size) / (1024 * 1024)).toFixed(2) : "0"} MB
                                </span>
                            </div>
                            <div className="bg-zinc-900/30 p-3 rounded-lg border border-zinc-800/30">
                                <span className="block text-[10px] text-zinc-600 mb-1">TYPE</span>
                                <span className="text-xs font-mono text-zinc-300">IMAGE</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
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

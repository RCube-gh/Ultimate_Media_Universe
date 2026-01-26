"use client";

import { useState, useRef, useEffect } from "react";
import { Link as LinkIcon, Video, Book, Music, UploadCloud, Save, Image as ImageIcon, X, File, Film, FileAudio } from "lucide-react";
import axios from "axios";
import JSZip from "jszip";

export default function UploadPage() {
    const [activeType, setActiveType] = useState("LINK");
    const [targetUrl, setTargetUrl] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 📊 Progress State
    const [uploadProgress, setUploadProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState("");

    // 📂 Main File State (The content itself)
    const [mainFile, setMainFile] = useState<File | null>(null);

    // 🖼️ Thumbnail State
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

    // 🎵 Audio Track Management
    const [detectedTracks, setDetectedTracks] = useState<string[]>([]);
    const [trackTitles, setTrackTitles] = useState<Record<string, string>>({}); // Filename -> Title

    const pasteAreaRef = useRef<HTMLDivElement>(null);
    const dropZoneRef = useRef<HTMLDivElement>(null);

    // 🕵️‍♀️ Analyze ZIP for Audio Tracks
    useEffect(() => {
        if (activeType === "AUDIO" && mainFile && mainFile.name.toLowerCase().endsWith(".zip")) {
            console.log("🕵️‍♀️ Analyzing ZIP for tracks...");
            const processZip = async () => {
                try {
                    const zip = new JSZip();
                    const contents = await zip.loadAsync(mainFile);

                    const tracks: string[] = [];
                    // Filter audio files
                    contents.forEach((relativePath, zipEntry) => {
                        if (!zipEntry.dir && /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(relativePath)) {
                            // Only include top-level or clean paths? 
                            // Let's include all recursive paths for now, displayed as relative.
                            tracks.push(relativePath);
                        }
                    });

                    // Sort naturally
                    tracks.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

                    setDetectedTracks(tracks);

                    // Initialize Titles (Clean filename as default)
                    const initialTitles: Record<string, string> = {};
                    tracks.forEach(t => {
                        const filename = t.split(/[/\\]/).pop() || t;
                        let clean = filename.replace(/\.[^/.]+$/, ""); // remove ext
                        clean = clean.replace(/^\d+[\.\-\s]+/, ""); // remove leading "01."
                        initialTitles[t] = clean.trim();
                    });
                    setTrackTitles(prev => Object.keys(prev).length === 0 ? initialTitles : prev); // Keep existing unless empty

                } catch (e) {
                    console.error("Failed to read ZIP:", e);
                }
            };
            processZip();
        } else {
            setDetectedTracks([]);
            setTrackTitles({});
        }
    }, [mainFile, activeType]);

    // 📋 Paste Handler (Thumbnail)
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (!e.clipboardData) return;
            const items = e.clipboardData.items;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        const previewUrl = URL.createObjectURL(blob);
                        setThumbnailPreview(previewUrl);
                        setThumbnailFile(blob);
                        console.log("🖼️ Thumbnail pasted!", blob);
                        e.preventDefault();
                        break;
                    }
                }
            }
        };
        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, []);

    // 🖱️ Drag & Drop Handlers (Main File)
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            setMainFile(null);
            console.log("📂 Checking File:", file.name);

            // 🤖 Auto-Type Detection Logic
            const isVideo = file.type.startsWith("video");
            const isAudio = file.type.startsWith("audio");
            const isImage = file.type.startsWith("image");
            const isZip = file.name.endsWith(".zip") || file.name.endsWith(".cbz");

            let isValid = false;
            let errorMessage = "";

            switch (activeType) {
                case "VIDEO":
                    if (isVideo) isValid = true;
                    else errorMessage = "⚠️ Video mode: Only video files allowed.";
                    break;
                case "AUDIO":
                    if (isZip) isValid = true;
                    else errorMessage = "⚠️ Audio mode: Only ZIP files (Album) allowed.";
                    break;
                case "MANGA":
                    if (isZip) isValid = true;
                    else errorMessage = "⚠️ Manga mode: Only ZIP/CBZ archives allowed.";
                    break;
                case "IMAGE":
                    if (isImage) isValid = true;
                    else errorMessage = "⚠️ Image mode: Only image files allowed.";
                    break;
                case "LINK":
                    if (isImage) {
                        console.log("Setting Thumbnail for Link");
                        setThumbnailPreview(URL.createObjectURL(file));
                        setThumbnailFile(file);
                        return;
                    } else {
                        errorMessage = "⚠️ Link mode: Only images allowed (for thumbnail).";
                    }
                    break;
            }

            if (!isValid) {
                alert(errorMessage);
                return;
            }

            setMainFile(file);

            // Auto-fill title if file is Main
            if (!isImage || activeType !== "LINK") {
                const name = file.name.replace(/\.[^/.]+$/, "");
                const titleInput = document.querySelector('input[name="title"]') as HTMLInputElement;
                if (titleInput && !titleInput.value) titleInput.value = name;
            }
        }
    };

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        setUploadProgress(0);
        setStatusMessage("Starting Upload...");

        const formData = new FormData(event.currentTarget);
        formData.append("type", activeType);

        // URL or File
        if (mainFile) {
            formData.append("mainFile", mainFile);
        } else {
            formData.append("url", targetUrl);
        }

        // Thumbnail
        if (thumbnailFile) {
            formData.append("thumbnailFile", thumbnailFile);
        }

        // Track Titles (Audio ZIP)
        if (Object.keys(trackTitles).length > 0) {
            formData.append("trackTitles", JSON.stringify(trackTitles));
        }

        try {
            // 🚀 Use Axios for Progress Tracking!
            // We connect to our new API route instead of Server Action directly
            const response = await axios.post("/api/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setUploadProgress(percent);

                        if (percent < 100) {
                            setStatusMessage(`Uploading... ${percent}%`);
                        } else {
                            setStatusMessage("Processing on Server... (Unzipping & Scanning)");
                        }
                    }
                },
            });

            if (response.data.success) {
                setUploadProgress(100);
                setStatusMessage("Complete! 🎉");
                alert("Entry Saved! 💓\n" + response.data.message);

                // Reset ALL
                setTargetUrl("");
                setMainFile(null);
                setThumbnailPreview(null);
                setThumbnailFile(null);
                setUploadProgress(0);
                setStatusMessage("");
            } else {
                setStatusMessage("Failed.");
                alert("Error: " + response.data.message);
            }
        } catch (e: any) {
            console.error("💥 [Client] Upload Error:", e);

            // Detailed Error Extraction
            let errorMessage = e.message;
            if (e.response && e.response.data) {
                console.error("💥 [Server Response Data]:", e.response.data);
                errorMessage = e.response.data.message || JSON.stringify(e.response.data);
            }

            setStatusMessage("Error occurred during upload.");
            alert("Failed to upload:\n" + errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    }

    // 🎨 Status Icon based on type
    const getFileIcon = () => {
        if (activeType === "VIDEO") return Film;
        if (activeType === "AUDIO") return FileAudio;
        if (activeType === "IMAGE") return ImageIcon;
        if (activeType === "MANGA") return Book;
        return File;
    };
    const StatusIcon = getFileIcon();

    return (
        <div className="h-full flex flex-col md:flex-row bg-zinc-950 text-foreground overflow-hidden">

            {/* 👈 Left Panel: Drop Zone & Type Selector */}
            <div className="w-full md:w-1/2 p-6 flex flex-col gap-6 border-r border-white/5 animate-in slide-in-from-left duration-500">

                {/* Header */}
                <div className="shrink-0">
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <UploadCloud className="text-pink-500" />
                        <span>Omni Uploader</span>
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">
                        Drag & drop files (Videos, Images, ZIPs) or paste URLs.
                    </p>
                </div>

                {/* 🎛️ Type Selector */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 py-1">
                    {[
                        { id: "LINK", icon: LinkIcon, label: "Link" },
                        { id: "VIDEO", icon: Video, label: "Video" },
                        { id: "IMAGE", icon: ImageIcon, label: "Image" },
                        { id: "MANGA", icon: Book, label: "Manga" },
                        { id: "AUDIO", icon: Music, label: "Audio" }
                    ].map((type) => (
                        <button
                            key={type.id}
                            type="button"
                            onClick={() => setActiveType(type.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-sm font-bold whitespace-nowrap ${activeType === type.id
                                ? 'bg-pink-600 border-pink-500 text-white shadow-lg shadow-pink-900/50'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                                }`}
                        >
                            <type.icon size={16} />
                            {type.label}
                        </button>
                    ))}
                </div>

                {/* 📥 Drop Zone / URL Input (Expanded Area) */}
                <div
                    ref={dropZoneRef}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className={`flex-1 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-8 relative group cursor-text ${mainFile
                        ? 'bg-pink-500/10 border-pink-500'
                        : 'border-zinc-800 bg-black/20 hover:bg-zinc-900/50 hover:border-pink-500/30'
                        }`}
                    onClick={() => !mainFile && ((activeType === "MANGA" || activeType === "AUDIO") ? document.getElementById('zip-select')?.click() : document.getElementById('url-input')?.focus())}
                >
                    {/* Background Glow */}
                    {!mainFile && (
                        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-pink-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}

                    <div className="z-10 flex flex-col items-center gap-6 w-full max-w-md">

                        {/* 🚚 State: File Loaded */}
                        {mainFile ? (
                            <div className="animate-in zoom-in duration-300 flex flex-col items-center">
                                <div className="w-24 h-24 rounded-2xl bg-zinc-900 border border-pink-500/50 flex items-center justify-center shadow-2xl shadow-pink-500/20 mb-4">
                                    <StatusIcon className="w-10 h-10 text-pink-500" />
                                </div>
                                <h3 className="text-xl font-bold text-white text-center break-all line-clamp-2">
                                    {mainFile.name}
                                </h3>
                                <p className="text-pink-400 font-mono mt-1">
                                    {activeType === "MANGA" ? "Archive Selected" : `${(mainFile.size / (1024 * 1024)).toFixed(2)} MB`}
                                </p>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setMainFile(null); }}
                                    className="mt-6 px-4 py-2 bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 text-zinc-400 rounded-lg text-sm transition-colors"
                                >
                                    Remove File
                                </button>
                            </div>
                        ) : (
                            /* 🚚 State: Ready to Receive */
                            <div className="w-full space-y-2 text-center pointer-events-none">
                                <div className="w-20 h-20 mx-auto rounded-full bg-zinc-900/80 flex items-center justify-center border border-zinc-800 group-hover:scale-110 transition-transform duration-300 mb-6">
                                    <UploadCloud className="w-8 h-8 text-zinc-500 group-hover:text-pink-500 transition-colors" />
                                </div>

                                {activeType === "MANGA" || activeType === "AUDIO" ? (
                                    <>
                                        <div className="text-2xl text-white font-mono font-bold">
                                            Click to Select ZIP
                                        </div>
                                        <p className="text-zinc-500 text-sm">
                                            Upload a ZIP archive containing {activeType === "MANGA" ? "images" : "audio files"}
                                        </p>
                                    </>
                                ) : (
                                    <input
                                        id="url-input"
                                        type="text"
                                        placeholder="Paste URL or Drop File..."
                                        className="bg-transparent text-2xl text-center text-white placeholder-zinc-700 focus:outline-none w-full font-mono font-bold pointer-events-auto"
                                        value={targetUrl}
                                        onChange={(e) => setTargetUrl(e.target.value)}
                                        autoComplete="off"
                                    />
                                )}

                                <p className="text-zinc-600 text-sm pt-2">
                                    Make it yours forever.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Hidden Inputs for File Selection */}
                    <input
                        type="file"
                        className="hidden"
                        id="file-select"
                        onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                                setMainFile(e.target.files[0]);
                                const name = e.target.files[0].name.replace(/\.[^/.]+$/, "");
                                const titleInput = document.querySelector('input[name="title"]') as HTMLInputElement;
                                if (titleInput && !titleInput.value) titleInput.value = name;
                            }
                        }}
                    />
                    {/* ZIP Selection Input */}
                    <input
                        type="file"
                        className="hidden"
                        id="zip-select"
                        accept=".zip,.cbz,.rar,.7z"
                        onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                                setMainFile(e.target.files[0]);
                                const name = e.target.files[0].name.replace(/\.[^/.]+$/, "");
                                const titleInput = document.querySelector('input[name="title"]') as HTMLInputElement;
                                if (titleInput && !titleInput.value) titleInput.value = name;
                            }
                        }}
                    />

                    {!mainFile && activeType !== "MANGA" && activeType !== "AUDIO" && (
                        <button
                            type="button"
                            className="absolute bottom-4 text-xs text-zinc-700 hover:text-zinc-500 underline"
                            onClick={(e) => { e.stopPropagation(); document.getElementById('file-select')?.click(); }}
                        >
                            browse files manually
                        </button>
                    )}
                </div>

            </div>

            {/* 👉 Right Panel: Metadata & Preview */}
            <div className="w-full md:w-1/2 bg-zinc-900/30 flex flex-col p-8 animate-in slide-in-from-right duration-500 delay-100">
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-6">

                    {/* 🖼️ Thumbnail Preview Area (Hidden for Manga) */}
                    {activeType !== "MANGA" && (
                        <div
                            ref={pasteAreaRef}
                            className="aspect-video bg-zinc-950 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden group transition-all hover:border-pink-500/50 shrink-0"
                        >
                            {thumbnailPreview ? (
                                <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={thumbnailPreview} alt="Preview" className="w-full h-full object-cover" />

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setThumbnailPreview(null);
                                            setThumbnailFile(null);
                                        }}
                                        className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-red-500 transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <ImageIcon className="text-zinc-700 w-12 h-12 mb-2 group-hover:text-pink-500 transition-colors" />
                                    <span className="text-zinc-500 text-sm font-medium group-hover:text-zinc-300">Thumbnail Preview</span>
                                    <p className="text-zinc-600 text-xs mt-1">Ctrl+V to paste image</p>
                                </>
                            )}
                        </div>
                    )}

                    {/* Batch Upload Info Box (Manga/Audio) */}
                    {(activeType === "MANGA" || activeType === "AUDIO") && (
                        <div className="p-6 bg-pink-500/5 rounded-xl border border-pink-500/20">
                            <h3 className="text-pink-400 font-bold mb-2 flex items-center gap-2">
                                <Book size={18} /> {activeType} Upload Mode (ZIP)
                            </h3>
                            <p className="text-xs text-zinc-400">
                                Folder structure will be preserved.
                                Please upload a single ZIP or CBZ file.
                            </p>
                        </div>
                    )}

                    {/* Metadata Inputs */}
                    <div className="space-y-4 flex-1 flex flex-col">
                        <div>
                            <label className="text-xs font-bold text-zinc-500 ml-1">TITLE</label>
                            <input name="title" type="text" placeholder="Content title..." className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-lg text-white focus:outline-none focus:border-pink-500 transition-colors" required />
                        </div>

                        {/* URL Field (Shown for Manga mainly) */}
                        <div className={(activeType === "MANGA" || activeType === "AUDIO") ? "block" : "hidden"}>
                            <label className="text-xs font-bold text-zinc-500 ml-1">SOURCE URL</label>
                            <input name="source_url" type="url" placeholder="https://..." className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-pink-500 transition-colors font-mono" />
                        </div>

                        <div className="flex-1">
                            <label className="text-xs font-bold text-zinc-500 ml-1">MEMO</label>
                            <textarea name="description" placeholder="Write your thoughts..." className="w-full h-full min-h-[120px] bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-300 focus:outline-none focus:border-pink-500 transition-colors resize-none font-mono text-sm leading-relaxed" />
                        </div>
                    </div>

                    {/* 🎵 Audio Track Editor (ZIP Content) */}
                    {detectedTracks.length > 0 && (
                        <div className="flex flex-col gap-2 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 max-h-[300px] overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-2 fade-in">
                            <h3 className="text-pink-400 font-bold flex items-center gap-2 sticky top-0 bg-zinc-950/90 p-2 z-10 backdrop-blur-sm border-b border-white/5">
                                <Music size={16} /> Track List ({detectedTracks.length})
                            </h3>
                            <div className="space-y-3 mt-2">
                                {detectedTracks.map((track, idx) => (
                                    <div key={track} className="flex flex-col gap-1 text-sm group">
                                        <div className="flex items-center gap-2">
                                            <span className="text-zinc-500 font-mono text-xs w-6 shrink-0 text-right">{idx + 1}.</span>
                                            <input
                                                type="text"
                                                value={trackTitles[track] || ""}
                                                onChange={(e) => setTrackTitles(prev => ({ ...prev, [track]: e.target.value }))}
                                                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:border-pink-500 focus:outline-none transition-colors text-sm"
                                                placeholder="Track Title"
                                            />
                                        </div>
                                        <span className="text-[10px] text-zinc-600 pl-10 truncate font-mono select-all" title={track}>{track}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 📊 Progress Bar Area */}
                    {isSubmitting && (
                        <div className="animate-in fade-in zoom-in duration-300 space-y-2">
                            <div className="flex justify-between text-xs font-mono text-zinc-400 px-1">
                                <span>{statusMessage}</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-zinc-900 rounded-full h-3 overflow-hidden relative border border-zinc-800 shadow-inner">
                                <div
                                    className="h-full bg-gradient-to-r from-pink-600 to-purple-600 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(236,72,153,0.5)]"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-3 shrink-0">
                        <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-pink-600/20 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]">
                            {isSubmitting ? "Uploading..." : <><Save size={20} /> Upload to Library</>}
                        </button>
                    </div>

                </form>
            </div >
        </div >
    );
}

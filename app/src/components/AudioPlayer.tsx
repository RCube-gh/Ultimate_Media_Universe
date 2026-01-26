"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, ListMusic, Music2, Share2, Clock, Calendar, Maximize, Minimize, Settings as SettingsIcon, X, ChevronLeft, Disc, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { VideoActions } from "@/components/VideoActions"; // Import added

export type AudioTrack = {
    url: string;
    title: string;
    index: number;
};

interface AudioPlayerProps {
    id: string;
    tracks: AudioTrack[];
    images?: string[]; // Renamed from coverUrl
    title: string;
    description?: string;
    createdAt: Date;
    className?: string; // Keeping for compatibility but mostly unused now as we are full page
    viewCount: number;
    rating: number;
    isFavorite: boolean;
}

export default function AudioPlayer({ id, tracks, images = [], title, description, createdAt, viewCount, rating, isFavorite }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isLoop, setIsLoop] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);

    // 🖼️ Image Gallery State
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [viewMode, setViewMode] = useState<'art' | 'vinyl'>('art'); // Default to Art view

    const activeImage = images.length > 0 ? images[currentImageIndex] : undefined;

    // Interaction State
    const [isDragging, setIsDragging] = useState(false);
    const controlsTimeoutRef = useRef<NodeJS.Timeout>(null);

    const currentTrack = tracks[currentTrackIndex];

    // Image Navigation
    const nextImage = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (images.length > 1) {
            setCurrentImageIndex((prev) => (prev + 1) % images.length);
        }
    };
    const prevImage = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (images.length > 1) {
            setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
        }
    };

    // Auto Play Next
    const handleEnded = () => {
        if (isLoop) {
            audioRef.current?.play();
        } else if (currentTrackIndex < tracks.length - 1) {
            setCurrentTrackIndex(prev => prev + 1);
        } else {
            setIsPlaying(false);
        }
    };

    // Effect: Play when track changes
    useEffect(() => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.play().catch(console.error);
            }
        }
    }, [currentTrackIndex]);

    const formatTime = (s: number) => {
        if (isNaN(s)) return "0:00";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    // 👻 Controls Visibility Helper
    const showControlsTemporarily = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        if (isPlaying) {
            controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2000);
        }
    }, [isPlaying]);

    // Derived values
    const progressPercent = duration && duration > 0 ? (currentTime / duration) * 100 : 0;
    const volumePercent = isMuted ? 0 : volume * 100;

    // Handle Seeking
    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        setCurrentTime(time);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
        }
    };
    const handleSeekStart = () => setIsDragging(true);

    // End Dragging
    useEffect(() => {
        if (isDragging) {
            const handleGlobalUp = () => {
                setIsDragging(false);
            };
            window.addEventListener('mouseup', handleGlobalUp);
            window.addEventListener('touchend', handleGlobalUp);
            return () => {
                window.removeEventListener('mouseup', handleGlobalUp);
                window.removeEventListener('touchend', handleGlobalUp);
            };
        }
    }, [isDragging]);

    const togglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.paused) {
            audio.play();
            setIsPlaying(true);
        } else {
            audio.pause();
            setIsPlaying(false);
        }
    }, []);

    const toggleMute = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const nextMuted = !audio.muted;
        audio.muted = nextMuted;
        setIsMuted(nextMuted);
    }, []);

    const changeSpeed = useCallback((delta?: number, exact?: number) => {
        const audio = audioRef.current;
        if (!audio) return;

        let newRate;
        if (exact) {
            newRate = exact;
        } else if (delta) {
            newRate = Math.min(Math.max(audio.playbackRate + delta, 0.25), 3.0);
        } else {
            newRate = audio.playbackRate === 1 ? 1.5 : 1;
        }
        audio.playbackRate = newRate;
        setPlaybackRate(newRate);
        setShowSpeedMenu(false);
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement && containerRef.current) {
            containerRef.current.requestFullscreen().catch(console.error);
            setIsFullscreen(true);
        } else if (document.exitFullscreen) {
            document.exitFullscreen().catch(console.error);
            setIsFullscreen(false);
        }
    }, []);

    useEffect(() => {
        const handleFsChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", handleFsChange);
        return () => document.removeEventListener("fullscreenchange", handleFsChange);
    }, []);


    return (
        <div className="max-w-[1920px] mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">

            {/* =============================
                🎧 LEFT COLUMN (Player & Meta) 
                lg: span 2, xl: span 3
               ============================= */}
            <div className="lg:col-span-2 xl:col-span-3 flex flex-col gap-6">

                {/* 🎨 Visual Area */}
                <div
                    ref={containerRef}
                    className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl shadow-black border border-zinc-800 relative z-10 group select-none flex items-center justify-center transition-all"
                    onMouseMove={showControlsTemporarily}
                    onMouseLeave={() => isPlaying && setShowControls(false)}
                    onClick={togglePlay}
                >

                    {/* Background Blur (Always present for ambience) */}
                    {activeImage && (
                        <div
                            className="absolute inset-0 opacity-30 blur-3xl scale-110 z-0 pointer-events-none transition-transform duration-[20s] ease-linear"
                            style={{
                                backgroundImage: `url('${activeImage}')`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                transform: isPlaying && viewMode === 'vinyl' ? 'scale(1.2) rotate(5deg)' : 'scale(1.1)'
                            }}
                        />
                    )}

                    {/* Content Layer */}
                    <div className="relative z-10 w-full h-full flex items-center justify-center p-4 md:p-8">
                        {activeImage ? (
                            viewMode === 'art' ? (
                                // 🖼️ ART MODE: Full Clean Image
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={activeImage} alt="Jacket" className="w-full h-full object-contain pointer-events-none shadow-2xl drop-shadow-2xl" />
                            ) : (
                                // 💿 VINYL MODE: Spinning Disc
                                <div className={`relative w-[30vw] h-[30vw] max-w-[400px] max-h-[400px] aspect-square rounded-full shadow-2xl ring-4 ring-white/10 ${isPlaying ? 'animate-[spin_20s_linear_infinite]' : ''}`}>
                                    {/* Disc Texture */}
                                    <div className="absolute inset-0 rounded-full bg-black" />
                                    {/* Jacket Crop */}
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={activeImage} alt="Vinyl" className="absolute inset-0 w-full h-full object-cover rounded-full opacity-90" />
                                    {/* Vinyl Grooves (Optional Gradient) */}
                                    <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.5)_41%,rgba(0,0,0,0.5)_42%,transparent_43%)] opacity-50 pointer-events-none" />
                                    {/* Center Hole */}
                                    <div className="absolute inset-0 m-auto w-8 h-8 md:w-16 md:h-16 bg-zinc-950 rounded-full border border-zinc-800 flex items-center justify-center">
                                        <div className="w-2 h-2 bg-black rounded-full" />
                                    </div>
                                </div>
                            )
                        ) : (
                            // No Image Fallback
                            <div className="text-zinc-700 flex flex-col items-center animate-pulse">
                                <Music2 size={96} />
                                <span className="text-sm font-bold mt-4 tracking-widest opacity-50">NO IMAGE</span>
                            </div>
                        )}
                    </div>

                    {/* 🖼️ Gallery Controls (Hover Overlay) */}
                    {images.length > 1 && (
                        <>
                            <button
                                onClick={prevImage}
                                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-pink-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all z-20 backdrop-blur-sm"
                            >
                                <ChevronLeft size={24} />
                            </button>
                            <button
                                onClick={nextImage}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-pink-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all z-20 backdrop-blur-sm"
                            >
                                <ChevronLeft size={24} className="rotate-180" />
                            </button>
                            {/* Page Indicator */}
                            <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 backdrop-blur rounded-full text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                                {currentImageIndex + 1} / {images.length}
                            </div>
                        </>
                    )}

                    {/* Gradient Overlay for Controls */}
                    <div
                        className={`absolute bottom-0 left-0 right-0 px-4 pb-4 pt-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 z-40 flex flex-col justify-end ${showControls || !isPlaying ? "opacity-100" : "opacity-0"}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 📏 SEEK BAR */}
                        <div className="relative w-full h-2 group/seek cursor-pointer mb-4 flex items-center">
                            {/* Track */}
                            <div className="absolute inset-0 bg-white/20 rounded-full overflow-hidden">
                                {/* Progress */}
                                <div
                                    className="absolute top-0 left-0 h-full bg-pink-600 rounded-full pointer-events-none"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>

                            {/* Handle (Always Visible) */}
                            <div
                                className="absolute h-3 w-3 bg-pink-500 rounded-full shadow border border-white pointer-events-none transform -translate-x-1/2"
                                style={{ left: `${progressPercent}%` }}
                            />
                            {/* Input Hitbox */}
                            <input
                                type="range"
                                min="0" max={duration || 100} step="0.01"
                                value={currentTime}
                                onMouseDown={handleSeekStart}
                                onTouchStart={handleSeekStart}
                                onChange={handleSeek}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50"
                            />
                        </div>

                        {/* Controls Row */}
                        <div className="flex items-center justify-between text-white">
                            <div className="flex items-center gap-4">
                                <button onClick={togglePlay} className="hover:text-pink-500 transition-colors p-1">
                                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                                </button>

                                <button onClick={() => setCurrentTrackIndex(i => Math.max(0, i - 1))} className="hover:text-pink-500 transition-colors p-1">
                                    <SkipBack size={20} fill="currentColor" />
                                </button>
                                <button onClick={() => setCurrentTrackIndex(i => Math.min(tracks.length - 1, i + 1))} className="hover:text-pink-500 transition-colors p-1">
                                    <SkipForward size={20} fill="currentColor" />
                                </button>

                                {/* 🔊 VOLUME SLIDER */}
                                <div className="flex items-center gap-2 group/vol relative">
                                    <button onClick={toggleMute} className="hover:text-pink-500 transition-colors p-1">
                                        {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                                    </button>

                                    <div className="w-0 group-hover/vol:w-24 transition-all duration-300 h-10 flex items-center overflow-hidden">
                                        <div className="relative w-24 h-1 bg-white/30 rounded-full ml-1 mr-1">
                                            {/* Fill */}
                                            <div
                                                className="absolute top-0 left-0 h-full bg-pink-500 rounded-full pointer-events-none"
                                                style={{ width: `${volumePercent}%` }}
                                            />
                                            {/* Handle */}
                                            <div
                                                className="absolute h-3 w-3 top-[-4px] bg-white rounded-full shadow pointer-events-none transform -translate-x-1/2"
                                                style={{ left: `${volumePercent}%` }}
                                            />
                                            {/* Input Hitbox */}
                                            <input
                                                type="range" min="0" max="1" step="0.05"
                                                value={isMuted ? 0 : volume}
                                                onChange={(e) => {
                                                    const v = parseFloat(e.target.value);
                                                    setVolume(v);
                                                    if (audioRef.current) audioRef.current.volume = v;
                                                    setIsMuted(v === 0);
                                                }}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="text-sm font-mono font-medium text-zinc-300 select-none">
                                    {formatTime(currentTime)} / {formatTime(duration)}
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {/* Speed Menu */}
                                <div className="relative">
                                    {showSpeedMenu && (
                                        <div className="fixed inset-0 z-[65]" onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(false); }}></div>
                                    )}
                                    {showSpeedMenu && (
                                        <div className="absolute bottom-full right-0 mb-2 bg-black/90 border border-zinc-700 rounded-lg shadow-xl p-1 flex flex-col gap-0.5 min-w-[100px] z-[70] animate-in fade-in slide-in-from-bottom-2">
                                            {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                                                <button
                                                    key={rate}
                                                    onClick={(e) => { e.stopPropagation(); changeSpeed(undefined, rate); }}
                                                    className={`flex items-center justify-between px-3 py-2 text-sm rounded hover:bg-white/10 transition-colors ${playbackRate === rate ? "text-pink-500 font-bold" : "text-zinc-300"}`}
                                                >
                                                    <span>{rate === 1 ? "Normal" : `${rate}x`}</span>
                                                    {playbackRate === rate && <span>✔</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); }}
                                        className="text-xs font-bold text-zinc-400 hover:text-pink-500 bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-all min-w-[3rem] flex items-center justify-center"
                                    >
                                        {playbackRate === 1 ? "1.0x" : `${playbackRate}x`}
                                    </button>
                                </div>

                                {/* View Mode Toggle */}
                                <button
                                    onClick={() => setViewMode(prev => prev === 'art' ? 'vinyl' : 'art')}
                                    className={`p-1 transition-colors ${viewMode === 'vinyl' ? 'text-pink-500' : 'text-zinc-400 hover:text-white'}`}
                                    title="Toggle View Mode"
                                >
                                    {viewMode === 'art' ? <Disc size={20} /> : <ImageIcon size={20} />}
                                </button>

                                {/* Loop Button */}
                                <button
                                    onClick={() => setIsLoop(!isLoop)}
                                    className={`p-1 transition-colors ${isLoop ? 'text-pink-500' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    <Repeat size={20} />
                                </button>

                                <button onClick={toggleFullscreen} className="hover:text-pink-500 transition-colors p-1">
                                    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 📝 Metadata Block */}
                <div className="space-y-4 px-2">
                    <h1 className="text-2xl font-bold leading-tight text-white line-clamp-2">
                        {currentTrack?.title || title}
                    </h1>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Stats */}
                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                            <span className="text-white font-bold">{viewCount?.toLocaleString() || 0} views</span>
                            <span>•</span>
                            <span>{new Date(createdAt).toLocaleDateString()}</span>
                            <span className="flex items-center gap-1 ml-2 border-l border-white/10 pl-3">
                                <ListMusic size={14} /> {tracks.length} Tracks
                            </span>
                        </div>

                        {/* Actions Toolbar */}
                        <VideoActions
                            id={id}
                            initialLikes={rating}
                            initialIsFavorite={isFavorite}
                        />
                    </div>

                    <div className="bg-zinc-900/50 rounded-xl p-4 text-sm text-zinc-300 whitespace-pre-wrap hover:bg-zinc-900 transition-colors">
                        <div className="flex gap-2 font-bold mb-2">
                            <span>Album: {title}</span>
                        </div>
                        {description || "No description provided."}
                    </div>
                </div>

            </div>

            {/* =============================
                📑 RIGHT COLUMN (Playlist)
                span 1 (Sidebar)
               ============================= */}
            <div className="flex flex-col gap-6 h-[calc(100vh-100px)] sticky top-6">
                <div className="flex flex-col h-full bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-white/5 bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
                        <h3 className="font-bold text-zinc-200 flex items-center gap-2">
                            <ListMusic size={18} className="text-pink-500" />
                            Tracklist
                        </h3>
                    </div>

                    {/* Scrollable List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {tracks.map((track, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    setCurrentTrackIndex(i);
                                    setIsPlaying(true);
                                }}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all group ${i === currentTrackIndex
                                    ? 'bg-pink-500/10 border border-pink-500/20'
                                    : 'hover:bg-white/5 border border-transparent'
                                    }`}
                            >
                                {/* Play Status / Index */}
                                <div className="w-8 flex justify-center shrink-0">
                                    {i === currentTrackIndex ? (
                                        isPlaying ? (
                                            <div className="flex gap-0.5 items-end justify-center h-4 w-4 pb-1">
                                                <div className="w-1 bg-pink-500 animate-[music-bar_0.5s_ease-in-out_infinite]" style={{ animationDelay: '0ms' }} />
                                                <div className="w-1 bg-pink-500 animate-[music-bar_0.5s_ease-in-out_infinite]" style={{ animationDelay: '150ms' }} />
                                                <div className="w-1 bg-pink-500 animate-[music-bar_0.5s_ease-in-out_infinite]" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        ) : (
                                            <Pause size={16} className="text-pink-500 fill-current" />
                                        )
                                    ) : (
                                        <span className="text-xs font-mono text-zinc-600 group-hover:text-zinc-400">{i + 1}</span>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium truncate ${i === currentTrackIndex ? 'text-pink-400' : 'text-zinc-300 group-hover:text-white'}`}>
                                        {track.title}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <audio
                ref={audioRef}
                src={currentTrack?.url}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onEnded={handleEnded}
            />

            <style jsx>{`
                @keyframes music-bar {
                    0%, 100% { height: 20%; }
                    50% { height: 100%; }
                }
             `}</style>
        </div>
    );
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward } from "lucide-react";

interface VideoPlayerProps {
    src: string;
    poster?: string;
    className?: string;
}

export function VideoPlayer({ src, poster, className }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 📊 Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);

    // 🖱️ Interaction State (Fix for seeking conflict)
    const [isDragging, setIsDragging] = useState(false);

    // ✨ Overlay Feedback State
    const [feedbackIcon, setFeedbackIcon] = useState<"play" | "pause" | "volume" | "forward" | "backward" | null>(null);
    const feedbackTimeoutRef = useRef<NodeJS.Timeout>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout>(null);

    // Helper: Trigger Feedback
    const triggerFeedback = useCallback((type: "play" | "pause" | "volume" | "forward" | "backward") => {
        setFeedbackIcon(type);
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = setTimeout(() => setFeedbackIcon(null), 600);
    }, []);

    // 🎮 Core Logic
    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        if (video.paused) {
            video.play();
            triggerFeedback("play");
        } else {
            video.pause();
            triggerFeedback("pause");
        }
    }, [triggerFeedback]);

    // Handle Input Range Change (User Dragging)
    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        setCurrentTime(time);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
        }
    };

    // Start Dragging
    const handleSeekStart = () => setIsDragging(true);

    // End Dragging (Handled globally via useEffect to catch 'mouseup' anywhere)
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


    const skipTime = useCallback((seconds: number) => {
        const video = videoRef.current;
        if (!video || !video.duration) return;

        const newTime = Math.min(Math.max(video.currentTime + seconds, 0), video.duration);
        video.currentTime = newTime;
        setCurrentTime(newTime);

        triggerFeedback(seconds > 0 ? "forward" : "backward");
    }, [triggerFeedback]);

    const toggleMute = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        const nextMuted = !video.muted;
        video.muted = nextMuted;
        setIsMuted(nextMuted);
        if (!nextMuted && video.volume === 0) {
            video.volume = 0.5;
            setVolume(0.5);
        }
    }, []);

    // 🎹 Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeEl = document.activeElement as HTMLElement;
            const isInput = activeEl?.tagName.toLowerCase() === 'input';
            const isTextArea = activeEl?.tagName.toLowerCase() === 'textarea';

            if (isTextArea) return;
            if (isInput) {
                const inputType = (activeEl as HTMLInputElement).type;
                if (['text', 'password', 'email', 'search', 'number', 'url'].includes(inputType)) {
                    return;
                }
            }

            const video = videoRef.current;
            if (!video) return;

            switch (e.key.toLowerCase()) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'f':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'm':
                    e.preventDefault();
                    toggleMute();
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    skipTime(-5);
                    break;
                case 'arrowright':
                    e.preventDefault();
                    skipTime(5);
                    break;
                case 'j':
                    e.preventDefault();
                    skipTime(-10);
                    break;
                case 'l':
                    e.preventDefault();
                    skipTime(10);
                    break;
                case 'arrowup':
                    e.preventDefault();
                    if (video.volume < 1) video.volume = Math.min(1, video.volume + 0.1);
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    if (video.volume > 0) video.volume = Math.max(0, video.volume - 0.1);
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [togglePlay, skipTime, toggleMute]);

    // Fullscreen Toggle
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement && containerRef.current) {
            containerRef.current.requestFullscreen().catch(console.error);
            setIsFullscreen(true);
        } else if (document.exitFullscreen) {
            document.exitFullscreen().catch(console.error);
            setIsFullscreen(false);
        }
    }, []);

    // ⏳ Event Listeners
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const updateTime = () => {
            if (!isDragging) {
                setCurrentTime(video.currentTime);
            }
        };
        const updateDuration = () => {
            if (video.duration && !isNaN(video.duration)) {
                setDuration(video.duration);
            }
        };
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onVolumeChange = () => {
            setVolume(video.volume);
            setIsMuted(video.muted);
        };

        video.addEventListener("timeupdate", updateTime);
        video.addEventListener("loadedmetadata", updateDuration);
        video.addEventListener("durationchange", updateDuration); // Add durationchange too
        video.addEventListener("play", onPlay);
        video.addEventListener("pause", onPause);
        video.addEventListener("volumechange", onVolumeChange);

        // 🚀 CRITICAL FIX: Check manually immediately in case events fired already
        if (video.readyState >= 1) { // HAVE_METADATA
            updateDuration();
        }
        if (video.currentTime > 0) {
            setCurrentTime(video.currentTime);
        }

        return () => {
            video.removeEventListener("timeupdate", updateTime);
            video.removeEventListener("loadedmetadata", updateDuration);
            video.removeEventListener("durationchange", updateDuration);
            video.removeEventListener("play", onPlay);
            video.removeEventListener("pause", onPause);
            video.removeEventListener("volumechange", onVolumeChange);
        };
    }, [isDragging]);

    // 👻 Mouse Movement
    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        if (isPlaying) {
            controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2000);
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Derived values
    const progressPercent = duration && duration > 0 ? (currentTime / duration) * 100 : 0;
    const volumePercent = isMuted ? 0 : volume * 100;

    return (
        <div
            ref={containerRef}
            className={`relative bg-black group overflow-hidden select-none flex items-center justify-center ${className}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
            onClick={() => togglePlay()}
        >
            <video
                ref={videoRef}
                src={src}
                className="w-full h-full object-contain focus:outline-none"
                poster={poster}
                playsInline
                autoPlay
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            />

            {feedbackIcon && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
                    <div className="bg-black/50 text-white rounded-full p-6 animate-in fade-in zoom-in duration-200 backdrop-blur-sm">
                        {feedbackIcon === "play" && <Play size={48} fill="currentColor" />}
                        {feedbackIcon === "pause" && <Pause size={48} fill="currentColor" />}
                        {feedbackIcon === "forward" && <SkipForward size={48} fill="currentColor" />}
                        {feedbackIcon === "backward" && <SkipBack size={48} fill="currentColor" />}
                    </div>
                </div>
            )}

            <div
                className={`absolute bottom-0 left-0 right-0 px-4 pb-4 pt-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 z-40 flex flex-col justify-end ${showControls || !isPlaying ? "opacity-100" : "opacity-0"
                    }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 📏 SEEK BAR */}
                <div className="relative w-full h-2 group/seek cursor-pointer mb-4 flex items-center">
                    {/* Track */}
                    <div className="absolute inset-0 bg-white/20 rounded-full"></div>
                    {/* Progress */}
                    <div
                        className="absolute top-0 left-0 h-full bg-pink-600 rounded-full pointer-events-none"
                        style={{ width: `${progressPercent}%` }}
                    />
                    {/* Handle (Always Visible) */}
                    <div
                        className="absolute h-3 w-3 bg-pink-500 rounded-full shadow border border-white pointer-events-none transform -translate-x-1/2"
                        style={{ left: `${progressPercent}%` }}
                    />
                    {/* Input Hitbox */}
                    <input
                        type="range"
                        min="0"
                        max={duration || 100} // Fallback to 100 to prevent range collapse
                        step="0.01"
                        value={currentTime}
                        onMouseDown={handleSeekStart}
                        onTouchStart={handleSeekStart}
                        onChange={handleSeek}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50"
                    />
                </div>

                <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-4">
                        <button onClick={togglePlay} className="hover:text-pink-500 transition-colors p-1">
                            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
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
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={isMuted ? 0 : volume}
                                        onChange={(e) => {
                                            const v = parseFloat(e.target.value);
                                            if (videoRef.current) {
                                                videoRef.current.volume = v;
                                                videoRef.current.muted = v === 0;
                                            }
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
                        <button onClick={toggleFullscreen} className="hover:text-pink-500 transition-colors p-1">
                            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

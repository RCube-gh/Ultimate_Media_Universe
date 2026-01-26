"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward, Settings as SettingsIcon, X, Trash2 } from "lucide-react";
import { SettingsForm } from "./SettingsForm";
import { useSettings } from "@/hooks/useSettings";

interface VideoPlayerProps {
    id: string; // MediaItem ID for markers
    src: string;
    poster?: string;
    className?: string;
    initialLastPos?: number;
    serverDuration?: number; // Needed for resume check
}

type Marker = {
    id: string;
    time: number;
    label: string;
    icon: string;
};

// Global debounce set for view counting (React Strict Mode fix)
const recentViewers = new Set<string>();

export function VideoPlayer({ id, src, poster, className, initialLastPos = 0, serverDuration = 0 }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // ⚙️ User Settings
    const { settings } = useSettings();

    // 📊 Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    // 🖱️ Interaction State (Fix for seeking conflict)
    const [isDragging, setIsDragging] = useState(false);
    const controlsTimeoutRef = useRef<NodeJS.Timeout>(null);

    // 📍 Markers State
    const [markers, setMarkers] = useState<Marker[]>([]);
    const [isMarkerModalOpen, setIsMarkerModalOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, markerId: string } | null>(null);
    const [markerLabel, setMarkerLabel] = useState("");
    const [markerIcon, setMarkerIcon] = useState("💦"); // Default

    // 🌐 Close Context Menu on Click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener("click", handleClick);
        return () => window.removeEventListener("click", handleClick);
    }, []);

    // 🔁 AB Loop State
    const [loopStart, setLoopStart] = useState<number | null>(null);
    const [loopEnd, setLoopEnd] = useState<number | null>(null);

    // 💾 Resume State
    const [showResumeToast, setShowResumeToast] = useState(false);
    const lastSaveTimeRef = useRef(0);

    // 🧬 Fetch Markers
    useEffect(() => {
        if (!id) return;
        fetch(`/api/media/${id}/markers`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setMarkers(data);
            })
            .catch(err => console.error("Failed to load markers", err));
    }, [id]);

    // 🗑️ Delete Marker
    const deleteMarker = async (markerId: string) => {
        // Optimistic Update
        setMarkers(prev => prev.filter(m => m.id !== markerId));

        try {
            await fetch(`/api/markers/${markerId}`, { method: "DELETE" });

            // Trigger Event for Stats Update
            const event = new CustomEvent("fapflix-trigger-action", {
                detail: { type: "delete", id: markerId }
            });
            window.dispatchEvent(event);

        } catch (e) {
            console.error("Failed to delete marker", e);
            // Revert could be added here if needed, but low priority for now
        }
    };

    // ✨ Overlay Feedback State
    // ✨ Overlay Feedback State
    const [feedbackState, setFeedbackState] = useState<{ content: React.ReactNode, mode?: "default" | "fullscreen", isExiting?: boolean } | null>(null);
    const feedbackTimeoutRef = useRef<NodeJS.Timeout>(null);

    const triggerFeedback = useCallback((content: React.ReactNode, options?: { duration?: number, mode?: "default" | "fullscreen" }) => {
        // 1. Reset
        setFeedbackState({ content, mode: options?.mode || "default", isExiting: false });
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);

        // 2. Schedule Exit (Fade Out)
        const totalDuration = options?.duration || 800;
        const exitDuration = 500;
        const visibleDuration = Math.max(totalDuration - exitDuration, 0);

        feedbackTimeoutRef.current = setTimeout(() => {
            // Trigger Exit Animation
            setFeedbackState(prev => prev ? { ...prev, isExiting: true } : null);

            // 3. Final Unmount (Track this timeout too!)
            feedbackTimeoutRef.current = setTimeout(() => {
                setFeedbackState(null);
            }, exitDuration);
        }, visibleDuration);
    }, []);

    // ✨ Feedback Helper
    const showMarkerFeedback = useCallback((icon: string, label: string, isExplicitAction: boolean = false) => {
        // Normalize icon check
        // Show Splash ONLY if icon matches AND it was triggered via Quick Action (Explicit)
        if (icon && icon.includes("💦") && isExplicitAction) {
            // 💦 SPLASH MODE
            triggerFeedback(
                <div className="relative flex items-center justify-center w-full h-full overflow-hidden">
                    {/* Ripple 1 */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-[10px] h-[10px] bg-blue-500 rounded-full animate-in zoom-in-[0] duration-[3000ms] fade-out-0 fill-mode-forwards opacity-0"
                            style={{ animationFillMode: 'forwards', animationName: 'enter-ripple' }}></div>
                        {/* Fallback using pure style if tailwind fails */}
                        <div
                            className="absolute bg-blue-500/50 rounded-full"
                            style={{
                                width: '10px', height: '10px',
                                animation: 'ripple 3s cubic-bezier(0, 0, 0.2, 1) forwards',
                            }}
                        />
                        <style>{`
                            @keyframes ripple {
                                0% { transform: scale(1); opacity: 0.8; }
                                100% { transform: scale(300); opacity: 0; }
                            }
                         `}</style>
                    </div>

                    {/* Ripple 2 (Delayed) */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div
                            className="absolute bg-cyan-400/30 rounded-full"
                            style={{
                                width: '10px', height: '10px',
                                animation: 'ripple 3s cubic-bezier(0, 0, 0.2, 1) 0.2s forwards',
                            }}
                        />
                    </div>

                    <div className="relative z-10 flex flex-col items-center animate-in zoom-in-50 duration-500">
                        <span className="text-8xl filter drop-shadow-[0_0_25px_rgba(59,130,246,1)] animate-bounce">{icon}</span>
                        <span className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-blue-400 mt-4 drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] animate-pulse">SPLASH!</span>
                    </div>
                </div>,
                { duration: 3050, mode: "fullscreen" }
            );
        } else {
            // ✨ STANDARD HIGHLIGHT MODE
            triggerFeedback(
                <div className="flex flex-col items-center animate-in slide-in-from-bottom-4 duration-1000">
                    <span className="text-5xl drop-shadow-lg animate-[pulse_1s_ease-in-out_infinite]">{icon}</span>
                    <span className="text-sm font-bold bg-white/10 border border-white/20 backdrop-blur-md px-3 py-1 rounded-full mt-2 shadow-lg tracking-wider">
                        {label || "Saved"}
                    </span>
                </div>,
                { duration: 2500 }
            );
        }
    }, [triggerFeedback]);

    // 💾 Save Marker
    const saveMarker = async () => {
        if (!videoRef.current || !id) return;

        const time = videoRef.current.currentTime;
        // Use local variable to capture current state before async
        const currentIcon = markerIcon;
        const currentLabel = markerLabel;
        const newMarker = { time, label: currentLabel, icon: currentIcon };

        try {
            const res = await fetch(`/api/media/${id}/markers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newMarker),
            });

            if (res.ok) {
                const saved = await res.json();
                setMarkers(prev => [...prev, saved].sort((a, b) => a.time - b.time));
                setIsMarkerModalOpen(false);
                setMarkerLabel("");
                setIsPlaying(true); // Resume
                videoRef.current.play();

                // 🔥 Trigger Consistent Feedback (Manual = Standard)
                showMarkerFeedback(currentIcon, currentLabel, false);
            }
        } catch (e) {
            console.error("Failed to save marker", e);
        }
    };

    // 👻 Controls Visibility Helper
    const showControlsTemporarily = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        if (isPlaying) {
            controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2000);
        }
    }, [isPlaying]);

    // 🎮 Core Logic
    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        if (video.paused) {
            video.play();
            triggerFeedback(<Play size={48} fill="currentColor" />);
        } else {
            video.pause();
            triggerFeedback(<Pause size={48} fill="currentColor" />);
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

        triggerFeedback(seconds > 0 ? <SkipForward size={48} fill="currentColor" /> : <SkipBack size={48} fill="currentColor" />);
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

    const changeSpeed = useCallback((delta?: number, exact?: number) => {
        const video = videoRef.current;
        if (!video) return;

        let newRate;
        if (exact) {
            newRate = exact;
        } else if (delta) {
            // Increment/Decrement mode
            newRate = Math.min(Math.max(video.playbackRate + delta, 0.25), 3.0);
        } else {
            // Cycle mode (UI Click) - fallback
            newRate = video.playbackRate === 1 ? 1.5 : 1;
        }

        video.playbackRate = newRate;
        setPlaybackRate(newRate);
        setShowSpeedMenu(false); // Close menu
        triggerFeedback(
            <div className="flex flex-col items-center">
                <span className="text-3xl font-bold">{newRate}x</span>
                <span className="text-xs">Speed</span>
            </div>
        );
    }, [triggerFeedback]);

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

            // Show controls on any valid interaction
            showControlsTemporarily();

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
                case 'escape':
                    if (isMarkerModalOpen) {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsMarkerModalOpen(false);
                        setIsPlaying(true);
                        if (videoRef.current) videoRef.current.play();
                    }
                    break;
                case 'p':
                    e.preventDefault();
                    if (videoRef.current) {
                        if (isMarkerModalOpen) {
                            // Close
                            setIsMarkerModalOpen(false);
                            setIsPlaying(true);
                            videoRef.current.play();
                        } else {
                            // Open
                            videoRef.current.pause();
                            setIsPlaying(false);
                            setMarkerLabel("");
                            setIsMarkerModalOpen(true);
                        }
                    }
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
                case '>':
                case '.':
                    if (e.shiftKey) {
                        e.preventDefault();
                        changeSpeed(0.25);
                    }
                    break;
                case '<':
                case ',':
                    if (e.shiftKey) {
                        e.preventDefault();
                        changeSpeed(-0.25);
                    }
                    break;
                case 'a':
                    // Set Loop Start
                    if (videoRef.current) {
                        setLoopStart(videoRef.current.currentTime);
                        triggerFeedback(
                            <div className="flex flex-col items-center">
                                <span className="text-4xl font-bold">A</span>
                                <span className="text-sm">Loop Start</span>
                            </div>
                        );
                    }
                    break;
                case 'b':
                    // Set Loop End
                    if (videoRef.current) {
                        setLoopEnd(videoRef.current.currentTime);
                        triggerFeedback(
                            <div className="flex flex-col items-center">
                                <span className="text-4xl font-bold">B</span>
                                <span className="text-sm">Loop End</span>
                            </div>
                        );
                    }
                    break;
                case '\\':
                case 'delete':
                case 'backspace':
                case 'c':
                    // Clear Loop
                    if (loopStart !== null || loopEnd !== null) {
                        setLoopStart(null);
                        setLoopEnd(null);
                        triggerFeedback(
                            <div className="flex flex-col items-center">
                                <span className="text-4xl font-bold">🗑️</span>
                                <span className="text-sm">Loop Cleared</span>
                            </div>
                        );
                    }
                    break;
                default:
                    // Numeric Seeking (0-9)
                    if (!isNaN(parseInt(e.key)) && e.key.length === 1) {
                        e.preventDefault();
                        const percent = parseInt(e.key) / 10;
                        if (videoRef.current && duration) {
                            const newTime = duration * percent;
                            videoRef.current.currentTime = newTime;
                            setCurrentTime(newTime);
                            triggerFeedback(
                                <div className="flex flex-col items-center">
                                    <span className="text-3xl font-bold">{parseInt(e.key) * 10}%</span>
                                </div>
                            );
                        }
                    }
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [togglePlay, skipTime, toggleMute, isMarkerModalOpen, loopStart, loopEnd, showControlsTemporarily]);

    // Fullscreen Toggle

    // Fullscreen Toggle
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

    // Sync Fullscreen State (Browser driven)
    useEffect(() => {
        const handleFsChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", handleFsChange);
        return () => document.removeEventListener("fullscreenchange", handleFsChange);
    }, []);

    // 💾 Resume Logic (On Mount)
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // 1. Check if "Finished" (Near end)
        // If last pos is within 15s of end OR > 95% watched
        const isNearEnd = serverDuration > 0 && (
            initialLastPos > serverDuration - 15 ||
            initialLastPos > serverDuration * 0.95
        );

        if (isNearEnd) {
            // Treat as finished -> Start from 0
            video.currentTime = 0;
            setCurrentTime(0);
            // Optional: Update DB to 0 immediately so it sticks
            fetch(`/api/media/${id}/progress`, {
                method: "POST",
                body: JSON.stringify({ time: 0 }),
            }).catch(console.error);
            return;
        }


        // 2. Normal Resume (Check Settings)
        const savedConfig = localStorage.getItem("fapflix-config");
        let shouldResume = true;
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig);
                if (parsed.autoResume === false) shouldResume = false;
            } catch (e) { /* ignore */ }
        }

        if (shouldResume && initialLastPos > 5) {
            video.currentTime = initialLastPos;
            setCurrentTime(initialLastPos);
            setShowResumeToast(true);

            // Hide toast after 8s
            const timer = setTimeout(() => setShowResumeToast(false), 8000);
            return () => clearTimeout(timer);
        }
    }, [initialLastPos, serverDuration, id]);

    // 💾 Progress Saving Helper
    const saveProgress = useCallback((time: number) => {
        fetch(`/api/media/${id}/progress`, {
            method: "POST",
            body: JSON.stringify({ time }),
        }).catch(e => console.error("Save progress failed", e));
        lastSaveTimeRef.current = time;
    }, [id]);

    // 💾 Save on Interval (Crash Protection) & Pause
    useEffect(() => {
        if (!isPlaying) return;
        const interval = setInterval(() => {
            const video = videoRef.current;
            if (video && Math.abs(video.currentTime - lastSaveTimeRef.current) > 2) {
                saveProgress(video.currentTime);
            }
        }, 3000); // Check every 3s
        return () => clearInterval(interval);
    }, [isPlaying, saveProgress]);

    // 📊 View Counter (Debounced for Strict Mode)
    useEffect(() => {
        if (recentViewers.has(id)) return;

        recentViewers.add(id);
        fetch(`/api/media/${id}/view`, { method: "POST" }).catch(console.error);

        // Allow counting again after 2 seconds (e.g. if user refreshes manually)
        setTimeout(() => recentViewers.delete(id), 2000);
    }, [id]);

    // ⚡ Quick Action Listener (from VideoActions)
    useEffect(() => {
        const handleAction = (e: Event) => {
            const detail = (e as CustomEvent).detail; // { label, icon }
            const video = videoRef.current;
            if (!video || !id) return;

            const time = video.currentTime;

            // 1. Save Marker
            fetch(`/api/media/${id}/markers`, {
                method: "POST",
                body: JSON.stringify({
                    time,
                    label: detail.label,
                    icon: detail.icon
                })
            }).then(() => {
                // 2. Refresh Markers
                fetch(`/api/media/${id}/markers`)
                    .then(r => r.json())
                    .then(data => setMarkers(data));
            });

            // 3. Visual Feedback (Unified)
            showMarkerFeedback(detail.icon, detail.label, true);
        };

        window.addEventListener("fapflix-trigger-action", handleAction);
        return () => window.removeEventListener("fapflix-trigger-action", handleAction);
    }, [id, triggerFeedback]);

    // ⏳ Event Listeners
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const updateTime = () => {
            if (!isDragging) {
                const t = video.currentTime;
                // 🔁 Loop Check
                if (loopStart !== null && loopEnd !== null && loopEnd > loopStart) {
                    if (t >= loopEnd) {
                        video.currentTime = loopStart;
                        setCurrentTime(loopStart);
                        return;
                    }
                }
                setCurrentTime(t);
            }
        };
        const updateDuration = () => {
            if (video.duration && !isNaN(video.duration)) {
                setDuration(video.duration);
            }
        };
        const onPlay = () => setIsPlaying(true);
        const onPause = () => {
            setIsPlaying(false);
            if (video) saveProgress(video.currentTime); // 💾 Save immediately on pause
        };
        const onVolumeChange = () => {
            setVolume(video.volume);
            setIsMuted(video.muted);
        };
        const onRateChange = () => setPlaybackRate(video.playbackRate);

        video.addEventListener("timeupdate", updateTime);
        video.addEventListener("loadedmetadata", updateDuration);
        video.addEventListener("durationchange", updateDuration); // Add durationchange too
        video.addEventListener("play", onPlay);
        video.addEventListener("pause", onPause);
        video.addEventListener("volumechange", onVolumeChange);
        video.addEventListener("ratechange", onRateChange);

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
            video.removeEventListener("ratechange", onRateChange);
        };
    }, [isDragging, loopStart, loopEnd]);

    // 👻 Mouse Movement
    const handleMouseMove = () => showControlsTemporarily();

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

            {/* 📍 Marker Creation Modal */}
            {isMarkerModalOpen && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-zinc-900 border border-pink-500/50 p-6 rounded-2xl shadow-2xl w-full max-w-sm space-y-4">
                        <h3 className="text-white font-bold text-lg flex items-center gap-2">
                            <span>📍</span> Add Scene Marker
                        </h3>

                        {/* Emoji Picker (Simple) */}
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                            {(settings ? JSON.parse(settings.markerIcons) : ["💦", "👄", "🍑", "🐄", "🦶", "💕", "🚀", "🛑"]).map((emoji: string) => (
                                <button
                                    key={emoji}
                                    onClick={() => setMarkerIcon(emoji)}
                                    className={`text-2xl p-2 rounded-lg transition-colors ${markerIcon === emoji ? "bg-pink-600" : "bg-zinc-800 hover:bg-zinc-700"}`}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>

                        <input
                            type="text"
                            placeholder="Label (optional)..."
                            className="w-full bg-black/50 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:border-pink-500 outline-none"
                            value={markerLabel}
                            onChange={(e) => setMarkerLabel(e.target.value)}
                            onKeyDown={(e) => {
                                e.stopPropagation(); // Stop bubbling to global
                                if (e.key === 'Enter') saveMarker();
                                if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setIsMarkerModalOpen(false);
                                    if (videoRef.current) {
                                        setIsPlaying(true);
                                        videoRef.current.play();
                                    }
                                }
                            }}
                        />

                        <div className="flex justify-end gap-2 text-sm">
                            <button onClick={() => setIsMarkerModalOpen(false)} className="px-4 py-2 text-zinc-400 hover:text-white">Cancel</button>
                            <button onClick={saveMarker} className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-bold">Save Marker</button>
                        </div>
                    </div>
                </div>
            )}

            {feedbackState && (
                <div
                    className={`absolute inset-0 flex items-center justify-center z-[100] ${feedbackState.mode === "fullscreen" ? "pointer-events-none overflow-hidden" : "pointer-events-none"}`}
                    style={{
                        transition: 'opacity 500ms ease-out, transform 500ms ease-out',
                        opacity: feedbackState.isExiting ? 0 : 1,
                        transform: feedbackState.isExiting ? 'scale(0.95)' : 'scale(1)',
                    }}
                >
                    {feedbackState.mode === "fullscreen" ? (
                        // Fullscreen Mode (No Container)
                        <div className="w-full h-full flex items-center justify-center animate-in fade-in duration-300">
                            {feedbackState.content}
                        </div>
                    ) : (
                        // Default Mode (Dark Box)
                        <div className="bg-black/70 text-white rounded-2xl p-6 animate-in fade-in zoom-in duration-200 backdrop-blur-sm shadow-2xl border border-white/10">
                            {feedbackState.content}
                        </div>
                    )}
                </div>
            )}

            {/* 💾 Resume Toast */}
            {showResumeToast && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[90] animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-zinc-900/90 border border-pink-500/30 backdrop-blur-md text-white pl-6 pr-2 py-0 rounded-full shadow-2xl flex items-center gap-4 h-12">
                        <div className="flex flex-col py-1">
                            <span className="text-xs text-pink-200 font-bold">Resumed from {formatTime(initialLastPos || 0)}</span>
                            <span className="text-[10px] text-zinc-400">Welcome back!</span>
                        </div>
                        <div className="h-8 w-[1px] bg-white/20"></div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (videoRef.current) {
                                    videoRef.current.currentTime = 0;
                                    setCurrentTime(0);
                                    setShowResumeToast(false);
                                    triggerFeedback(
                                        <div className="flex flex-col items-center">
                                            <span className="text-3xl font-bold">↺</span>
                                            <span className="text-xs">Replay</span>
                                        </div>
                                    );
                                }
                            }}
                            className="text-sm font-bold hover:text-pink-400 hover:bg-white/10 -my-3 py-3 px-3 transition-colors flex items-center gap-2 rounded-r-full"
                        >
                            <span className="text-lg">↺</span>
                            <span>Start Over</span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowResumeToast(false); }}
                            className="ml-2 text-zinc-500 hover:text-white"
                        >
                            ✕
                        </button>
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
                    <div className="absolute inset-0 bg-white/20 rounded-full overflow-hidden">
                        {/* 🔁 Loop Region */}
                        {loopStart !== null && loopEnd !== null && loopEnd > loopStart && (
                            <div
                                className="absolute top-0 bottom-0 bg-blue-500/60 pointer-events-none z-10"
                                style={{
                                    left: `${(loopStart / (duration || 1)) * 100}%`,
                                    width: `${((loopEnd - loopStart) / (duration || 1)) * 100}%`
                                }}
                            />
                        )}
                        {/* Loop Start Point (A) */}
                        {loopStart !== null && (
                            <div
                                className="absolute top-0 bottom-0 w-0.5 bg-blue-400 z-20 pointer-events-none"
                                style={{ left: `${(loopStart / (duration || 1)) * 100}%` }}
                            />
                        )}
                        {/* Loop End Point (B) */}
                        {loopEnd !== null && (
                            <div
                                className="absolute top-0 bottom-0 w-0.5 bg-blue-400 z-20 pointer-events-none"
                                style={{ left: `${(loopEnd / (duration || 1)) * 100}%` }}
                            />
                        )}
                    </div>

                    {/* 📍 Markers Layer (Outside overflow-hidden) */}
                    <div className="absolute inset-0 pointer-events-none">
                        {markers.map(m => (
                            <div
                                key={m.id}
                                // Hitbox Container (Wider than visible marker)
                                className="absolute top-0 bottom-0 w-4 -ml-2 z-[60] flex items-center justify-center cursor-pointer group/marker pointer-events-auto"
                                style={{ left: `${(m.time / (duration || 1)) * 100}%` }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (videoRef.current) {
                                        videoRef.current.currentTime = m.time;
                                        setCurrentTime(m.time);
                                        videoRef.current.play();
                                    }
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setContextMenu({ x: e.clientX, y: e.clientY, markerId: m.id });
                                }}
                            >
                                {/* Visual Marker (Inner) */}
                                <div className={`w-1 h-full rounded-full shadow-sm transition-all duration-200 group-hover/marker:w-1.5 group-hover/marker:h-[120%] 
                                    ${m.icon === "💦"
                                        ? "bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.6)] group-hover/marker:bg-cyan-100 group-hover/marker:shadow-[0_0_12px_rgba(34,211,238,1)]"
                                        : "bg-yellow-400 group-hover/marker:bg-pink-400 group-hover/marker:shadow-pink-500/50"
                                    }`}></div>
                                {/* Tooltip (Unified Box Mode) */}
                                <div className={`absolute bottom-0 pb-8 left-1/2 -translate-x-1/2 transition-all duration-200 z-[100] text-shadow-sm
                                    ${contextMenu?.markerId === m.id
                                        ? "opacity-100 translate-y-0 pointer-events-auto"
                                        : "opacity-0 translate-y-2 group-hover/marker:opacity-100 group-hover/marker:translate-y-0 pointer-events-none group-hover/marker:pointer-events-auto"
                                    }`}>
                                    <div className="bg-zinc-900/90 backdrop-blur-md border border-pink-500/30 p-3 rounded-xl shadow-2xl flex flex-col items-center gap-1 min-w-[100px]">
                                        {/* Big Emoji */}
                                        <div className="text-4xl drop-shadow-md pb-1 relative group/icon">
                                            {m.icon}
                                        </div>

                                        {/* Info */}
                                        <div className="flex flex-col items-center border-t border-white/10 w-full pt-1">
                                            <span className="font-bold text-pink-200 text-sm whitespace-nowrap">{m.label}</span>
                                            <span className="text-[10px] text-zinc-400 font-mono tracking-wider">
                                                {Math.floor(m.time / 60)}:{Math.floor(m.time % 60).toString().padStart(2, '0')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 🖱️ Context Menu */}
                    {contextMenu && (
                        <div
                            className="fixed z-[9999] bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden min-w-[120px] animate-in fade-in zoom-in duration-100"
                            style={{ top: contextMenu.y, left: contextMenu.x }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseLeave={() => setContextMenu(null)}
                        >
                            <button
                                onClick={() => {
                                    deleteMarker(contextMenu.markerId);
                                    setContextMenu(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/10 hover:text-red-300 flex items-center gap-2"
                            >
                                <Trash2 size={14} />
                                <span>Delete</span>
                            </button>
                        </div>
                    )}
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
                        {/* ⏩ Playback Speed Menu */}
                        <div className="relative">
                            {/* Backdrop for click outside */}
                            {showSpeedMenu && (
                                <div
                                    className="fixed inset-0 z-[65]"
                                    onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(false); }}
                                ></div>
                            )}

                            {showSpeedMenu && (
                                <div className="absolute bottom-full right-0 mb-2 bg-black/90 border border-zinc-700 rounded-lg shadow-xl p-1 flex flex-col gap-0.5 min-w-[100px] z-[70] animate-in fade-in slide-in-from-bottom-2">
                                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                                        <button
                                            key={rate}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                changeSpeed(undefined, rate);
                                            }}
                                            className={`flex items-center justify-between px-3 py-2 text-sm rounded hover:bg-white/10 transition-colors ${playbackRate === rate ? "text-pink-500 font-bold" : "text-zinc-300"}`}
                                        >
                                            <span>{rate === 1 ? "Normal" : `${rate}x`}</span>
                                            {playbackRate === rate && <span>✔</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowSpeedMenu(!showSpeedMenu);
                                }}
                                className="text-xs font-bold text-zinc-400 hover:text-pink-500 bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-all min-w-[3rem] flex items-center justify-center"
                            >
                                {playbackRate === 1 ? "1.0x" : `${playbackRate}x`}
                            </button>
                        </div>

                        {/* ⚙️ Settings Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsSettingsModalOpen(true);
                                setIsPlaying(false); // Pause when settings open
                                if (videoRef.current) videoRef.current.pause();
                            }}
                            className="hover:text-pink-500 transition-colors p-1"
                        >
                            <SettingsIcon size={20} />
                        </button>
                        <button onClick={toggleFullscreen} className="hover:text-pink-500 transition-colors p-1">
                            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                        </button>
                    </div>
                </div>
            </div >

            {/* ⚙️ Settings Modal */}
            {
                isSettingsModalOpen && (
                    <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in" onClick={(e) => { e.stopPropagation(); setIsSettingsModalOpen(false); }}>
                        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-8 relative" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={() => setIsSettingsModalOpen(false)}
                                className="absolute top-4 right-4 p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                <span className="text-pink-500">⚙️</span> Settings & Preferences
                            </h2>

                            <SettingsForm />
                        </div>
                    </div>
                )
            }
        </div >
    );
}

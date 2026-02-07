"use client";


import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, ListMusic, Music2, Share2, Clock, Calendar, Maximize, Minimize, Settings as SettingsIcon, X, ChevronLeft, Disc, Image as ImageIcon, MapPin, Eye } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { useSettings } from "@/hooks/useSettings";
import { VideoActions } from "@/components/VideoActions";

type Marker = {
    id: string;
    time: number;
    label: string;
    icon: string;
};



export type AudioTrack = {
    url: string;
    title: string;
    index: number;
    duration?: number;
};

// Simplified type for recommendations to avoid circular deps or full Prisma type requirement
type RecommendedItem = {
    id: string;
    title: string;
    thumbnail: string | null;
    duration: number | null;
    viewCount: number;
    createdAt: Date;
};

interface AudioPlayerProps {
    id: string;
    tracks: AudioTrack[];
    images?: string[];
    title: string;
    description?: string;
    createdAt: Date;
    className?: string;
    viewCount: number;
    rating: number;
    isFavorite: boolean;
    children?: React.ReactNode;
    recommendations?: RecommendedItem[];
}

// Global debounce for view counting
const recentViewers = new Set<string>();

export default function AudioPlayer({ id, tracks, images = [], title, description, createdAt, viewCount, rating, isFavorite, children, recommendations = [], initialLastPos = 0 }: AudioPlayerProps & { initialLastPos?: number }) {
    // 📊 View Counter
    useEffect(() => {
        if (!id || recentViewers.has(id)) return;

        recentViewers.add(id);
        fetch(`/umu/api/media/${id}/view`, { method: "POST" }).catch(console.error);

        // Allow counting again after 2 seconds
        setTimeout(() => recentViewers.delete(id), 2000);
    }, [id]);

    const { settings, loading: settingsLoading } = useSettings(); // Move up to be accessible

    const audioRef = useRef<HTMLAudioElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isLoop, setIsLoop] = useState(false);
    const [loopStart, setLoopStart] = useState<number | null>(null);
    const [loopEnd, setLoopEnd] = useState<number | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [showResumeToast, setShowResumeToast] = useState(false); // Resume Toast

    // 💾 Progress Saving Helper (Encodes Track Index)
    const lastSaveTimeRef = useRef(0);
    const saveProgress = useCallback((time: number, trackIdx: number) => {
        // Encode track index in time (microseconds approach or large offset)
        // Offset: 1,000,000 (allows ~277 hours per track, sufficient)
        const encodedTime = (trackIdx * 1000000) + time;

        fetch(`/umu/api/media/${id}/progress`, {
            method: "POST",
            body: JSON.stringify({ time: encodedTime }),
        }).catch(e => console.error("Save progress failed", e));
        lastSaveTimeRef.current = time;
    }, [id]);

    // 💾 Resume Logic (On Mount)
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || settingsLoading) return; // Wait for settings

        // Check Settings
        const shouldResume = settings ? settings.autoResume : false; // Default false if not set/loading finished? actually loading handled above

        if (shouldResume && initialLastPos > 1) {
            // Decode
            const trackIdx = Math.floor(initialLastPos / 1000000);
            const time = initialLastPos % 1000000;

            if (trackIdx >= 0 && trackIdx < tracks.length) {
                setCurrentTrackIndex(trackIdx);
                // We need to wait for track to change? 
                // Setting state queues re-render. 
                // We can set time immediately but audio.src needs to update first.
                // React state update is batched.
                // We might need a separate effect or just set it here assuming fast render.
                // Actually, if we set track index, the audio src changes.
                // We should store the 'pendingResumeTime' to apply after track loads.
            }

            if (time > 5) {
                // Defer setting time until metadata loaded for new track?
                // Or just set state
                setCurrentTime(time);
                // We will use a ref or effect to apply this to audio element once it's ready/src changes
                setShowResumeToast(true);
                setTimeout(() => setShowResumeToast(false), 8000);
            }
        }
    }, [initialLastPos, settings, settingsLoading, tracks.length]);

    // Apply Resume Time after Track Change
    const pendingResumeApplied = useRef(false);
    useEffect(() => {
        // If we have a resume target and haven't applied it to the actual element
        const audio = audioRef.current;
        if (!audio || pendingResumeApplied.current) return;

        const trackIdx = Math.floor(initialLastPos / 1000000);
        const time = initialLastPos % 1000000;
        const shouldResume = settings && settings.autoResume;

        if (shouldResume && trackIdx === currentTrackIndex && time > 5) {
            // Only apply if ready?
            // We can try setting it.
            if (Math.abs(audio.currentTime - time) > 1) {
                audio.currentTime = time;
                pendingResumeApplied.current = true;
            }
        }
    }, [currentTrackIndex, initialLastPos, settings]);

    // 💾 Save on Interval & Pause
    useEffect(() => {
        if (!isPlaying) return;
        const interval = setInterval(() => {
            const audio = audioRef.current;
            if (audio && Math.abs(audio.currentTime - lastSaveTimeRef.current) > 2) {
                saveProgress(audio.currentTime, currentTrackIndex);
            }
        }, 5000); // Check every 5s for audio
        return () => clearInterval(interval);
    }, [isPlaying, saveProgress, currentTrackIndex]);



    // 🖼️ Image Gallery State
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [viewMode, setViewMode] = useState<'art' | 'vinyl'>('art'); // Default to Art view

    const activeImage = images.length > 0 ? images[currentImageIndex] : undefined;

    // Interaction State
    const [isDragging, setIsDragging] = useState(false);
    const controlsTimeoutRef = useRef<NodeJS.Timeout>(null);

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
            setFeedbackState(prev => prev ? { ...prev, isExiting: true } : null);
            feedbackTimeoutRef.current = setTimeout(() => {
                setFeedbackState(null);
            }, exitDuration);
        }, visibleDuration);
    }, []);

    const showMarkerFeedback = useCallback((icon: string, label: string, isExplicitAction: boolean = false) => {
        // Always usage Splash for the Quick Button (Explicit Action)
        if (isExplicitAction) {
            // 💦 SPLASH MODE
            triggerFeedback(
                <div className="relative flex items-center justify-center w-full h-full overflow-hidden bg-black/20 backdrop-blur-[2px]">
                    {/* Ripple 1 */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-[10px] h-[10px] bg-blue-500 rounded-full"
                            style={{
                                animation: 'audio-ripple 3s cubic-bezier(0, 0, 0.2, 1) forwards',
                            }}
                        />
                        <style>{`
                            @keyframes audio-ripple {
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
                                animation: 'audio-ripple 3s cubic-bezier(0, 0, 0.2, 1) 0.2s forwards',
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
                <div className="flex flex-col items-center animate-in slide-in-from-bottom-4 duration-1000 bg-black/60 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-2xl">
                    <span className="text-6xl drop-shadow-lg animate-[pulse_1s_ease-in-out_infinite] mb-2">{icon}</span>
                    <span className="text-xl font-bold text-white tracking-wider">
                        {label || "Saved"}
                    </span>
                </div>,
                { duration: 2500 }
            );
        }
    }, [triggerFeedback]);

    // 📍 Markers State
    // settings already imported above
    const [markers, setMarkers] = useState<Marker[]>([]);
    const [isMarkerModalOpen, setIsMarkerModalOpen] = useState(false);
    const [markerLabel, setMarkerLabel] = useState("");
    const [markerIcon, setMarkerIcon] = useState("💦");

    // 🧬 Fetch Markers
    useEffect(() => {
        if (!id) return;
        fetch(`/umu/api/media/${id}/markers`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setMarkers(data);
            })
            .catch(err => console.error("Failed to load markers", err));
    }, [id]);

    // 💾 Save Marker
    const saveMarker = async () => {
        if (!audioRef.current || !id) return;
        const time = audioRef.current.currentTime;
        try {
            const res = await fetch(`/umu/api/media/${id}/markers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ time, label: markerLabel, icon: markerIcon }),
            });
            if (res.ok) {
                const saved = await res.json();
                setMarkers(prev => [...prev, saved].sort((a, b) => a.time - b.time));
                setIsMarkerModalOpen(false);
                setMarkerLabel("");
                setMarkerIcon("💦"); // Reset but keep user pref ideally, but hard to obtain sync without settings hook full usage

                // 🔥 Trigger Feedback
                showMarkerFeedback(markerIcon, markerLabel, false);
            }
        } catch (e) { console.error(e); }
    };

    // 🗑️ Delete Marker
    const deleteMarker = async (markerId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setMarkers(prev => prev.filter(m => m.id !== markerId));
        try {
            await fetch(`/umu/api/markers/${markerId}`, { method: "DELETE" });
        } catch (e) { console.error(e); }
    };

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


    // ⚡ Quick Action Listener (from VideoActions)
    useEffect(() => {
        const handleAction = (e: Event) => {
            const detail = (e as CustomEvent).detail; // { label, icon }
            const audio = audioRef.current;
            if (!audio || !id) return;

            const time = audio.currentTime;

            // 1. Save Marker
            fetch(`/umu/api/media/${id}/markers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    time,
                    label: detail.label,
                    icon: detail.icon
                })
            }).then(res => res.json()).then(saved => {
                setMarkers(prev => [...prev, saved].sort((a, b) => a.time - b.time));
            });

            // 2. Visual Feedback
            showMarkerFeedback(detail.icon, detail.label, true);
        };

        window.addEventListener("fapflix-trigger-action", handleAction);
        return () => window.removeEventListener("fapflix-trigger-action", handleAction);
    }, [id, showMarkerFeedback]);

    // 🎧 Event Listeners (Robust Duration & Time)
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => {
            if (!isDragging) {
                const t = audio.currentTime;
                // 🔁 Loop Check
                if (loopStart !== null && loopEnd !== null && loopEnd > loopStart) {
                    if (t >= loopEnd) {
                        audio.currentTime = loopStart;
                        setCurrentTime(loopStart);
                        return;
                    }
                }
                setCurrentTime(t);
            }
        };
        const updateDuration = () => {
            // 0 or Infinity check
            if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
                setDuration(audio.duration);
            }
        };
        const onPlay = () => setIsPlaying(true);
        const onPause = () => {
            setIsPlaying(false);
            if (audio) saveProgress(audio.currentTime, currentTrackIndex);
        };
        const onEnded = () => {
            // AB Loop shouldn't hit ended technically if set correctly, but if loopEnd is end of track...
            if (loopStart !== null && loopEnd !== null && loopEnd > loopStart) {
                audio.currentTime = loopStart;
                audio.play();
                return;
            }

            if (isLoop) {
                audio.currentTime = 0;
                audio.play();
            } else if (currentTrackIndex < tracks.length - 1) {
                setCurrentTrackIndex(prev => prev + 1);
            } else {
                setIsPlaying(false);
            }
        };

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('durationchange', updateDuration);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);

        // 🚀 Critical Initial Check
        if (audio.readyState >= 1) {
            updateDuration();
        }

        // Auto-play logic handled here strictly
        if (isPlaying) {
            audio.play().catch(() => setIsPlaying(false));
        }

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('durationchange', updateDuration);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onEnded);
        };
    }, [currentTrackIndex, isDragging, isLoop, tracks.length, loopStart, loopEnd]); // Re-run when track changes to re-attach and check readyState

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



    // 🎮 Core Logic (Hoisted for Keyboard)
    const togglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.paused) {
            audio.play();
            setIsPlaying(true);
            triggerFeedback(
                <div className="flex flex-col items-center bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in fade-in duration-200">
                    <Play size={48} fill="currentColor" />
                </div>
            );
        } else {
            audio.pause();
            setIsPlaying(false);
            triggerFeedback(
                <div className="flex flex-col items-center bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in fade-in duration-200">
                    <Pause size={48} fill="currentColor" />
                </div>
            );
        }
    }, [triggerFeedback]);

    const toggleMute = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const nextMuted = !audio.muted;
        audio.muted = nextMuted;
        setIsMuted(nextMuted);
        triggerFeedback(
            <div className="flex flex-col items-center bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in fade-in duration-200">
                {nextMuted ? <VolumeX size={48} /> : <Volume2 size={48} />}
            </div>
        );
    }, [triggerFeedback]);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement && containerRef.current) {
            containerRef.current.requestFullscreen().catch(console.error);
            setIsFullscreen(true);
        } else if (document.exitFullscreen) {
            document.exitFullscreen().catch(console.error);
            setIsFullscreen(false);
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

            const audio = audioRef.current;
            if (!audio) return;

            // Show controls on any valid interaction
            showControlsTemporarily();

            switch (e.key.toLowerCase()) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    if (audio.paused) {
                        audio.play();
                        setIsPlaying(true);
                        triggerFeedback(
                            <div className="flex flex-col items-center bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in fade-in duration-200">
                                <Play size={48} fill="currentColor" />
                            </div>
                        );
                    } else {
                        audio.pause();
                        setIsPlaying(false);
                        triggerFeedback(
                            <div className="flex flex-col items-center bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in fade-in duration-200">
                                <Pause size={48} fill="currentColor" />
                            </div>
                        );
                    }
                    break;
                case 'f':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'm':
                    // Mute
                    e.preventDefault();
                    toggleMute();
                    break;
                case 'escape':
                    if (isMarkerModalOpen) {
                        e.preventDefault();
                        setIsMarkerModalOpen(false);
                    }
                    break;
                case 'p':
                    // Toggle Marker Modal
                    e.preventDefault();
                    if (isMarkerModalOpen) {
                        setIsMarkerModalOpen(false);
                    } else {
                        setIsMarkerModalOpen(true);
                        setMarkerLabel("");
                    }
                    break;
                case 'a':
                    // Set Loop Start
                    if (audio) {
                        setLoopStart(audio.currentTime);
                        triggerFeedback(
                            <div className="flex flex-col items-center bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in fade-in duration-200">
                                <span className="text-4xl font-bold">A</span>
                                <span className="text-sm text-zinc-200 mt-2">Loop Start</span>
                            </div>
                        );
                    }
                    break;
                case 'b':
                    // Set Loop End
                    if (audio) {
                        setLoopEnd(audio.currentTime);
                        triggerFeedback(
                            <div className="flex flex-col items-center bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in fade-in duration-200">
                                <span className="text-4xl font-bold">B</span>
                                <span className="text-sm text-zinc-200 mt-2">Loop End</span>
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
                            <div className="flex flex-col items-center bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in fade-in duration-200">
                                <span className="text-4xl font-bold">🗑️</span>
                                <span className="text-sm text-zinc-200 mt-2">Loop Cleared</span>
                            </div>
                        );
                    }
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    audio.currentTime = Math.max(0, audio.currentTime - 5);
                    triggerFeedback(
                        <div className="flex flex-col items-center bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in fade-in duration-200">
                            <SkipBack size={48} />
                            <span className="text-sm font-bold mt-2">-5s</span>
                        </div>
                    );
                    break;
                case 'arrowright':
                    e.preventDefault();
                    audio.currentTime = Math.min(duration || 10000, audio.currentTime + 5);
                    triggerFeedback(
                        <div className="flex flex-col items-center bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in fade-in duration-200">
                            <SkipForward size={48} />
                            <span className="text-sm font-bold mt-2">+5s</span>
                        </div>
                    );
                    break;
                case 'j':
                    e.preventDefault();
                    audio.currentTime = Math.max(0, audio.currentTime - 10);
                    triggerFeedback(
                        <div className="flex flex-col items-center bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in fade-in duration-200">
                            <SkipBack size={48} />
                            <span className="text-sm font-bold mt-2">-10s</span>
                        </div>
                    );
                    break;
                case 'l':
                    e.preventDefault();
                    audio.currentTime = Math.min(duration || 10000, audio.currentTime + 10);
                    triggerFeedback(
                        <div className="flex flex-col items-center bg-black/60 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-2xl animate-in zoom-in fade-in duration-200">
                            <SkipForward size={48} />
                            <span className="text-sm font-bold mt-2">+10s</span>
                        </div>
                    );
                    break;
                case 'arrowup':
                    e.preventDefault();
                    setVolume(v => {
                        const next = Math.min(1, v + 0.1);
                        if (audio) audio.volume = next;
                        return next;
                    });
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    setVolume(v => {
                        const next = Math.max(0, v - 0.1);
                        if (audio) audio.volume = next;
                        return next;
                    });
                    break;
                default:
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [togglePlay, toggleMute, toggleFullscreen, isMarkerModalOpen, duration, showControlsTemporarily, loopStart, loopEnd, triggerFeedback]);

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
                                <img src={activeImage.startsWith('/') ? `/umu${activeImage}` : activeImage} alt="Jacket" className="w-full h-full object-contain pointer-events-none shadow-2xl drop-shadow-2xl" />
                            ) : (
                                // 💿 VINYL MODE: Spinning Disc
                                <div className={`relative w-[30vw] h-[30vw] max-w-[400px] max-h-[400px] aspect-square rounded-full shadow-2xl ring-4 ring-white/10 ${isPlaying ? 'animate-[spin_20s_linear_infinite]' : ''}`}>
                                    {/* Disc Texture */}
                                    <div className="absolute inset-0 rounded-full bg-black" />
                                    {/* Jacket Crop */}
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={activeImage.startsWith('/') ? `/umu${activeImage}` : activeImage} alt="Vinyl" className="absolute inset-0 w-full h-full object-cover rounded-full opacity-90" />
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

                    {/* ✨ FEEDBACK OVERLAY */}
                    {feedbackState && (
                        <div className={`absolute inset-0 z-[100] flex items-center justify-center pointer-events-none transition-opacity duration-500 ${feedbackState.isExiting ? 'opacity-0' : 'opacity-100'}`}>
                            {feedbackState.content}
                        </div>
                    )}

                    {/* � Resume Toast */}
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
                                        if (audioRef.current) {
                                            audioRef.current.currentTime = 0;
                                            setCurrentTime(0);
                                            setShowResumeToast(false);
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

                    {/* �📍 Marker Modal */}
                    {isMarkerModalOpen && (
                        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={(e) => e.stopPropagation()}>
                            <div className="bg-zinc-900 border border-pink-500/50 p-6 rounded-2xl shadow-2xl w-full max-w-sm space-y-4">
                                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                    <span>📍</span> Add Scene Marker
                                </h3>

                                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                    {(settings?.markerIcons ? JSON.parse(settings.markerIcons) : ["💦", "👄", "🍑", "🐄", "🦶", "💕", "🚀", "🛑"]).map((emoji: string) => (
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
                                    value={markerLabel}
                                    onChange={(e) => setMarkerLabel(e.target.value)}
                                    placeholder="Label (e.g. Chorus, Solo)..."
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-pink-500"
                                    onKeyDown={(e) => {
                                        e.stopPropagation();
                                        if (e.key === 'Enter') saveMarker();
                                        if (e.key === 'Escape') setIsMarkerModalOpen(false);
                                    }}
                                />

                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setIsMarkerModalOpen(false)}
                                        className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={saveMarker}
                                        className="px-6 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold shadow-lg shadow-pink-600/20"
                                    >
                                        Save Marker
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

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
                        <div className="relative w-full h-2 group/seek cursor-pointer mb-4">
                            {/* Track */}
                            <div className="absolute inset-0 bg-white/20 rounded-full overflow-hidden">
                                {/* Progress */}
                                <div
                                    className="absolute top-0 left-0 h-full bg-pink-600 rounded-full pointer-events-none"
                                    style={{ width: `${progressPercent}%` }}
                                />

                                {/* 🔁 Loop Region */}
                                {loopStart !== null && loopEnd !== null && loopEnd > loopStart && (
                                    <div
                                        className="absolute top-0 bottom-0 bg-blue-500/60 pointer-events-none z-[5]"
                                        style={{
                                            left: `${(loopStart / (duration || 1)) * 100}%`,
                                            width: `${((loopEnd - loopStart) / (duration || 1)) * 100}%`
                                        }}
                                    />
                                )}
                                {/* Loop Start Point (A) */}
                                {loopStart !== null && (
                                    <div
                                        className="absolute top-0 bottom-0 w-0.5 bg-blue-400 z-[15] pointer-events-none"
                                        style={{ left: `${(loopStart / (duration || 1)) * 100}%` }}
                                    />
                                )}
                                {/* Loop End Point (B) */}
                                {loopEnd !== null && (
                                    <div
                                        className="absolute top-0 bottom-0 w-0.5 bg-blue-400 z-[15] pointer-events-none"
                                        style={{ left: `${(loopEnd / (duration || 1)) * 100}%` }}
                                    />
                                )}

                                {/* 📍 Markers on Track */}
                                {markers.map(m => {
                                    const isQuick = m.icon === (settings ? settings.quickActionIcon : "💦") || m.label === (settings ? settings.quickActionLabel : "Cum");
                                    return (
                                        <div
                                            key={m.id}
                                            className={`absolute top-0 w-1 h-full z-10 pointer-events-none opacity-70 ${isQuick ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" : "bg-yellow-400"}`}
                                            style={{ left: `${(m.time / (duration || 1)) * 100}%` }}
                                        />
                                    );
                                })}
                            </div>

                            {/* Handle (Always Visible) */}
                            <div
                                className="absolute h-3 w-3 bg-pink-500 rounded-full shadow border border-white pointer-events-none transform -translate-x-1/2 z-20"
                                style={{ left: `${progressPercent}%` }}
                            />

                            {/* 📍 Interactive Marker Hover Points */}
                            {markers.map(m => (
                                <div
                                    key={`hover-${m.id}`}
                                    className="absolute top-1/2 -translate-y-1/2 w-4 h-6 -ml-2 z-[60] group/marker cursor-pointer flex items-center justify-center transition-transform"
                                    style={{ left: `${(m.time / (duration || 1)) * 100}%` }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (audioRef.current) {
                                            audioRef.current.currentTime = m.time;
                                            setCurrentTime(m.time);
                                        }
                                    }}
                                >
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-black/80 border border-white/10 text-white p-3 rounded-xl shadow-2xl backdrop-blur-md opacity-0 group-hover/marker:opacity-100 pointer-events-none transition-all duration-300 transform translate-y-2 group-hover/marker:translate-y-0 flex flex-col items-center gap-1 min-w-[80px] z-[100]">
                                        <span className="text-3xl filter drop-shadow-lg">{m.icon}</span>
                                        <span className="text-sm font-bold text-zinc-100 whitespace-nowrap">{m.label}</span>
                                        <span className="text-[10px] font-mono text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded mt-1">{formatTime(m.time)}</span>
                                    </div>
                                </div>
                            ))}

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

                                {/* Marker Button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsMarkerModalOpen(true);
                                    }}
                                    className="p-1 transition-colors text-zinc-400 hover:text-pink-500"
                                    title="Add Marker (M)"
                                >
                                    <MapPin size={20} />
                                </button>

                                <button onClick={toggleFullscreen} className="hover:text-pink-500 transition-colors p-1">
                                    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 🎵 Track Info & Custom Content (MediaInfo) */}
                <div className="space-y-6">
                    {/* Now Playing Title */}
                    <div className="px-2">
                        <div className="text-xs font-bold text-pink-500 uppercase tracking-widest mb-1">Now Playing</div>
                        <h2 className="text-xl md:text-2xl font-bold text-white leading-tight line-clamp-2">
                            {currentTrack?.title || "Unknown Track"}
                        </h2>
                    </div>

                    <div className="px-2">
                        <VideoActions
                            id={id}
                            initialLikes={rating}
                            initialIsFavorite={isFavorite}
                        />
                    </div>

                    {/* Injected Content (MediaInfo) */}
                    {children}
                </div>

            </div>

            {/* =============================
                📑 RIGHT COLUMN (Playlist)
                span 1 (Sidebar)
               ============================= */}
            <div className="flex flex-col gap-6">

                {/* 🎼 Tracklist */}
                <div className="flex flex-col bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-white/5 bg-zinc-900/80 backdrop-blur sticky top-0 z-10 shrink-0">
                        <h3 className="font-bold text-zinc-200 flex items-center gap-2">
                            <ListMusic size={18} className="text-pink-500" />
                            Tracklist
                        </h3>
                    </div>

                    {/* List */}
                    <div className="p-2 space-y-1">
                        {tracks.map((track, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    setCurrentTrackIndex(i);
                                    setIsPlaying(true);
                                }}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all group shrink-0 ${i === currentTrackIndex
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
                                {/* Duration */}
                                <div className="text-xs font-mono text-zinc-500">
                                    {track.duration ? formatTime(track.duration) : ""}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 🎧 Recommendations (Up Next) */}
                {recommendations.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <h3 className="font-bold text-sm text-zinc-400 px-1">Up Next</h3>
                        <div className="flex flex-col gap-2">
                            {recommendations.map((rec) => (
                                <Link key={rec.id} href={`/audio/${rec.id}`} className="flex gap-3 group p-2 rounded-xl hover:bg-white/5 transition-colors bg-zinc-900/30 border border-transparent hover:border-zinc-800">
                                    {/* Thumb */}
                                    <div className="w-24 aspect-video bg-zinc-900 rounded-lg overflow-hidden relative shrink-0">
                                        {rec.thumbnail ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={rec.thumbnail?.startsWith('/') ? `/umu${rec.thumbnail}` : rec.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-700">
                                                <Music2 size={16} />
                                            </div>
                                        )}
                                    </div>
                                    {/* Info */}
                                    <div className="flex flex-col gap-1 min-w-0 justify-center">
                                        <h4 className="font-bold text-sm leading-tight line-clamp-2 text-zinc-200 group-hover:text-pink-400 transition-colors">
                                            {rec.title}
                                        </h4>
                                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                                            <div className="flex items-center gap-1">
                                                <Eye className="w-3 h-3" />
                                                {rec.viewCount}
                                            </div>
                                            <span>•</span>
                                            <span>{rec.duration ? formatTime(rec.duration) : "--:--"}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <audio
                ref={audioRef}
                src={currentTrack?.url?.startsWith('/') ? `/umu${currentTrack.url}` : currentTrack?.url}
            />

            <style jsx>{`
                @keyframes music-bar {
                    0%, 100% { height: 20%; }
                    50% { height: 100%; }
                }
             `}</style>
        </div >
    );
}

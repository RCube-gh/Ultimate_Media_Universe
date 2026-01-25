"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ChevronLeft, ChevronRight, X, Maximize2, Minimize2, BookOpen, Smartphone, Columns, RectangleVertical, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMarkers, type Marker } from "@/hooks/useMarkers";
import { useSettings } from "@/hooks/useSettings";

export type MangaPage = {
    url: string;
    width: number;
    height: number;
};

interface MangaReaderProps {
    id?: string;
    title: string;
    pages: MangaPage[];
    backUrl: string;
    className?: string;
}

type ViewMode = 'paged' | 'scroll';
type SpreadMode = 'auto' | 'single';

export default function MangaReader({ id, title, pages, backUrl, className }: MangaReaderProps) {
    // ⚙️ Settings
    const { settings } = useSettings();

    // 📍 Markers
    const {
        markers,
        isMarkerModalOpen,
        setIsMarkerModalOpen,
        markerLabel,
        setMarkerLabel,
        markerIcon,
        setMarkerIcon,
        saveMarker,
        deleteMarker,
    } = useMarkers(id);

    // 🛑 Interaction State (Unified Preview)
    const [hoveredMarker, setHoveredMarker] = useState<Marker | null>(null);

    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, markerId: string } | null>(null);

    // ✨ Rich Feedback State (Upgraded)
    const [feedbackState, setFeedbackState] = useState<{ content: React.ReactNode, mode?: "default" | "fullscreen", isExiting?: boolean } | null>(null);
    const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ⚡ Quick Action Config
    const [actionConfig, setActionConfig] = useState({ label: "Highlight", icon: "✨" });

    // 🌐 Close Context Menu on Click
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener("click", handleClick);
        return () => window.removeEventListener("click", handleClick);
    }, []);

    // ⚙️ Load Action Config
    useEffect(() => {
        const loadConfig = () => {
            const saved = localStorage.getItem("fapflix-config");
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed.actionButtonLabel) {
                        setActionConfig({
                            label: parsed.actionButtonLabel,
                            icon: parsed.actionButtonIcon || "✨"
                        });
                    }
                } catch (e) { /* ignore */ }
            }
        };
        loadConfig();
    }, []);

    // ✨ Feedback Helper
    const triggerFeedback = useCallback((content: React.ReactNode, options?: { duration?: number, mode?: "default" | "fullscreen" }) => {
        setFeedbackState({ content, mode: options?.mode || "default", isExiting: false });
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);

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

    // ✨ Show Marker Feedback (Splash Mode)
    const showMarkerFeedback = useCallback((icon: string, label: string, isExplicitAction: boolean = false) => {
        if (icon && icon.includes("💦") && isExplicitAction) {
            // 💦 SPLASH MODE
            triggerFeedback(
                <div className="relative flex items-center justify-center w-full h-full overflow-hidden">
                    {/* Ripple 1 */}
                    <div className="absolute inset-0 flex items-center justify-center">
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
            // ✨ STANDARD MODE
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

    // ⚙️ Preferences
    const [viewMode, setViewMode] = useState<ViewMode>('paged');
    const [spreadMode, setSpreadMode] = useState<SpreadMode>('auto');

    // 📍 Navigation State
    const [currentViewIndex, setCurrentViewIndex] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showUI, setShowUI] = useState(true);

    // 📄 Parse Pages & Spreads (View Logic)
    // We pre-calculate "Views" (Single Page or Spread) based on mode
    const views = useMemo(() => {
        if (viewMode === 'scroll' || spreadMode === 'single') {
            // Simple 1-to-1 mapping
            return pages.map((p, i) => ({ pages: [p], indices: [i] }));
        }

        // Auto Spread Mode
        const calculatedViews: { pages: MangaPage[]; indices: number[] }[] = [];
        let i = 0;
        while (i < pages.length) {
            const current = pages[i];
            const isLandscape = current.width > current.height;

            // If current is landscape (spread) or first page (cover) -> Single View
            if (isLandscape || i === 0) {
                calculatedViews.push({ pages: [current], indices: [i] });
                i++;
                continue;
            }

            // Check Next
            if (i + 1 >= pages.length) {
                calculatedViews.push({ pages: [current], indices: [i] });
                i++;
                continue;
            }

            const next = pages[i + 1];
            const nextIsLandscape = next.width > next.height;

            if (!nextIsLandscape) {
                // Double Page Spread
                calculatedViews.push({ pages: [current, next], indices: [i, i + 1] });
                i += 2;
            } else {
                calculatedViews.push({ pages: [current], indices: [i] });
                i++;
            }
        }
        return calculatedViews;
    }, [pages, spreadMode, viewMode]);

    // ⚡ Listen for External Actions (from Page Level)
    useEffect(() => {
        const handleExternalAction = (e: Event) => {
            const detail = (e as CustomEvent).detail; // { label, icon }

            // 1. Save Marker (Current Page) mechanism is slightly complex here because 'saveMarker' hook 
            // relies on state that might be stale in a closure if not careful, 
            // but since we are in a functional component, we can just call a helper.
            handleQuickAction(detail.icon, detail.label);
        };

        window.addEventListener("fapflix-trigger-action", handleExternalAction);
        return () => window.removeEventListener("fapflix-trigger-action", handleExternalAction);
    }, [views, currentViewIndex, saveMarker, triggerFeedback]); // Dependencies ensure fresh state

    // ⚡ Handle Quick Action (Internal Helper)
    const handleQuickAction = async (icon: string, label: string) => {
        const currentPage = views[currentViewIndex]?.indices[0] || 0;
        await saveMarker(currentPage);
        showMarkerFeedback(icon, label, true);
    };


    // 💾 Save Marker with Feedback (Modified to use new feedback)
    const handleSaveMarkerWithFeedback = async () => {
        const currentPage = views[currentViewIndex]?.indices[0] || 0;
        // Use hook's saveMarker
        const success = await saveMarker(currentPage);
        if (success) {
            showMarkerFeedback(markerIcon, markerLabel || "Saved", false);
        }
    };

    // 🎨 Preview State
    const [previewPage, setPreviewPage] = useState<number | null>(null);
    const [previewY, setPreviewY] = useState(0); // For vertical seekbar
    const seekbarRef = useRef<HTMLInputElement>(null);
    const vSeekbarRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);


    // 🛠️ Ensure current index stays valid when mode changes
    // We track "View Index", not Page Index directly, for simplicity in Paged Mode.
    // Ideally we track "Page Index" and map to "View Index".
    // Let's try to stick to ViewIndex for now, but resets might happen.
    // If we switch modes, we should try to stay on the same page.
    // Omitted for brevity in this step, but recommended for polish.

    const totalViews = views.length;

    // 🔄 Preserve Page Position on Mode Switch
    const currentPageRef = useRef<number>(0);

    // Always update current page ref
    useEffect(() => {
        const page = views[currentViewIndex]?.indices[0];
        if (page !== undefined) {
            currentPageRef.current = page;
        }
    }, [currentViewIndex]); // Remove views from dependencies!

    // When spreadMode changes, restore the page position
    useEffect(() => {
        const targetPage = currentPageRef.current;
        const newViewIdx = views.findIndex(v => v.indices.includes(targetPage));
        if (newViewIdx !== -1) {
            setCurrentViewIndex(newViewIdx);
        }
    }, [spreadMode, views]);

    // 🖱️ Navigation Logic
    const nextView = () => setCurrentViewIndex((prev) => Math.min(prev + 1, totalViews - 1));
    const prevView = () => setCurrentViewIndex((prev) => Math.max(prev - 1, 0));

    // 🖱️ Zone Click (Paged Mode Only)
    const handleZoneClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (viewMode === 'scroll') {
            setShowUI(prev => !prev);
            return;
        }

        if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'INPUT') return;

        const rect = e.currentTarget.getBoundingClientRect();
        const width = rect.width;
        const x = e.clientX - rect.left;
        const leftZone = width * 0.3;
        const rightZone = width * 0.7;

        if (x < leftZone) nextView(); // L -> Next (RTL)
        else if (x > rightZone) prevView(); // R -> Prev (RTL)
        else setShowUI(prev => !prev);
    };

    // ⌨️ Keyboard
    // 📍 Marker Navigation
    const currentPage = views[currentViewIndex]?.indices[0] || 0;

    const jumpToNextMarker = useCallback(() => {
        const next = markers.find(m => m.time > currentPage);
        if (next) {
            // Find view containing this page
            const viewIdx = views.findIndex(v => v.indices.includes(next.time));
            if (viewIdx !== -1) scrollToView(viewIdx);
        }
    }, [markers, currentPage, views]);

    const jumpToPreviousMarker = useCallback(() => {
        const prev = [...markers].reverse().find(m => m.time < currentPage);
        if (prev) {
            const viewIdx = views.findIndex(v => v.indices.includes(prev.time));
            if (viewIdx !== -1) scrollToView(viewIdx);
        }
    }, [markers, currentPage, views]);

    // 🖱️ Click Outside (Close UI in non-fullscreen)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isFullscreen) return;
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowUI(false);
            }
        };

        if (showUI) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showUI, isFullscreen]);

    // ⌨️ Keyboard Controls
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (viewMode === 'scroll') return; // Default scrolling for scroll mode

        if (e.key === "ArrowLeft") nextView();
        if (e.key === "ArrowRight") prevView();
        if (e.key === " ") nextView();
        if (e.key === "f" || e.key === "F") toggleFullscreen();
        if (e.key === "Escape") setIsFullscreen(false);
        if (e.key === "Enter") setShowUI(prev => !prev);

        // 📍 Marker Shortcuts
        if (e.key === "p" || e.key === "P") {
            e.preventDefault();
            setIsMarkerModalOpen(prev => !prev); // Toggle instead of always true
        }
        if (e.key === "n") {
            e.preventDefault();
            jumpToNextMarker();
        }
        if (e.key === "N") {
            e.preventDefault();
            jumpToPreviousMarker();
        }
    }, [viewMode, jumpToNextMarker, jumpToPreviousMarker]); // Added marker navigation functions

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);


    // 🔍 Seekbar Logic (Unified for Page index)
    // Map Slider (0-100%) -> Page Index -> View Index containing that page
    // Current 'value' is ViewIndex.
    // For Scroll Mode, we might want to scroll to that view.

    const scrollToView = (viewIdx: number) => {
        setCurrentViewIndex(viewIdx);
        if (viewMode === 'scroll') {
            const el = document.getElementById(`view-${viewIdx}`);
            el?.scrollIntoView({ behavior: 'auto' }); // Instant jump
        }
    };

    const handleSeek = (val: number) => {
        scrollToView(val);
    };

    const handleSeekHover = (e: React.MouseEvent, orient: 'h' | 'v', length: number) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        let percent = 0;

        if (orient === 'h') {
            // Horizontal (RTL)
            const x = e.clientX - rect.left;
            percent = 1 - (x / rect.width); // Invert for RTL
        } else {
            // Vertical (Top to Bottom)
            const y = e.clientY - rect.top;
            percent = y / rect.height;
        }

        percent = Math.max(0, Math.min(1, percent));
        if (orient === 'v') setPreviewY(percent);
        const targetViewIdx = Math.round(percent * (totalViews - 1));
        const targetPageIdx = views[targetViewIdx].indices[0]; // Representative page

        setPreviewPage(targetPageIdx);
    };

    // 📜 Scroll Synchronization
    const handleScroll = (e: React.UIEvent<HTMLElement>) => {
        if (viewMode !== 'scroll') return;

        const container = e.currentTarget;
        const containerTop = container.getBoundingClientRect().top;

        // Find the view closest to the top-center of the viewport
        let closestIndex = currentViewIndex;
        let minDistance = Infinity;

        // Optimization: We could throttle this or binary search, but linear scan for <200 pages is fast enough usually.
        for (let i = 0; i < totalViews; i++) {
            const el = document.getElementById(`view-${i}`);
            if (el) {
                const rect = el.getBoundingClientRect();
                // Calculate distance from the visual "reading line" (e.g. top 1/3 of screen)
                const dist = Math.abs(rect.top - containerTop);

                // If this element is closer to the top than the previous best, it's the current one
                if (dist < minDistance) {
                    minDistance = dist;
                    closestIndex = i;
                }
            }
        }

        if (closestIndex !== currentViewIndex) {
            setCurrentViewIndex(closestIndex);
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    return (
        <div
            ref={containerRef}
            className={`flex flex-col w-full h-full bg-black text-zinc-200 overflow-hidden relative select-none group/reader ${className || ''}`}
        >

            {/* 1️⃣ Header (Fullscreen Only) */}
            <header className={`absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-4 bg-gradient-to-b from-black/90 to-transparent z-40 transition-transform duration-300 ${showUI && isFullscreen ? 'translate-y-0' : '-translate-y-full'}`}>
                <div className="flex items-center gap-4 min-w-0">
                    <button onClick={backUrl ? () => window.location.href = backUrl : () => window.history.back()} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-base font-bold text-white truncate">{title}</h1>
                </div>

                <div className="flex items-center gap-4 min-w-0">
                    <button onClick={toggleFullscreen} className="p-2 hover:bg-white/10 rounded-full text-white"><X size={24} /></button>
                </div>
            </header>


            {/* 2️⃣ Main Viewport */}
            <main
                className={`flex-1 w-full h-full relative bg-zinc-950 transition-colors duration-500 overflow-hidden
                    ${viewMode === 'scroll' ? 'overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] scroll-smooth' : 'flex items-center justify-center'}
                `}
                style={{
                    backgroundImage: 'radial-gradient(circle at center, #18181b 0%, #09090b 100%)'
                }}
                onClick={handleZoneClick}
                onScroll={handleScroll}
            >
                {/* 📖 PAGED MODE */}
                {viewMode === 'paged' && (
                    <div className="relative w-full h-full flex items-center justify-center px-2">
                        {/* Render Current Spread */}
                        {/* RTL: Just use flex-row-reverse if 2 pages */}
                        <div className={`flex items-center justify-center gap-1 w-full h-full transition-all duration-300 ${views[currentViewIndex].pages.length > 1 ? 'flex-row-reverse' : ''
                            }`}>
                            {views[currentViewIndex].pages.map((p, idx) => (
                                <div key={idx} className="relative h-full flex items-center justify-center min-w-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={p.url}
                                        alt=""
                                        className={`h-full w-auto max-w-full object-contain pointer-events-none transition-all duration-300 ${!isFullscreen ? 'shadow-2xl ring-1 ring-white/5' : ''}`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 📜 SCROLL MODE */}
                {viewMode === 'scroll' && (
                    <div className="w-full min-h-full flex flex-col items-center py-10 gap-12">
                        {views.map((view, vIdx) => (
                            <div
                                id={`view-${vIdx}`}
                                key={vIdx}
                                className={`flex items-center justify-center gap-1 w-full max-w-5xl ${view.pages.length > 1 ? 'flex-row-reverse' : ''}`}
                            >
                                {view.pages.map((p, pIdx) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        key={pIdx}
                                        src={p.url}
                                        alt=""
                                        className="shadow-lg object-contain w-full h-auto max-h-screen" // Simple responsive width
                                        style={{ maxWidth: view.pages.length > 1 ? '50%' : '100%' }}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* 3️⃣ Vertical Seekbar (Scroll Mode Only) */}
            {viewMode === 'scroll' && showUI && (
                <div className="absolute right-4 top-20 bottom-24 w-8 flex flex-col items-center justify-center z-50 group/vseek">
                    {/* Preview (Left side) */}
                    {previewPage !== null && (
                        <div
                            className="absolute right-10 w-max bg-zinc-900 border border-zinc-700 p-1 rounded z-50 pointer-events-none opacity-0 group-hover/vseek:opacity-100 transform -translate-y-1/2"
                            style={{ top: `${Math.max(8, Math.min(92, previewY * 100))}%` }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`${pages[previewPage].url}?thumb=1`} className="h-48 w-auto bg-black" alt="" />
                            <div className="text-center text-xs text-white">{previewPage + 1}</div>
                        </div>
                    )}

                    <div className="w-2 h-full bg-white/10 rounded-full relative overflow-visible">
                        <div
                            className="absolute top-0 left-0 w-full bg-pink-500 rounded-full"
                            style={{ height: `${((currentViewIndex + 1) / totalViews) * 100}%` }}
                        />

                        {/* 📍 Vertical Marker Dots */}
                        {markers.map(marker => {
                            const viewIdx = views.findIndex(v => v.indices.includes(marker.time));
                            if (viewIdx === -1) return null;

                            const topPos = (viewIdx / Math.max(1, totalViews - 1)) * 100;

                            return (
                                <div
                                    key={marker.id}
                                    className="absolute left-0 right-0 h-4 -mt-2 flex items-center justify-center cursor-pointer group/marker z-[60]"
                                    style={{ top: `${topPos}%` }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        scrollToView(viewIdx);
                                    }}
                                    onMouseEnter={() => {
                                        setHoveredMarker(marker);
                                        setPreviewPage(marker.time);
                                    }}
                                    onMouseLeave={() => setHoveredMarker(null)}
                                >
                                    {/* Visual Dot */}
                                    <div className={`w-1.5 h-1.5 rounded-full group-hover/marker:scale-150 transition-all shadow-sm ${marker.icon.includes('💦') ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-yellow-400 group-hover/marker:bg-pink-400'
                                        }`} />

                                    {/* Tooltip on Hover (Right Side) */}
                                    <div className="absolute right-6 opacity-0 group-hover/marker:opacity-100 transition-opacity bg-black/80 backdrop-blur px-2 py-1 rounded border border-white/10 whitespace-nowrap z-50 pointer-events-none flex items-center gap-1">
                                        <span className="text-lg">{marker.icon}</span>
                                    </div>
                                </div>
                            );
                        })}

                        <input
                            ref={vSeekbarRef}
                            type="range"
                            min="0"
                            max={totalViews - 1}
                            value={currentViewIndex}
                            onChange={(e) => handleSeek(Number(e.target.value))}
                            onMouseMove={(e) => handleSeekHover(e, 'v', totalViews)}
                            onMouseLeave={() => setPreviewPage(null)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            style={{ writingMode: 'vertical-lr' as React.CSSProperties['writingMode'] }} // Attempt vertical range
                        />
                    </div>
                </div>
            )}


            {/* 4️⃣ Controls Footer */}
            <footer
                className={`absolute bottom-0 left-0 right-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/60 to-transparent z-30 transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0'}`}
                style={{ paddingBottom: isFullscreen ? '2rem' : '1rem', paddingTop: '4rem' }}
            >
                <div className="w-full px-6 md:px-10 flex flex-col gap-2">

                    {/* Horizontal Seekbar (Paged Mode Only) */}
                    {viewMode === 'paged' && (
                        <div
                            className="relative w-full h-4 group/seek flex items-center cursor-pointer"
                            onMouseMove={(e) => handleSeekHover(e, 'h', totalViews)}
                            onMouseLeave={() => {
                                setPreviewPage(null);
                                setHoveredMarker(null);
                            }}
                        >
                            {/* Unified Preview & Marker Info */}
                            {previewPage !== null && (
                                <div
                                    className="absolute bottom-6 -translate-x-1/2 w-max bg-zinc-900 border border-zinc-700 rounded-lg p-1 shadow-2xl z-50 pointer-events-auto opacity-0 group-hover/seek:opacity-100 transition-opacity flex flex-col items-center"
                                    style={{
                                        left: `${Math.max(8, Math.min(92, ((totalViews - 1 - (previewPage / pages.length * (totalViews - 1))) / (totalViews - 1)) * 100))}%`
                                    }}
                                >
                                    {/* Preview Image */}
                                    <div className="relative">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={`${pages[previewPage].url}?thumb=1`} className="h-48 w-auto bg-black shadow-xl" alt="" />

                                        {/* Marker Overlay (Only if hovered marker matches current preview page) */}
                                        {hoveredMarker && hoveredMarker.time === previewPage && (
                                            <div
                                                className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 cursor-context-menu"
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setContextMenu({ x: e.clientX, y: e.clientY, markerId: hoveredMarker.id });
                                                }}
                                            >
                                                <div className="text-3xl drop-shadow-md mb-1 hover:scale-110 transition-transform">{hoveredMarker.icon}</div>
                                                {hoveredMarker.label && (
                                                    <div className="text-xs font-bold text-pink-300 shadow-black drop-shadow-sm border-b border-pink-500/50 pb-0.5">
                                                        {hoveredMarker.label}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Page Number (Always visible) */}
                                    <div className="text-center text-xs text-zinc-300 mt-1 font-mono">
                                        Page {previewPage + 1}
                                    </div>
                                </div>
                            )}

                            {/* Track */}
                            <div className="absolute inset-0 h-1 bg-white/20 rounded-full my-auto group-hover/seek:h-1.5 transition-all" />
                            <div className="absolute right-0 h-1 bg-pink-600 rounded-full my-auto" style={{ width: `${(currentViewIndex / Math.max(1, totalViews - 1)) * 100}%` }} />
                            <div className="absolute h-3 w-3 bg-pink-500 rounded-full shadow border border-white transform translate-x-1/2 opacity-0 group-hover/seek:opacity-100" style={{ right: `${(currentViewIndex / Math.max(1, totalViews - 1)) * 100}%` }} />

                            {/* 📍 Marker Dots */}
                            {markers.map(marker => {
                                const viewIdx = views.findIndex(v => v.indices.includes(marker.time));
                                if (viewIdx === -1) return null;

                                const position = (1 - (viewIdx / Math.max(1, totalViews - 1))) * 100;

                                return (
                                    <div
                                        key={marker.id}
                                        className="absolute top-0 bottom-0 w-4 -ml-2 flex items-center justify-center cursor-pointer group/marker z-[60]" // w-4 for hit, -ml-2 to center
                                        style={{ left: `${position}%` }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            scrollToView(viewIdx);
                                        }}
                                        onMouseEnter={() => {
                                            setHoveredMarker(marker);
                                            setPreviewPage(marker.time);
                                        }}
                                        onMouseLeave={() => {
                                            setHoveredMarker(null);
                                        }}
                                        onMouseMove={(e) => e.stopPropagation()} // Prevent seekbar from overriding preview
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setContextMenu({ x: e.clientX, y: e.clientY, markerId: marker.id });
                                        }}
                                    >
                                        {/* Visual Dot - Fixed Size, not stretched */}
                                        <div className={`w-1.5 h-1.5 rounded-full group-hover/marker:scale-150 transition-all shadow-sm ${marker.icon.includes('💦') ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-yellow-400 group-hover/marker:bg-pink-400'
                                            }`} />
                                    </div>
                                );
                            })}

                            <input
                                type="range"
                                min="0"
                                max={totalViews - 1}
                                value={currentViewIndex}
                                onChange={(e) => handleSeek(Number(e.target.value))}
                                // Mouse events moved to parent div
                                dir="rtl"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                            />
                        </div>
                    )}

                    {/* Controls Row */}
                    <div className="flex items-center justify-between text-white">
                        <div className="flex items-center gap-4">
                            {/* Mode Toggles */}
                            <div className="flex bg-white/10 rounded-lg p-1 gap-1">
                                <button
                                    onClick={() => setViewMode('paged')}
                                    className={`p-1.5 rounded ${viewMode === 'paged' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                                    title="Page Mode"
                                >
                                    <BookOpen size={18} />
                                </button>
                                <button
                                    onClick={() => setViewMode('scroll')}
                                    className={`p-1.5 rounded ${viewMode === 'scroll' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                                    title="Scroll Mode"
                                >
                                    <Smartphone size={18} />
                                </button>
                            </div>



                            <div className="w-px h-6 bg-white/20 mx-2" />



                            <div className="flex bg-white/10 rounded-lg p-1 gap-1">
                                <button
                                    onClick={() => setSpreadMode('single')}
                                    className={`p-1.5 rounded ${spreadMode === 'single' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                                    title="Single Page"
                                >
                                    <RectangleVertical size={18} />
                                </button>
                                <button
                                    onClick={() => setSpreadMode('auto')}
                                    className={`p-1.5 rounded ${spreadMode === 'auto' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                                    title="Auto Spread"
                                >
                                    <Columns size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Page Counter & Fullscreen */}
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-mono text-zinc-300">
                                {currentViewIndex + 1} / {totalViews}
                            </span>
                            <button onClick={toggleFullscreen} className="hover:text-pink-500 transition-colors">
                                {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
                            </button>
                        </div>
                    </div>
                </div>
            </footer >

            {/* 📍 Marker Creation Modal */}
            {
                isMarkerModalOpen && (
                    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-zinc-900 border border-pink-500/50 p-6 rounded-2xl shadow-2xl w-full max-w-sm space-y-4">
                            <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                <span>📍</span> Add Page Marker
                            </h3>
                            <p className="text-sm text-zinc-400">Page {currentPage + 1}</p>

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
                                    e.stopPropagation();
                                    if (e.key === 'Enter') {
                                        handleSaveMarkerWithFeedback();
                                        setIsMarkerModalOpen(false);
                                    }
                                    if (e.key === 'Escape') {
                                        e.preventDefault();
                                        setIsMarkerModalOpen(false);
                                    }
                                }}
                            />

                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        handleSaveMarkerWithFeedback();
                                        setIsMarkerModalOpen(false);
                                    }}
                                    className="flex-1 bg-pink-600 hover:bg-pink-500 text-white font-bold py-2 rounded-lg transition-colors"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => setIsMarkerModalOpen(false)}
                                    className="px-4 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ✨ Feedback Animation (Rich State) */}
            {
                feedbackState && (
                    <div
                        className={`absolute inset-0 flex items-center justify-center z-[100] ${feedbackState.mode === 'fullscreen' ? 'pointer-events-none overflow-hidden' : 'pointer-events-none'}`}
                        style={{
                            transition: 'opacity 500ms ease-out, transform 500ms ease-out',
                            opacity: feedbackState.isExiting ? 0 : 1,
                            transform: feedbackState.isExiting ? 'scale(0.95)' : 'scale(1)',
                        }}
                    >
                        {feedbackState.mode === "fullscreen" ? (
                            // Fullscreen Mode
                            <div className="w-full h-full flex items-center justify-center animate-in fade-in duration-300">
                                {feedbackState.content}
                            </div>
                        ) : (
                            // Default Mode
                            <div className="bg-black/70 text-white rounded-2xl p-6 animate-in fade-in zoom-in duration-200 backdrop-blur-sm shadow-2xl border border-white/10">
                                {feedbackState.content}
                            </div>
                        )}
                    </div>
                )
            }

            {/* 🗑️ Context Menu */}
            {
                contextMenu && (
                    <div
                        className="fixed bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl py-2 z-[9999] min-w-[150px] animate-in fade-in zoom-in duration-100"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseLeave={() => setContextMenu(null)}
                    >
                        <button
                            onClick={() => {
                                deleteMarker(contextMenu.markerId);
                                setContextMenu(null);
                            }}
                            className="w-full px-4 py-2 text-left text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                        >
                            <Trash2 size={16} /> Delete Marker
                        </button>
                    </div>
                )
            }
        </div >
    );
}

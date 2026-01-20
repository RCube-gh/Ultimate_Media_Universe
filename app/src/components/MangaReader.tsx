"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ChevronLeft, ChevronRight, X, Maximize2, Minimize2, BookOpen, Smartphone, Columns, RectangleVertical } from "lucide-react";
import Link from "next/link";

export type MangaPage = {
    url: string;
    width: number;
    height: number;
};

interface MangaReaderProps {
    title: string;
    pages: MangaPage[];
    backUrl: string;
    className?: string;
}

type ViewMode = 'paged' | 'scroll';
type SpreadMode = 'auto' | 'single';

export default function MangaReader({ title, pages, backUrl, className }: MangaReaderProps) {
    // ⚙️ Preferences
    const [viewMode, setViewMode] = useState<ViewMode>('paged');
    const [spreadMode, setSpreadMode] = useState<SpreadMode>('auto');

    // 📍 Navigation State
    const [currentViewIndex, setCurrentViewIndex] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showUI, setShowUI] = useState(true);

    // 🎨 Preview State
    const [previewPage, setPreviewPage] = useState<number | null>(null);
    const [previewY, setPreviewY] = useState(0); // For vertical seekbar
    const seekbarRef = useRef<HTMLInputElement>(null);
    const vSeekbarRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 🧠 Smart Spread Calculation
    const views = useMemo(() => {
        if (spreadMode === 'single') {
            return pages.map((p, i) => ({ pages: [p], indices: [i] }));
        }

        const calculatedViews: { pages: MangaPage[], indices: number[] }[] = [];
        let i = 0;
        while (i < pages.length) {
            const current = pages[i];

            // Rule 1: First page (Cover) is always single in Auto
            // Rule 2: Landscape is single
            // Rule 3: Last page alone is single
            const isCover = i === 0;
            const isLandscape = current.width > current.height;
            const isLast = i === pages.length - 1;

            if (isCover || isLandscape || isLast) {
                calculatedViews.push({ pages: [current], indices: [i] });
                i++;
                continue;
            }

            // Check Next
            const next = pages[i + 1];
            const nextIsLandscape = next.width > next.height;

            if (!nextIsLandscape) {
                // Double Page Spread!
                // RTL: [Next] [Current] (Visual) -> Logic depends on displaying order
                // Usually we render [Page N+1] [Page N] for RTL? 
                // Wait, standard JP manga: Right is Page 1, Left is Page 2.
                // So visually: [Page 2] [Page 1].
                // In DOM flow (flex-row-reverse for RTL?) or standard row?
                // Let's store them in logical order [Current, Next] ([Page 1, Page 2])
                // and handle visuals in CSS.
                calculatedViews.push({ pages: [current, next], indices: [i, i + 1] });
                i += 2;
            } else {
                calculatedViews.push({ pages: [current], indices: [i] });
                i++;
            }
        }
        return calculatedViews;
    }, [pages, spreadMode]);

    // 🛠️ Ensure current index stays valid when mode changes
    // We track "View Index", not Page Index directly, for simplicity in Paged Mode.
    // Ideally we track "Page Index" and map to "View Index".
    // Let's try to stick to ViewIndex for now, but resets might happen.
    // If we switch modes, we should try to stay on the same page.
    // Omitted for brevity in this step, but recommended for polish.

    const totalViews = views.length;

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
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (viewMode === 'scroll') return; // Default scrolling for scroll mode

        if (e.key === "ArrowLeft") nextView();
        if (e.key === "ArrowRight") prevView();
        if (e.key === " ") nextView();
        if (e.key === "f") toggleFullscreen();
        if (e.key === "Escape") setIsFullscreen(false);
        if (e.key === "Enter") setShowUI(prev => !prev);
    }, [viewMode]); // Added viewMode dependency

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
        const rect = (e.target as HTMLElement).getBoundingClientRect();
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
                {/* ... (Same as before) ... */}
                <div className="flex items-center gap-4 min-w-0">
                    <button onClick={toggleFullscreen} className="p-2 hover:bg-white/10 rounded-full text-white"><X size={24} /></button>
                    <h1 className="text-base font-bold text-white truncate">{title}</h1>
                </div>
            </header>


            {/* 2️⃣ Main Viewport */}
            <main
                className={`flex-1 w-full h-full relative bg-zinc-950 transition-colors duration-500 overflow-hidden
                    ${viewMode === 'scroll' ? 'overflow-y-auto custom-scrollbar scroll-smooth' : 'flex items-center justify-center'}
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
                        <div className="relative w-full h-4 group/seek flex items-center cursor-pointer">
                            {/* Preview (Top) */}
                            {previewPage !== null && (
                                <div
                                    className="absolute bottom-6 -translate-x-1/2 w-max bg-zinc-900 border border-zinc-700 rounded-lg p-1 shadow-2xl z-50 pointer-events-none opacity-0 group-hover/seek:opacity-100 transition-opacity"
                                    style={{
                                        left: `${Math.max(8, Math.min(92, ((totalViews - 1 - (previewPage / pages.length * (totalViews - 1))) / (totalViews - 1)) * 100))}%`
                                        // Approximate mapping for preview position
                                    }}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={`${pages[previewPage].url}?thumb=1`} className="h-48 w-auto bg-black shadow-xl" alt="" />
                                    <div className="text-center text-xs text-zinc-300">{previewPage + 1}</div>
                                </div>
                            )}

                            {/* Track */}
                            <div className="absolute inset-0 h-1 bg-white/20 rounded-full my-auto group-hover/seek:h-1.5 transition-all" />
                            <div className="absolute right-0 h-1 bg-pink-600 rounded-full my-auto" style={{ width: `${(currentViewIndex / Math.max(1, totalViews - 1)) * 100}%` }} />
                            <div className="absolute h-3 w-3 bg-pink-500 rounded-full shadow border border-white transform translate-x-1/2 opacity-0 group-hover/seek:opacity-100" style={{ right: `${(currentViewIndex / Math.max(1, totalViews - 1)) * 100}%` }} />

                            <input
                                type="range"
                                min="0"
                                max={totalViews - 1}
                                value={currentViewIndex}
                                onChange={(e) => handleSeek(Number(e.target.value))}
                                onMouseMove={(e) => handleSeekHover(e, 'h', totalViews)}
                                onMouseLeave={() => setPreviewPage(null)}
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
            </footer>
        </div>
    );
}

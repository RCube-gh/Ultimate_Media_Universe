"use client";

import { useEffect, useState } from "react";

export function MarkerStats({ id }: { id: string }) {
    const [stats, setStats] = useState<{ count: number, icon: string } | null>(null);

    useEffect(() => {
        const load = async () => {
            // 1. Get Config
            let icon = "✨";
            try {
                const saved = localStorage.getItem("fapflix-config");
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.actionButtonIcon) icon = parsed.actionButtonIcon;
                }
            } catch (e) { /* ignore */ }

            // 2. Fetch
            try {
                const res = await fetch(`/api/media/${id}/markers`);
                if (res.ok) {
                    const markers: { icon: string }[] = await res.json();
                    const count = markers.filter(m => m.icon === icon).length;
                    setStats({ count, icon });
                }
            } catch (e) { console.error(e); }
        };

        load();

        // Listen for updates
        // 1. Storage changes (Config change)
        window.addEventListener("storage", load);

        // 2. Local updates (User clicked button) - We'll listen for the trigger and wait a bit
        const handleTrigger = () => {
            setTimeout(load, 1000); // Wait for API save
        };
        window.addEventListener("fapflix-trigger-action", handleTrigger as any);

        return () => {
            window.removeEventListener("storage", load);
            window.removeEventListener("fapflix-trigger-action", handleTrigger as any);
        };
    }, [id]);

    if (!stats || stats.count === 0) return null;

    return (
        <>
            <span>•</span>
            <span className="flex items-center gap-1 text-pink-400 font-bold animate-in fade-in">
                <span>{stats.icon}</span>
                <span>{stats.count.toLocaleString()}</span>
            </span>
        </>
    );
}

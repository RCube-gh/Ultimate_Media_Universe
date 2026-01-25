"use client";

import { useState, useEffect } from "react";
import { ThumbsUp, Heart, MoreHorizontal } from "lucide-react";

type VideoActionsProps = {
    id: string;
    initialLikes: number;
    initialIsFavorite: boolean;
};

export function VideoActions({ id, initialLikes, initialIsFavorite }: VideoActionsProps) {
    const [likes, setLikes] = useState(initialLikes);
    const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
    const [likeAnimating, setLikeAnimating] = useState(false);

    // Quick Action Config & State
    const [actionConfig, setActionConfig] = useState({ label: "Highlight", icon: "✨" });

    useEffect(() => {
        const loadConfig = () => {
            // 1. Load Config
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
                } catch (e) { console.error(e); }
            }
        };

        loadConfig();
        window.addEventListener("storage", loadConfig);
        return () => window.removeEventListener("storage", loadConfig);
    }, []);

    const handleQuickAction = () => {
        // Dispatch Custom Event to Player
        const event = new CustomEvent("fapflix-trigger-action", {
            detail: { label: actionConfig.label, icon: actionConfig.icon }
        });
        window.dispatchEvent(event);
    };

    const handleLike = async () => {
        // Optimistic
        setLikes(prev => prev + 1);
        setLikeAnimating(true);
        setTimeout(() => setLikeAnimating(false), 500);

        try {
            await fetch(`/api/media/${id}/interact`, {
                method: "POST",
                body: JSON.stringify({ type: "like" }),
            });
        } catch (error) {
            console.error(error);
            setLikes(prev => prev - 1); // Revert
        }
    };

    const handleFavorite = async () => {
        // Optimistic
        setIsFavorite(prev => !prev);

        try {
            await fetch(`/api/media/${id}/interact`, {
                method: "POST",
                body: JSON.stringify({ type: "favorite" }),
            });
        } catch (error) {
            console.error(error);
            setIsFavorite(prev => !prev); // Revert
        }
    };

    return (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
                onClick={handleLike}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 active:scale-95 rounded-full font-medium text-sm transition-all relative overflow-hidden group"
            >
                <ThumbsUp size={18} className={`transition-transform ${likeAnimating ? "scale-125 rotate-12 text-blue-400" : "group-hover:-rotate-12"}`} />
                <span>{likes}</span>
                {likeAnimating && (
                    <span className="absolute inset-0 bg-white/10 animate-ping rounded-full" />
                )}
            </button>
            <button
                onClick={handleFavorite}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all active:scale-95 ${isFavorite ? "bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-900/30" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"}`}
            >
                <Heart size={18} className={`transition-transform ${isFavorite ? "fill-current scale-110" : "group-hover:text-pink-500"}`} />
                <span>{isFavorite ? "Saved" : "Favorite"}</span>
            </button>
            <button
                onClick={handleQuickAction}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 active:scale-95 rounded-full font-medium text-sm transition-all group relative overflow-hidden text-zinc-300"
            >
                <span className="text-lg group-hover:scale-110 transition-transform">{actionConfig.icon}</span>
                <span>{actionConfig.label}</span>
            </button>
            <button className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors">
                <MoreHorizontal size={18} />
            </button>
        </div>
    );
}

"use client";

import { useState } from "react";
import { Save, RefreshCw, Plus, X } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import dynamic from "next/dynamic";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

export function SettingsForm() {
    const { settings, loading, updateSettings } = useSettings();
    const [saved, setSaved] = useState(false);
    const [newIcon, setNewIcon] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    if (loading || !settings) {
        return <div className="text-zinc-500">Loading settings...</div>;
    }

    const markerIcons = JSON.parse(settings.markerIcons);

    const handleSave = async () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const addIcon = async (emoji: string) => {
        if (!emoji.trim()) return;
        const icons = JSON.parse(settings.markerIcons);
        if (icons.includes(emoji)) return; // Already exists

        await updateSettings({
            markerIcons: JSON.stringify([...icons, emoji])
        });
        setNewIcon("");
    };

    const removeIcon = async (emoji: string) => {
        const icons = JSON.parse(settings.markerIcons);
        await updateSettings({
            markerIcons: JSON.stringify(icons.filter((i: string) => i !== emoji))
        });
    };

    const resetToDefaults = async () => {
        if (confirm("Reset all settings to defaults?")) {
            await updateSettings({
                markerIcons: "[\"💦\",\"👄\",\"🍑\",\"🐄\",\"🦶\",\"💕\",\"🚀\",\"🛑\"]",
                autoResume: true,
                quickActionMode: "highlight",
                quickActionIcon: "✨",
                quickActionLabel: "Highlight"
            });
        }
    };

    return (
        <div className="space-y-8">
            {/* 🎬 Player Settings */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold text-pink-500 flex items-center gap-2">
                    <span className="p-1 bg-pink-500/10 rounded-lg">🎬</span> Video Player
                </h2>

                <div className="bg-zinc-900 border border-white/5 rounded-xl p-6 space-y-6">
                    {/* Auto Resume */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <label className="font-medium text-white">Auto-Resume Playback</label>
                            <p className="text-sm text-zinc-400">
                                Automatically resume videos from where you left off.
                            </p>
                        </div>
                        <button
                            onClick={() => updateSettings({ autoResume: !settings.autoResume })}
                            className={`w-14 h-8 rounded-full transition-colors relative ${settings.autoResume ? "bg-pink-600" : "bg-zinc-700"}`}
                        >
                            <div className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform ${settings.autoResume ? "translate-x-6" : "translate-x-0"}`} />
                        </button>
                    </div>
                </div>
            </section>

            {/* ✨ Quick Action */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold text-pink-500 flex items-center gap-2">
                    <span className="p-1 bg-pink-500/10 rounded-lg">✨</span> Quick Action
                </h2>

                <div className="bg-zinc-900 border border-white/5 rounded-xl p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="font-medium text-white">Quick Action Button</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => updateSettings({
                                        quickActionMode: "highlight",
                                        quickActionLabel: "Highlight",
                                        quickActionIcon: "✨"
                                    })}
                                    className="px-3 py-1 bg-zinc-800 text-xs rounded hover:bg-zinc-700 transition"
                                >
                                    Default (Safe)
                                </button>
                                <button
                                    onClick={() => updateSettings({
                                        quickActionMode: "explicit",
                                        quickActionLabel: "Cum",
                                        quickActionIcon: "💦"
                                    })}
                                    className="px-3 py-1 bg-red-900/30 text-red-400 text-xs rounded hover:bg-red-900/50 transition border border-red-500/30"
                                >
                                    Explicit Mode
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs text-zinc-400">Label</label>
                                <input
                                    type="text"
                                    value={settings.quickActionLabel}
                                    onChange={(e) => updateSettings({ quickActionLabel: e.target.value })}
                                    className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-pink-500 outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-zinc-400">Icon</label>
                                <div className="flex gap-2">
                                    {["✨", "📌", "💦", "🍆", "🔥", "❤️"].map(icon => (
                                        <button
                                            key={icon}
                                            onClick={() => updateSettings({ quickActionIcon: icon })}
                                            className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-colors border ${settings.quickActionIcon === icon ? "bg-pink-600 border-pink-500" : "bg-black border-zinc-800 hover:border-zinc-600"}`}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-black/50 p-4 rounded-lg flex items-center justify-center gap-4 border border-dashed border-zinc-800">
                            <span className="text-xs text-zinc-500">Preview:</span>
                            <button className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-full font-bold text-sm shadow-lg shadow-pink-900/20 pointer-events-none">
                                {settings.quickActionIcon} {settings.quickActionLabel}
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* 🎨 Marker Icons */}
            <section className="space-y-4">
                <h2 className="text-xl font-bold text-pink-500 flex items-center gap-2">
                    <span className="p-1 bg-pink-500/10 rounded-lg">🎨</span> Marker Icons
                </h2>

                <div className="bg-zinc-900 border border-white/5 rounded-xl p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="font-medium text-white">Available Icons</label>
                        <p className="text-sm text-zinc-400">
                            Customize which emojis appear in the marker picker.
                        </p>
                    </div>

                    {/* Icon Grid */}
                    <div className="flex flex-wrap gap-2">
                        {markerIcons.map((emoji: string) => (
                            <div key={emoji} className="relative group">
                                <button className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center text-2xl border border-zinc-700 hover:border-zinc-600 transition">
                                    {emoji}
                                </button>
                                <button
                                    onClick={() => removeIcon(emoji)}
                                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={12} className="text-white" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Add New Icon */}
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newIcon}
                                onChange={(e) => setNewIcon(e.target.value)}
                                placeholder="Paste emoji or use picker..."
                                className="flex-1 bg-black border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-pink-500 outline-none"
                            />
                            <button
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition flex items-center gap-2"
                            >
                                🎨 Pick
                            </button>
                            <button
                                onClick={() => addIcon(newIcon)}
                                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-500 transition flex items-center gap-2"
                            >
                                <Plus size={16} /> Add
                            </button>
                        </div>

                        {/* Emoji Picker Popup */}
                        {showEmojiPicker && (
                            <div className="relative">
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowEmojiPicker(false)}
                                />
                                <div className="absolute top-2 left-0 z-50">
                                    <EmojiPicker
                                        onEmojiClick={(emojiData) => {
                                            setNewIcon(emojiData.emoji);
                                            setShowEmojiPicker(false);
                                        }}
                                        width={350}
                                        height={400}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* 💾 Actions */}
            <div className="flex items-center gap-4 pt-4">
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                    {saved ? <span className="text-green-600">✔ Saved</span> : <><Save size={18} /> Save Changes</>}
                </button>
                <button
                    onClick={resetToDefaults}
                    className="flex items-center gap-2 px-4 py-3 text-zinc-400 hover:text-red-400 transition-colors text-sm"
                >
                    <RefreshCw size={16} /> Reset to Defaults
                </button>
            </div>
        </div>
    );
}

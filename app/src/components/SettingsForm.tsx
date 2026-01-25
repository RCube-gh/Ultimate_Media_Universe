"use client";

import { useEffect, useState } from "react";
import { Save, RefreshCw } from "lucide-react";

type AppConfig = {
    autoResume: boolean;
};

const DEFAULT_CONFIG: AppConfig = {
    autoResume: true,
};

export function SettingsForm() {
    const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
    const [isLoaded, setIsLoaded] = useState(false);
    const [saved, setSaved] = useState(false);

    // 📥 Load Config
    useEffect(() => {
        const saved = localStorage.getItem("fapflix-config");
        if (saved) {
            try {
                setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) });
            } catch (e) {
                console.error("Failed to parse config", e);
            }
        }
        setIsLoaded(true);
    }, []);

    // 💾 Save Config
    const handleSave = () => {
        localStorage.setItem("fapflix-config", JSON.stringify(config));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);

        // Dispatch event so other components can react immediately if needed
        window.dispatchEvent(new Event("storage"));
    };

    if (!isLoaded) return <div className="text-zinc-500">Loading settings...</div>;

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
                            onClick={() => setConfig({ ...config, autoResume: !config.autoResume })}
                            className={`w-14 h-8 rounded-full transition-colors relative ${config.autoResume ? "bg-pink-600" : "bg-zinc-700"}`}
                        >
                            <div className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform ${config.autoResume ? "translate-x-6" : "translate-x-0"}`} />
                        </button>
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
                    onClick={() => {
                        localStorage.removeItem("fapflix-config");
                        setConfig(DEFAULT_CONFIG);
                        window.location.reload();
                    }}
                    className="flex items-center gap-2 px-4 py-3 text-zinc-400 hover:text-red-400 transition-colors text-sm"
                >
                    <RefreshCw size={16} /> Reset to Defaults
                </button>
            </div>
        </div>
    );
}

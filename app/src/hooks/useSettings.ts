import { useState, useEffect } from "react";

export interface UserSettings {
    id: string;
    markerIcons: string; // JSON string
    autoResume: boolean;
    quickActionMode: string;
    quickActionIcon: string;
    quickActionLabel: string;
    createdAt: string;
    updatedAt: string;
}

export function useSettings() {
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/settings")
            .then((r) => r.json())
            .then((data) => {
                setSettings(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Failed to load settings:", err);
                setLoading(false);
            });
    }, []);

    const updateSettings = async (updates: Partial<UserSettings>) => {
        try {
            const res = await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });
            const updated = await res.json();
            setSettings(updated);
            return updated;
        } catch (err) {
            console.error("Failed to update settings:", err);
            throw err;
        }
    };

    return { settings, loading, updateSettings };
}

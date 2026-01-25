import { useState, useEffect, useCallback } from "react";

export type Marker = {
    id: string;
    time: number; // For video: seconds, For manga: page number
    label: string;
    icon: string;
};

export function useMarkers(itemId: string | undefined) {
    const [markers, setMarkers] = useState<Marker[]>([]);
    const [isMarkerModalOpen, setIsMarkerModalOpen] = useState(false);
    const [markerLabel, setMarkerLabel] = useState("");
    const [markerIcon, setMarkerIcon] = useState("💦");

    // 🧬 Fetch Markers
    useEffect(() => {
        if (!itemId) return;
        fetch(`/api/media/${itemId}/markers`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setMarkers(data);
            })
            .catch(err => console.error("Failed to load markers", err));
    }, [itemId]);

    // 💾 Save Marker
    const saveMarker = useCallback(async (position: number) => {
        if (!itemId) return;

        const newMarker = {
            time: Math.floor(position),
            label: markerLabel,
            icon: markerIcon
        };

        try {
            const res = await fetch(`/api/media/${itemId}/markers`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newMarker),
            });

            if (res.ok) {
                const saved = await res.json();
                setMarkers(prev => [...prev, saved].sort((a, b) => a.time - b.time));
                setIsMarkerModalOpen(false);
                setMarkerLabel("");
                return true;
            }
        } catch (e) {
            console.error("Failed to save marker", e);
        }
        return false;
    }, [itemId, markerLabel, markerIcon]);

    // 🗑️ Delete Marker
    const deleteMarker = useCallback(async (markerId: string) => {
        // Optimistic Update
        setMarkers(prev => prev.filter(m => m.id !== markerId));

        try {
            await fetch(`/api/markers/${markerId}`, { method: "DELETE" });
        } catch (e) {
            console.error("Failed to delete marker", e);
        }
    }, []);

    return {
        markers,
        isMarkerModalOpen,
        setIsMarkerModalOpen,
        markerLabel,
        setMarkerLabel,
        markerIcon,
        setMarkerIcon,
        saveMarker,
        deleteMarker,
    };
}


"use client";

import { useState, useEffect, useRef } from "react";
import { X, Hash, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

interface Tag {
    id: string;
    name: string;
}

interface TagEditorProps {
    mediaId?: string; // Optional: If present, saves to API. If missing, uses local state only.
    initialTags: Tag[];
    onChange?: (tags: Tag[]) => void; // Optional: For local state updates
}

export function TagEditor({ mediaId, initialTags, onChange }: TagEditorProps) {
    const [tags, setTags] = useState<Tag[]>(initialTags);
    const [input, setInput] = useState("");
    const [suggestions, setSuggestions] = useState<Tag[]>([]);
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [isFocused, setIsFocused] = useState(false);
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch all tags for autocomplete
    useEffect(() => {
        fetch("/umu/api/tags")
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) setAllTags(data);
            })
            .catch(console.error);
    }, []);

    // Filter suggestions
    useEffect(() => {
        if (!input) {
            setSuggestions([]);
            return;
        }
        const lowerInput = input.toLowerCase();
        const filtered = allTags.filter(
            (t) =>
                t.name.toLowerCase().includes(lowerInput) &&
                !tags.some((current) => current.name === t.name)
        );
        setSuggestions(filtered);
    }, [input, allTags, tags]);

    const saveTags = async (newTags: Tag[]) => {
        // Optimistic update
        setTags(newTags);

        // Local Mode
        if (onChange) {
            onChange(newTags);
        }

        // API Mode
        if (mediaId) {
            try {
                const tagNames = newTags.map(t => t.name);
                await fetch(`/umu/api/media/${mediaId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ tags: tagNames }),
                });
                router.refresh();
            } catch (error) {
                console.error("Failed to save tags", error);
                // Revert on failure (could add toast here)
            }
        }
    };

    const addTag = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;

        // Check if already exists
        if (tags.some(t => t.name.toLowerCase() === trimmed.toLowerCase())) {
            setInput("");
            return;
        }

        const existingTag = allTags.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
        const newTag = existingTag || { id: `temp-${Date.now()}`, name: trimmed };

        const newTags = [...tags, newTag];
        saveTags(newTags);
        setInput("");

        // If it's a completely new tag, add it to allTags locally so it shows up next time without refetch
        if (!existingTag) {
            setAllTags([...allTags, newTag]);
        }
    };

    const removeTag = (tagToRemove: Tag) => {
        const newTags = tags.filter((t) => t.name !== tagToRemove.name);
        saveTags(newTags);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            // If there is exactly one suggestion and it matches perfectly or we just want to select the first one?
            // Let's just add what is typed for now, user can click suggestions
            addTag(input);
        } else if (e.key === "Backspace" && !input && tags.length > 0) {
            removeTag(tags[tags.length - 1]);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800 focus-within:border-pink-500/50 focus-within:bg-zinc-900 transition-all">
                <Hash size={16} className="text-zinc-500 ml-1" />

                {tags.map((tag) => (
                    <span
                        key={tag.name} // use name as key to avoid id issues with optimistic updates
                        className="flex items-center gap-1 px-2.5 py-1 text-sm bg-pink-500/10 text-pink-300 border border-pink-500/20 rounded-full group hover:bg-pink-500/20 transition-colors"
                    >
                        {tag.name}
                        <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="hover:text-white transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </span>
                ))}

                <div className="relative flex-1 min-w-[120px]">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setTimeout(() => setIsFocused(false), 200)} // Delay to allow click
                        placeholder={tags.length === 0 ? "Add tags..." : ""}
                        className="w-full bg-transparent border-none focus:ring-0 text-sm text-zinc-200 placeholder:text-zinc-600"
                    />

                    {/* Suggestions Dropdown */}
                    {isFocused && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                            {suggestions.map((suggestion) => (
                                <button
                                    type="button"
                                    key={suggestion.id}
                                    className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-pink-500/10 hover:text-pink-300 transition-colors flex items-center gap-2"
                                    onClick={() => addTag(suggestion.name)}
                                >
                                    <Hash size={12} className="opacity-50" />
                                    {suggestion.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

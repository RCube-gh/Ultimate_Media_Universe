
"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function SearchBar() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [query, setQuery] = useState(searchParams.get("q") || "");
    const [isPending, startTransition] = useTransition();

    // Sync with URL
    useEffect(() => {
        setQuery(searchParams.get("q") || "");
    }, [searchParams]);

    // 🕰️ Debounce Logic
    useEffect(() => {
        const timer = setTimeout(() => {
            const currentQ = searchParams.get("q") || "";
            if (query === currentQ) return; // No change

            startTransition(() => {
                const params = new URLSearchParams(window.location.search);
                if (query) {
                    params.set("q", query);
                } else {
                    params.delete("q");
                }
                router.replace(`?${params.toString()}`);
            });
        }, 500); // Wait 500ms after last keystroke

        return () => clearTimeout(timer);
    }, [query, router, searchParams]);

    const handleSearch = (term: string) => {
        setQuery(term);
    };

    return (
        <div className="relative group w-full">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Search
                    size={18}
                    className={`transition-colors ${isPending ? "text-pink-500 animate-pulse" : "text-zinc-500 group-focus-within:text-pink-500"
                        }`}
                />
            </div>
            <input
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by title, description, or #tag..."
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-full py-2.5 pl-10 pr-10 focus:outline-none focus:border-pink-500/50 focus:bg-black transition-all placeholder:text-zinc-600"
            />
            {query && (
                <button
                    onClick={() => handleSearch("")}
                    className="absolute inset-y-0 right-3 flex items-center text-zinc-500 hover:text-white"
                >
                    <X size={16} />
                </button>
            )}
        </div>
    );
}

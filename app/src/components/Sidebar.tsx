"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Play, Book, Music, Link as LinkIcon, Settings, Plus, Image as ImageIcon } from "lucide-react";

interface SidebarProps {
    isOpen: boolean;
}

const navItems = [
    { name: "Home", icon: Home, href: "/" },
    { name: "Videos", icon: Play, href: "/videos" },
    { name: "Images", icon: ImageIcon, href: "/images" },
    { name: "Manga", icon: Book, href: "/manga" },
    { name: "Audio", icon: Music, href: "/audio" },
    { name: "Links", icon: LinkIcon, href: "/links" },
];

export function Sidebar({ isOpen }: SidebarProps) {
    const pathname = usePathname();

    return (
        <aside
            className={`fixed left-0 top-16 bottom-0 bg-zinc-950 border-r border-white/5 overflow-hidden transition-all duration-300 ease-in-out z-40 ${isOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full opacity-0"
                }`}
        >
            <div className="flex flex-col h-full w-64"> {/* Inner container strict width */}

                {/* 🧭 Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 group ${isActive
                                    ? "bg-pink-600/10 text-pink-500"
                                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                <item.icon className="w-5 h-5 shrink-0" />
                                <span className={`font-medium ${isActive ? "font-bold" : ""}`}>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* ⚙️ Footer */}
                <div className="p-3 border-t border-white/5 space-y-2 mb-2">
                    <Link
                        href="/upload"
                        className="flex items-center gap-4 px-3 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all group"
                    >
                        <div className="w-5 h-5 rounded border border-zinc-600 group-hover:border-pink-500 flex items-center justify-center shrink-0">
                            <Plus className="w-3 h-3 group-hover:text-pink-500" />
                        </div>
                        <span className="font-medium">Add Item</span>
                    </Link>

                    <Link
                        href="/settings"
                        className="flex items-center gap-4 px-3 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all group"
                    >
                        <Settings className="w-5 h-5 shrink-0" />
                        <span className="font-medium">Settings</span>
                    </Link>

                    {/* Moca Status Widget */}
                    <div className="mt-2 p-3 rounded-xl bg-zinc-900 border border-white/5 flex items-center gap-3">
                        <div className="relative shrink-0">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse absolute top-0 right-0 border border-zinc-900" />
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs">
                                🌸
                            </div>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-zinc-300">{process.env.NEXT_PUBLIC_AI_NAME || "Core System"}</span>
                            <span className="text-[10px] text-zinc-500">Monitoring...</span>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}

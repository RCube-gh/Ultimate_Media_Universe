"use client";

import { Search, Menu, Heart, Bell, User } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SearchBar } from "./SearchBar";

interface HeaderProps {
    onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
    return (
        <header className="fixed top-0 left-0 right-0 h-16 bg-zinc-950/95 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 z-[100]">

            {/* Left: Logo & Menu */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onMenuClick}
                    className="p-2 rounded-full hover:bg-white/10 text-zinc-300 transition-colors"
                >
                    <Menu size={24} />
                </button>

                <Link href="/" className="flex items-center gap-2 group">
                    <div className="w-8 h-8 rounded-lg bg-pink-600 flex items-center justify-center shadow-lg shadow-pink-600/20 group-hover:scale-105 transition-transform">
                        <Heart className="w-5 h-5 text-white fill-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white hidden md:block">
                        {process.env.NEXT_PUBLIC_APP_NAME || "Ultimate Media Universe"}
                    </span>
                </Link>
            </div>

            {/* Center: Search Bar */}
            <div className="flex-1 max-w-2xl mx-4">
                <Suspense fallback={<div className="h-10 w-full bg-zinc-900 rounded-full animate-pulse" />}>
                    <SearchBar />
                </Suspense>
            </div>

            {/* Right: Actions & User */}
            <div className="flex items-center gap-2 sm:gap-4">
                <button className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                    <Bell size={20} />
                </button>
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 border border-white/10 flex items-center justify-center shadow-lg shadow-pink-500/10 cursor-pointer hover:scale-105 transition-transform">
                    {/* Moca User Icon */}
                    <span className="text-sm">🌸</span>
                </div>
            </div>
        </header>
    );
}

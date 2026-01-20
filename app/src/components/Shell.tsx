"use client";

import { useState, ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
    // Default open on broad screens? Let's default simply to true for PC-like feel, 
    // but maybe user wants closed initially? Let's go with TRUE mainly.
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    return (
        <div className="min-h-screen bg-black text-foreground font-sans selection:bg-pink-500/30">
            {/* 1. Header (Fixed Top) */}
            <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />

            {/* 2. Sidebar (Fixed Left, below header) */}
            <Sidebar isOpen={isSidebarOpen} />

            {/* 3. Main Content Area */}
            {/* Push content when sidebar is open using ml-64 (256px) */}
            <main
                className={`pt-16 transition-all duration-300 ease-in-out min-h-screen ${isSidebarOpen ? "ml-64" : "ml-0"
                    }`}
            >
                <div className="p-0"> {/* Remove default padding, let pages handle it */}
                    {children}
                </div>
            </main>

            {/* Optional: Mobile Overlay if we want to handle mobile distinctively later */}
        </div>
    );
}

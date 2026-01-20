import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/Shell";

const sansFont = Inter({
    variable: "--font-sans",
    subsets: ["latin"],
});

const displayFont = Outfit({
    variable: "--font-display",
    subsets: ["latin"],
});

// 🕵️‍♀️ Camouflage Metadata
export const metadata: Metadata = {
    title: process.env.NEXT_PUBLIC_APP_NAME || "Ultimate Media Universe",
    description: process.env.NEXT_PUBLIC_APP_DESC || "Secure media storage system.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark scroll-smooth">
            <body
                className={`${sansFont.variable} ${displayFont.variable} antialiased bg-black text-zinc-100 overflow-x-hidden`}
            >
                {/* 🐚 Wrap everything in the new Shell (Header + Sidebar + Content Logic) */}
                <AppShell>
                    {children}
                </AppShell>
            </body>
        </html>
    );
}

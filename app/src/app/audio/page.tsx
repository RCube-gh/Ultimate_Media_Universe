import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Headphones } from "lucide-react";
import { AudioGallery } from "@/components/AudioGallery";

// Always fetch fresh data
export const revalidate = 0;

interface Props {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AudioCatalogPage({ searchParams }: Props) {
    const { q } = await searchParams;
    const query = typeof q === 'string' ? q : undefined;

    const where: any = { type: "AUDIO" };
    if (query) {
        where.OR = [
            { title: { contains: query } },
            { description: { contains: query } },
            { tags: { some: { name: { contains: query } } } }
        ];
    }

    // 🎧 Fetch ONLY Audio items with Search
    const audios = await prisma.mediaItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { tags: true }
    });

    return (
        <div className="p-8 space-y-8 pb-32">
            {/* Header */}
            <header className="flex items-end justify-between border-b border-zinc-800 pb-6 animate-in slide-in-from-top-4 duration-500">
                <div>
                    <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
                        <Headphones className="text-pink-500 w-8 h-8" />
                        Audio Library
                    </h1>
                    <p className="text-zinc-500 mt-2">
                        ASMR, Voice Works, and Music. <span className="text-pink-400 font-bold">{audios.length}</span> albums indexed.
                    </p>
                </div>
                <Link href="/upload" className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-sm font-bold text-white rounded-lg transition-colors flex items-center gap-2">
                    Upload New
                </Link>
            </header>

            <AudioGallery items={audios as any} />
        </div>
    );
}

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
    const { q, sort } = await searchParams;
    const query = typeof q === 'string' ? q : undefined;
    const sortType = typeof sort === 'string' ? sort : "latest";

    const where: any = { type: "AUDIO" };
    if (query) {
        where.OR = [
            { title: { contains: query } },
            { description: { contains: query } },
            { tags: { some: { name: { contains: query } } } }
        ];
    }

    // 🎧 Fetch ONLY Audio items with Search
    let audios = await prisma.mediaItem.findMany({
        where,
        // No orderBy here
        include: { tags: true }
    });

    // 🧠 Sort Logic
    audios = audios.sort((a, b) => {
        switch (sortType) {
            case "oldest":
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            case "title":
                return a.title.localeCompare(b.title);
            case "title_desc":
                return b.title.localeCompare(a.title);
            case "latest":
            default:
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
    });

    return (
        <div className="p-8 space-y-8 pb-32">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-zinc-800 pb-6 animate-in slide-in-from-top-4 duration-500 gap-4">
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

            <AudioGallery items={audios as any} initialSort={sortType} />
        </div>
    );
}

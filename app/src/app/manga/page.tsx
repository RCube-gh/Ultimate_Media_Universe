import { prisma } from "@/lib/prisma";
import { Book } from "lucide-react";
import { MangaGallery } from "@/components/MangaGallery";

// Always fetch fresh data
export const revalidate = 0;


interface Props {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function MangaCatalogPage({ searchParams }: Props) {
    const { q } = await searchParams;
    const query = typeof q === 'string' ? q : undefined;

    const where: any = { type: "MANGA" };
    if (query) {
        where.OR = [
            { title: { contains: query } },
            { description: { contains: query } },
            { tags: { some: { name: { contains: query } } } }
        ];
    }

    // 📚 Fetch ONLY Manga items with Search
    const mangas = await prisma.mediaItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { tags: true }
    });

    return (
        <div className="p-8 space-y-8">
            {/* Header */}
            <header className="flex items-end justify-between border-b border-zinc-800 pb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
                        <Book className="text-pink-500 w-8 h-8" />
                        Manga Library
                    </h1>
                    <p className="text-zinc-500 mt-2">
                        Your private collection. <span className="text-pink-400 font-bold">{mangas.length}</span> titles indexed.
                    </p>
                </div>
            </header>

            <MangaGallery items={mangas as any} />
        </div>
    );
}

import { prisma } from "@/lib/prisma";
import { Book } from "lucide-react";
import { MangaGallery } from "@/components/MangaGallery";

// Always fetch fresh data
export const revalidate = 0;


interface Props {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function MangaCatalogPage({ searchParams }: Props) {
    const { q, sort } = await searchParams;
    const query = typeof q === 'string' ? q : undefined;
    const sortType = typeof sort === 'string' ? sort : "latest";

    const where: any = { type: "MANGA" };
    if (query) {
        where.OR = [
            { title: { contains: query } },
            { description: { contains: query } },
            { tags: { some: { name: { contains: query } } } }
        ];
    }

    // 📚 Fetch ONLY Manga items with Search
    let mangas = await prisma.mediaItem.findMany({
        where,
        // No orderBy here, manual sort
        include: { tags: true }
    });

    // 🧠 Sort Logic
    mangas = mangas.sort((a, b) => {
        switch (sortType) {
            case "oldest":
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            case "title":
                return a.title.localeCompare(b.title);
            case "title_desc":
                return b.title.localeCompare(a.title);
            case "pages_desc":
                return (b.pages || 0) - (a.pages || 0);
            case "pages_asc":
                return (a.pages || 0) - (b.pages || 0);
            case "latest":
            default:
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
    });

    return (
        <div className="p-8 space-y-8">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-zinc-800 pb-6 gap-4">
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

            <MangaGallery items={mangas as any} initialSort={sortType} />
        </div>
    );
}

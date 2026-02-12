import { prisma } from "@/lib/prisma";
import { ExternalLink, Globe } from "lucide-react";
import { LinkGallery } from "@/components/LinkGallery";

export const dynamic = "force-dynamic";

export default async function LinksPage({ searchParams }: { searchParams: Promise<{ q?: string, sort?: string }> }) {
    const { q, sort } = await searchParams;
    const query = q || "";
    const sortType = sort || "latest";

    const where: any = { type: "LINK" };
    if (query) {
        where.OR = [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { tags: { some: { name: { contains: query, mode: 'insensitive' } } } }
        ];
    }

    // 🧠 脳みそから「LINK」タイプのアイテムだけ取ってくる！ (検索付き)
    let links = await prisma.mediaItem.findMany({
        where,
        // Manual Sort
        include: { tags: true }
    });

    // 🧠 Sort Logic
    links = links.sort((a, b) => {
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
        <div className="p-8 space-y-8">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Globe className="text-pink-500" />
                    <span>Web Bookmarks</span>
                </h1>
            </header>

            <LinkGallery items={links as any} initialSort={sortType} />
        </div>
    );
}

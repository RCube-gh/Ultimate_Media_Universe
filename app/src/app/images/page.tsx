import { prisma } from "@/lib/prisma";
import { Image as ImageIcon } from "lucide-react";
import { ImageGallery } from "@/components/ImageGallery";

export const dynamic = "force-dynamic";

export default async function ImagesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const { q } = await searchParams;
    const query = q || "";

    // 🧠 脳みそから「IMAGE」タイプのアイテムだけ取ってくる！ (検索付き)
    const images = await prisma.mediaItem.findMany({
        where: {
            type: "IMAGE",
            ...(query ? { title: { contains: query } } : {})
        },
        orderBy: { createdAt: "desc" },
        include: { tags: true } // Include tags for the gallery
    });

    return (
        <div className="p-8 min-h-screen bg-zinc-950 text-white">
            <header className="mb-8 pl-2">
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <span className="p-2 bg-pink-500/10 rounded-lg text-pink-500">
                        <ImageIcon size={32} />
                    </span>
                    Images Library
                </h1>
                <p className="text-zinc-500 mt-2">
                    Collection of Single CGs, GIFs, and Illustrations.
                </p>
            </header>

            <ImageGallery items={images as any} />
        </div>
    );
}

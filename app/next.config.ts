import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    basePath: "/umu",
    /* config options here */
    serverExternalPackages: ['sharp', 'prisma', '@prisma/client'],
    experimental: {
        serverActions: {
            bodySizeLimit: '5gb', // 🔥 5GBまで受け入れ可能にする！
        },
    },
};

export default nextConfig;

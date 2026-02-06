import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    basePath: "/umu",
    /* config options here */
    experimental: {
        serverActions: {
            bodySizeLimit: '5gb', // 🔥 5GBまで受け入れ可能にする！
        },
        // 🛠️ Native Modules are External
        serverComponentsExternalPackages: ['sharp', 'prisma', '@prisma/client'],
    },
};

export default nextConfig;

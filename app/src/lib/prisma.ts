import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: ["query"], // 開発中はSQLログを吐かせて、何してるか監視するねっ！👁️
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

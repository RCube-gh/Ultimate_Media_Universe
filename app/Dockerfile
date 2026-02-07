# ================================
# Stage 1: deps
# ================================
FROM node:20-bookworm-slim AS deps

WORKDIR /app

# ★ OpenSSL を必ず入れる（Prisma 必須）
RUN apt-get update \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

# 依存関係
COPY package.json package-lock.json* ./
RUN npm ci


# ================================
# Stage 2: builder
# ================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# ★ builder でも OpenSSL を入れる
RUN apt-get update \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

# ソースコピー
COPY . .

# 汚染防止
RUN rm -rf .next node_modules

# clean node_modules を復元
COPY --from=deps /app/node_modules ./node_modules

# Prisma Client 生成
RUN npx prisma generate

# Next.js telemetry 無効
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js build（standalone）
RUN npm run build


# ================================
# Stage 3: runner (production)
# ================================
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# ★ runner にも OpenSSL を入れる（実行時に必要）
RUN apt-get update \
    && apt-get install -y openssl \
    && rm -rf /var/lib/apt/lists/*

# 非 root ユーザー
RUN addgroup --system --gid 1001 nodejs \
    && adduser  --system --uid 1001 nextjs

# Next.js standalone 出力
# Next.js standalone 出力
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma を含む node_modules を丸ごとコピー
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Prisma schema（必要な場合）
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# 権限調整スクリプト
COPY --chown=nextjs:nodejs entrypoint.sh ./
RUN chmod +x entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]


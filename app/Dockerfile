# ================================
# Stage 1: deps
# ================================
FROM node:20-bookworm-slim AS deps

WORKDIR /app

# 依存関係のインストール
COPY package.json package-lock.json* ./
RUN npm ci


# ================================
# Stage 2: builder
# ================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app
COPY . .

# 汚染防止
RUN rm -rf .next node_modules

# clean node_modules を復元
COPY --from=deps /app/node_modules ./node_modules

# Prisma Client 生成（★重要）
RUN npx prisma generate

# Next.js telemetry off
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

# 非 root ユーザー
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Next.js standalone 出力
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# ★ Prisma を含む node_modules を丸ごとコピー
COPY --from=builder /app/node_modules ./node_modules

# Prisma schema（必要な場合）
COPY --from=builder /app/prisma ./prisma

# 権限調整
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]


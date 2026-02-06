# ================================
# Stage 1: deps
# ================================
FROM node:20-alpine AS deps

# Prisma / native deps
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    openssl \
    openssl-dev

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci


# ================================
# Stage 2: builder
# ================================
FROM node:20-alpine AS builder

WORKDIR /app
COPY . .

# 念のため汚染除去
RUN rm -rf .next node_modules

# clean node_modules を復元
COPY --from=deps /app/node_modules ./node_modules

# Prisma Client 生成（★重要）
RUN npx prisma generate

# telemetry off
ENV NEXT_TELEMETRY_DISABLED 1

# Next.js build（standalone 出力）
RUN npm run build


# ================================
# Stage 3: runner (production)
# ================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 非 root ユーザー
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# ---- Next.js standalone ----
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# ---- Prisma runtime 必須物 ----
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Prisma schema（migrate 等で使う場合）
COPY --from=builder /app/prisma ./prisma

# ★ runtime では @prisma/client を“ちゃんと”入れる
RUN npm install --omit=dev @prisma/client prisma \
 && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]


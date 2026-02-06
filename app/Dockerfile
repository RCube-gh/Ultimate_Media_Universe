# ================================
# Stage 1: deps
# ================================
FROM node:20-alpine AS deps
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

# clean
RUN rm -rf .next node_modules
COPY --from=deps /app/node_modules ./node_modules

# Prisma
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


# ================================
# Stage 3: runner
# ================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Next standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# ★ ここが最重要：node_modules を丸ごと持ってくる
COPY --from=builder /app/node_modules ./node_modules

# Prisma schema
COPY --from=builder /app/prisma ./prisma

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]


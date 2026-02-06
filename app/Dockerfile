
# 🏗️ Stage 1: Install dependencies
FROM node:20-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat python3 make g++ openssl openssl-dev

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# 🏗️ Stage 2: Build the app
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED 1

# Build Next.js app
RUN npm run build

# 🏗️ Stage 3: Production image, copy all the files and run next
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set correct permissions for nextjs user
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Prisma schema and migrations for runtime usage if needed (e.g. migrations)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Also need db/assets folders
# We will mount volumes for these in docker-compose, but we need the directories to exist
RUN mkdir -p /app/db /app/library && chown nextjs:nodejs /app/db /app/library

# Install Prisma CLI for production migrations
RUN npm install prisma@5.22.0
RUN chown -R nextjs:nodejs /app/node_modules

USER nextjs

EXPOSE 3000

ENV PORT 3000
# set hostname to localhost
ENV HOSTNAME "0.0.0.0"

# Start script
CMD ["node", "server.js"]

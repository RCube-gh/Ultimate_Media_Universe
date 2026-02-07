#!/bin/sh
set -e

echo "🚀 Initializing Fapflix Environment..."

# 1. Library Directories
echo "📁 Checking library directories..."
mkdir -p /library/uploads
mkdir -p /library/thumbnails
mkdir -p /library/manga
mkdir -p /library/audio

# 2. Database Directory
echo "📁 Checking database directory..."
mkdir -p /app/db # SQLiteファイルの置き場所

# 3. Cache Directories
echo "📁 Checking cache directories..."
mkdir -p /app/.cache/thumbnails

# 4. Permissions (Try to fix if possible, though host volume mounts might restrict this)
echo "🔒 Fixing permissions..."
chown -R nextjs:nodejs /library || true
chown -R nextjs:nodejs /app/db || true
chown -R nextjs:nodejs /app/.cache || true


echo "📦 Applying database migrations..."
if [ -f "/app/prisma/schema.prisma" ]; then
    npx prisma db push --accept-data-loss
else
    echo "⚠️ Prisma schema not found, skipping migration."
fi


echo "✅ Environment ready. Starting server..."

# 元のCMDを実行（server.js）
exec "$@"

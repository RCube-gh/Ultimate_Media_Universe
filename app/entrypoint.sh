#!/bin/sh
set -e

echo "🚀 Initializing Fapflix Environment..."

# 1. Library Directories
echo "📁 Checking library directories..."
mkdir -p /app/library/uploads
mkdir -p /app/library/thumbnails
mkdir -p /app/library/manga
mkdir -p /app/library/audio

# 2. Database Directory
echo "📁 Checking database directory..."
mkdir -p /app/db # SQLiteファイルの置き場所

# 3. Cache Directories
echo "📁 Checking cache directories..."
mkdir -p /app/.cache/thumbnails

# 4. Permissions (Try to fix if possible, though host volume mounts might restrict this)
echo "🔒 Fixing permissions..."
chown -R nextjs:nodejs /app/library || true
chown -R nextjs:nodejs /app/db || true
chown -R nextjs:nodejs /app/.cache || true


echo "✅ Environment ready. Starting server..."

# 元のCMDを実行（server.js）
exec "$@"

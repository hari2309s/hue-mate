#!/bin/bash

echo "🧹 Cleaning up TypeScript build artifacts..."

# Clean all dist directories
echo "Removing dist directories..."
find . -name "dist" -type d -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null

# Clean all generated JS files in src directories
echo "Removing generated .js files..."
find packages/*/src -name "*.js" -type f -delete 2>/dev/null
find apps/*/src -name "*.js" -type f -delete 2>/dev/null

# Clean all .d.ts files except those in node_modules
echo "Removing generated .d.ts files..."
find packages/*/src -name "*.d.ts" -type f -delete 2>/dev/null
find apps/*/src -name "*.d.ts" -type f -delete 2>/dev/null

# Clean all .map files
echo "Removing .map files..."
find packages -name "*.map" -type f -not -path "*/node_modules/*" -delete 2>/dev/null
find apps -name "*.map" -type f -not -path "*/node_modules/*" -delete 2>/dev/null

# Clean TypeScript build info
echo "Removing .tsbuildinfo files..."
find . -name "*.tsbuildinfo" -type f -not -path "*/node_modules/*" -delete 2>/dev/null

# Clean turbo cache
echo "Cleaning turbo cache..."
rm -rf .turbo

# Clean Next.js build
echo "Cleaning Next.js build..."
rm -rf apps/web/.next

echo "✅ Cleanup complete!"
echo ""
echo "📦 Run 'pnpm install' to ensure dependencies are up to date"
echo "🔨 Then run 'pnpm build' to rebuild the project"

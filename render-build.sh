#!/usr/bin/env bash
set -euo pipefail
echo "==> Node $(node -v)"
echo "==> npm $(npm -v)"
echo "==> cwd $(pwd)"
ls -la

echo "==> npm install..."
npm install --include=dev --no-audit --no-fund --legacy-peer-deps

echo "==> check vite binary..."
if [ ! -f node_modules/vite/bin/vite.js ] && [ ! -f node_modules/.bin/vite ]; then
  echo "vite missing — installing explicitly"
  npm install vite@6 @vitejs/plugin-react --no-audit --no-fund --legacy-peer-deps
fi
ls -la node_modules/.bin/vite 2>/dev/null || ls -la node_modules/vite/package.json

echo "==> vite build..."
npx --no-install vite build || npx vite build

echo "==> dist contents:"
ls -la dist
test -f dist/index.html
echo "==> Build OK"

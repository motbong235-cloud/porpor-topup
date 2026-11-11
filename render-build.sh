#!/usr/bin/env bash
set -euo pipefail
echo "==> Node $(node -v)"
echo "==> npm $(npm -v)"
echo "==> cwd $(pwd)"
ls -la

echo "==> npm install..."
npm install --include=dev --no-audit --no-fund --legacy-peer-deps

echo "==> check vite binary..."
if [ ! -f node_modules/.bin/vite ] && [ ! -f node_modules/vite/bin/vite.js ]; then
  echo "vite missing — installing vite@6 explicitly"
  npm install vite@6.0.7 @vitejs/plugin-react@4.3.4 --no-audit --no-fund --legacy-peer-deps
fi
ls -la node_modules/.bin/vite 2>/dev/null || ls -la node_modules/vite/package.json

echo "==> vite build (pinned v6)..."
# Never fall back to bare `npx vite` (pulls vite 8 and breaks the config)
if [ -x node_modules/.bin/vite ]; then
  node_modules/.bin/vite build
elif [ -f node_modules/vite/bin/vite.js ]; then
  node node_modules/vite/bin/vite.js build
else
  npx -y vite@6.0.7 build
fi

echo "==> dist contents:"
ls -la dist
test -f dist/index.html
echo "==> Build OK"

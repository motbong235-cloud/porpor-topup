#!/usr/bin/env bash
set -euo pipefail
echo "==> Node $(node -v)"
echo "==> npm $(npm -v)"
echo "==> cwd $(pwd)"
echo "==> commit $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

echo "==> npm install..."
npm install --include=dev --no-audit --no-fund --legacy-peer-deps

# Ensure vite 6 is present (never rely on bare npx vite → vite 8)
if [ ! -x node_modules/.bin/vite ]; then
  echo "==> vite binary missing — installing vite@6.0.7"
  npm install vite@6.0.7 @vitejs/plugin-react@4.3.4 --no-audit --no-fund --legacy-peer-deps --save
fi

echo "==> vite version:"
node_modules/.bin/vite --version || true

echo "==> npm run build..."
npm run build

echo "==> dist contents:"
ls -la dist
test -f dist/index.html
echo "==> Build OK"

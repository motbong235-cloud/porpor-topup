#!/usr/bin/env bash
set -euo pipefail

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=768}"
echo "==> Node $(node -v) | npm $(npm -v)"
echo "==> cwd $(pwd)"

# Clean partial installs
rm -rf node_modules/.vite 2>/dev/null || true

echo "==> npm install"
npm install --no-audit --no-fund --legacy-peer-deps

if [ ! -f node_modules/vite/package.json ]; then
  echo "==> vite missing, force install vite@6"
  npm install vite@6.0.7 @vitejs/plugin-react@4.3.4 --no-audit --no-fund --legacy-peer-deps --save
fi

echo "==> vite $(node -p "require('./node_modules/vite/package.json').version")"

echo "==> building..."
# Prefer local binary; never unpinned npx vite
export PATH="$PWD/node_modules/.bin:$PATH"
vite build

echo "==> dist:"
ls -la dist
test -f dist/index.html
echo "==> Build OK"

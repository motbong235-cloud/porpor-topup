#!/usr/bin/env bash
set -eu
echo "==> Node $(node -v) npm $(npm -v)"
echo "==> files:"; ls -la package.json vite.config.js index.html

echo "==> npm install (no optional)"
npm install --no-optional --no-audit --no-fund --legacy-peer-deps

echo "==> which vite"
ls -la node_modules/vite/package.json
ls -la node_modules/.bin/vite || true

echo "==> build"
node node_modules/vite/bin/vite.js build

echo "==> dist"
ls -la dist
test -f dist/index.html
echo "==> BUILD OK"

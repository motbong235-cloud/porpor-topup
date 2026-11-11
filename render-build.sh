#!/usr/bin/env bash
set -eu
echo "==> Node $(node -v) npm $(npm -v)"

echo "==> npm install"
npm install --no-audit --no-fund --legacy-peer-deps

# Fix Render + npm optional native bug (rollup linux binary)
echo "==> ensure rollup linux binary"
npm install @rollup/rollup-linux-x64-gnu@4.28.1 --no-audit --no-fund --legacy-peer-deps || true

echo "==> vite version"
node -p "require('vite/package.json').version"

echo "==> build"
node node_modules/vite/bin/vite.js build

echo "==> dist"
ls -la dist
test -f dist/index.html
echo "==> BUILD OK"

#!/usr/bin/env bash
set -euo pipefail
echo "==> Node $(node -v)"
echo "==> npm $(npm -v)"
echo "==> cwd $(pwd)"
ls -la
npm install --include=dev --no-audit --no-fund
npm run build
echo "==> dist contents:"
ls -la dist || true
test -f dist/index.html
echo "==> Build OK"

#!/usr/bin/env bash
set -eu
echo "==> Node $(node -v) npm $(npm -v)"

install_deps() {
  echo "==> clean npm install"
  rm -rf node_modules
  npm install --no-audit --no-fund --legacy-peer-deps --include=optional

  # Fix Render + npm optional native bug (rollup linux binary)
  echo "==> ensure rollup linux binary"
  npm install @rollup/rollup-linux-x64-gnu@4.28.1 --no-audit --no-fund --legacy-peer-deps --include=optional || true

  # Fix esbuild JS/binary version mismatch ("Host version ... does not match binary version")
  want=$(node -p "require('esbuild/package.json').version")
  have=$(node node_modules/esbuild/bin/esbuild --version 2>/dev/null || echo none)
  echo "==> esbuild package=$want binary=$have"
  if [ "$want" != "$have" ]; then
    echo "==> esbuild mismatch - reinstalling matching binary"
    rm -rf node_modules/esbuild node_modules/@esbuild
    npm install "esbuild@$want" --no-save --no-audit --no-fund --legacy-peer-deps --include=optional
  fi

  echo "==> vite version"
  node -p "require('vite/package.json').version"
}

run_build() {
  echo "==> build"
  node node_modules/vite/bin/vite.js build
}

install_deps
if ! run_build; then
  echo "==> build failed - retrying once after npm cache clean + fresh install"
  npm cache clean --force || true
  install_deps
  run_build
fi

echo "==> dist"
ls -la dist
test -f dist/index.html
echo "==> BUILD OK"

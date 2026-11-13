#!/data/data/com.termux/files/usr/bin/bash

set -e

REPO="https://github.com/motbong235-cloud/porpor-topup.git"
DIR="$HOME/porpor-topup"
PATCH="$HOME/storage/downloads/video-only-tiktok-khmer.patch"

echo "================================"
echo "   PORPOR TOPUP PATCH UPLOADER"
echo "================================"

# Check patch
if [ ! -f "$PATCH" ]; then
    echo "ERROR: Patch file not found!"
    exit 1
fi

# Clone repository
if [ ! -d "$DIR/.git" ]; then
    git clone "$REPO" "$DIR"
fi

cd "$DIR"

# Pull latest code
git pull --rebase origin main

# Check patch
git apply --check "$PATCH"

# Apply patch
git apply "$PATCH"

# Commit changes
git add -A
git commit -m "Apply TikTok Khmer patch"

# Upload to GitHub
git push origin main

echo "================================"
echo " SUCCESS! PATCH UPLOADED"
echo "================================"

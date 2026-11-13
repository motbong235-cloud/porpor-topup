#!/data/data/com.termux/files/usr/bin/bash

set -e

REPO="https://github.com/motbong235-cloud/porpor-topup.git"
DIR="$HOME/porpor-topup"
ZIP="/sdcard/Download/porpor-update.zip"

echo "================================"
echo "    PORPOR TOPUP AUTO UPLOADER"
echo "================================"

# Check ZIP
if [ ! -f "$ZIP" ]; then
    echo "ERROR: ZIP file not found!"
    echo "Put porpor-update.zip in Download folder."
    exit 1
fi

# Clone repository
if [ ! -d "$DIR/.git" ]; then
    git clone "$REPO" "$DIR"
fi

cd "$DIR"

# Update repository
git pull --rebase origin main

# Extract and overwrite updated files
unzip -o "$ZIP" -d "$DIR"

# Commit changes
git add -A

if git diff --cached --quiet; then
    echo "No changes to upload."
    exit 0
fi

git commit -m "Update Porpor Topup website"

# Push to GitHub
git push origin main

echo "================================"
echo " SUCCESS! UPLOAD COMPLETED"
echo "================================"
echo "Repository:"
echo "$REPO"

#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
REPO_URL="https://github.com/motbong235-cloud/porpor-topup.git"
BRANCH="main"
GH_USER_DEFAULT="motbong235-cloud"
MSG="${1:-style: match dino layout}"
cd "$(dirname "$0")"
command -v git >/dev/null 2>&1 || { pkg update -y && pkg install -y git; }
touch .gitignore
for p in node_modules/ dist/ data/ .env "*.log"; do
  grep -qxF "$p" .gitignore || echo "$p" >> .gitignore
done
[ -d .git ] || git init -q
git checkout -q -B "$BRANCH"
git config user.name  >/dev/null 2>&1 || git config user.name  "Phanna"
git config user.email >/dev/null 2>&1 || git config user.email "phanna@users.noreply.github.com"
if git remote get-url origin >/dev/null 2>&1; then git remote set-url origin "$REPO_URL"; else git remote add origin "$REPO_URL"; fi
read -r -p "GitHub username [$GH_USER_DEFAULT]: " GH_USER
GH_USER="${GH_USER:-$GH_USER_DEFAULT}"
read -r -s -p "GitHub Token: " GH_TOKEN; echo
[ -n "$GH_TOKEN" ] || { echo "មិនមាន token"; exit 1; }
ASKPASS="$(mktemp)"
cat > "$ASKPASS" <<EOF
#!/data/data/com.termux/files/usr/bin/sh
case "\$1" in
  Username*) echo "$GH_USER" ;;
  *) echo "$GH_TOKEN" ;;
esac
EOF
chmod 700 "$ASKPASS"; trap 'rm -f "$ASKPASS"' EXIT
export GIT_ASKPASS="$ASKPASS" GIT_TERMINAL_PROMPT=0
if git fetch -q origin "$BRANCH" 2>/dev/null; then git reset -q --soft "origin/$BRANCH"; fi
git add -A
git diff --cached --quiet || git commit -q -m "$MSG"
git push -u origin "$BRANCH"
echo "✅ ជោគជ័យ"

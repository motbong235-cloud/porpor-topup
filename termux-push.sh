#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
#  porpor-topup — push ទៅ GitHub ពី Termux
#  ប្រើ: bash termux-push.sh ["សារ commit"]
#  Token មិនត្រូវបានរក្សាទុកក្នុងឯកសារ ឬ git config ទេ
# ============================================================
set -euo pipefail

REPO_URL="https://github.com/motbong235-cloud/porpor-topup.git"
BRANCH="main"
GH_USER_DEFAULT="motbong235-cloud"
MSG="${1:-feat: Fox Topup supplier + storefront cleanup}"

cd "$(dirname "$0")"

echo "==> ពិនិត្យ git..."
if ! command -v git >/dev/null 2>&1; then
  pkg update -y && pkg install -y git
fi

# កុំឲ្យ push ឯកសារសំងាត់ / ធំ
touch .gitignore
for p in node_modules/ dist/ data/ .env "*.log"; do
  grep -qxF "$p" .gitignore || echo "$p" >> .gitignore
done

if [ ! -d .git ]; then
  echo "==> git init"
  git init -q
fi
git checkout -q -B "$BRANCH"

# identity (តែបើមិនទាន់មាន)
git config user.name  >/dev/null 2>&1 || git config user.name  "Phanna"
git config user.email >/dev/null 2>&1 || git config user.email "phanna@users.noreply.github.com"

# remote (URL ស្អាត គ្មាន token)
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

# ---------- Auth តាម GIT_ASKPASS (token មិនចូល history/config) ----------
read -r -p "GitHub username [$GH_USER_DEFAULT]: " GH_USER
GH_USER="${GH_USER:-$GH_USER_DEFAULT}"
read -r -s -p "GitHub Personal Access Token (ghp_... / github_pat_...): " GH_TOKEN
echo
[ -n "$GH_TOKEN" ] || { echo "មិនមាន token"; exit 1; }

ASKPASS="$(mktemp)"
cat > "$ASKPASS" <<EOF
#!/data/data/com.termux/files/usr/bin/sh
case "\$1" in
  Username*) echo "$GH_USER" ;;
  *)         echo "$GH_TOKEN" ;;
esac
EOF
chmod 700 "$ASKPASS"
trap 'rm -f "$ASKPASS"' EXIT
export GIT_ASKPASS="$ASKPASS" GIT_TERMINAL_PROMPT=0

# ---------- ទាញប្រវត្តិចាស់ពី GitHub (បើមាន) ----------
echo "==> fetch origin..."
if git fetch -q origin "$BRANCH" 2>/dev/null; then
  # រក្សាប្រវត្តិចាស់ តែយកឯកសារបច្ចុប្បន្នជាស្ថានភាពថ្មី (មិន force push)
  git reset -q --soft "origin/$BRANCH"
  echo "    រក្សាប្រវត្តិ commit ចាស់ពី origin/$BRANCH"
else
  echo "    repo នៅទទេ ឬ branch មិនទាន់មាន — push ជាលើកដំបូង"
fi

git add -A
if git diff --cached --quiet; then
  echo "==> គ្មានអ្វីប្រែប្រួលត្រូវ commit"
else
  git commit -q -m "$MSG"
  echo "==> commit រួច: $MSG"
fi

echo "==> push ទៅ $REPO_URL ($BRANCH)..."
git push -u origin "$BRANCH"

echo
echo "✅ ជោគជ័យ!  https://github.com/motbong235-cloud/porpor-topup"
echo "   Render នឹង auto-deploy ប្រសិនបើភ្ជាប់ repo រួច។"

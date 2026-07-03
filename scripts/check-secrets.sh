#!/usr/bin/env bash
#
# Pre-commit secret scanner. Blocks a commit when staged changes contain an
# API-key-like string or a tracked .env file. Dependency-free (git + grep),
# and compatible with the bash 3.2 that ships on macOS.
#
# Bypass for a genuine false positive: `git commit --no-verify`.
#
set -u

red()  { printf '\033[31m%s\033[0m\n' "$1"; }
ylw()  { printf '\033[33m%s\033[0m\n' "$1"; }

fail=0

# Staged files being added/copied/modified (not deletions), NUL-safe enough
# for normal paths.
staged="$(git diff --cached --name-only --diff-filter=ACM)"
[ -z "$staged" ] && exit 0

# 1) Never allow a real .env file to be committed (only .env.example is OK).
while IFS= read -r f; do
  [ -z "$f" ] && continue
  case "$f" in
    *.env.example) ;;                 # allowed
    .env|.env.*|*/.env|*/.env.*)
      red "✗ Refusing to commit env file: $f"
      ylw "  Secrets belong in .env.local (gitignored), not in git."
      fail=1
      ;;
  esac
done <<EOF
$staged
EOF

# 2) Scan the *added* lines of the staged diff for key-like patterns.
#    -U0 → only changed lines; keep additions ('+') but drop file headers.
added="$(git diff --cached -U0 --no-color | grep -E '^\+' | grep -vE '^\+\+\+' || true)"

# Pattern|label pairs. Patterns are deliberately specific to limit noise.
patterns="
AQ\.[A-Za-z0-9_-]{15,}|Google AI Studio / Gemini key
AIza[0-9A-Za-z_-]{35}|Google API key
sk-[A-Za-z0-9]{20,}|OpenAI-style secret key
ghp_[A-Za-z0-9]{30,}|GitHub personal access token
AKIA[0-9A-Z]{16}|AWS access key id
xox[baprs]-[A-Za-z0-9-]{10,}|Slack token
-----BEGIN [A-Z ]*PRIVATE KEY-----|Private key block
"

if [ -n "$added" ]; then
  while IFS= read -r entry; do
    [ -z "$entry" ] && continue
    re="${entry%%|*}"
    label="${entry#*|}"
    hits="$(printf '%s\n' "$added" | grep -nE -- "$re" || true)"
    if [ -n "$hits" ]; then
      red "✗ Possible $label in staged changes:"
      printf '%s\n' "$hits" | sed 's/^/    /'
      fail=1
    fi
  done <<EOF
$patterns
EOF
fi

if [ "$fail" -ne 0 ]; then
  echo
  ylw "Commit blocked by scripts/check-secrets.sh."
  ylw "If this is a false positive, re-run with:  git commit --no-verify"
  exit 1
fi

exit 0

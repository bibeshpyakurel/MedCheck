#!/usr/bin/env bash
# Deploys the head of origin/dev to production, only when the user asks. Vercel no longer deploys on
# push or PR (vercel.json `git.deploymentEnabled: false`), so this is the one way code goes live.
#
#   npm run deploy:prod             # deploy origin/dev, then fast-forward main to it
#   npm run deploy:prod -- --dry-run
#
# Only committed files are uploaded: origin/dev is exported with `git archive` into a temp folder,
# so .env.local, node_modules and uncommitted work never leave this machine. Vercel builds it with the
# project's Production environment variables. On success `main` is fast-forwarded to the deployed
# commit, so `main` keeps recording what is live.
set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

export VERCEL_ORG_ID="team_lFvvvc2gVCVv3IbukxB8VLHz"
export VERCEL_PROJECT_ID="prj_wxCyqg9pwbeZ0WLBuUn0dn0AhqPe"
REPO="bibeshpyakurel/MedCheck"

git fetch --quiet origin dev
SHA=$(git rev-parse origin/dev)
echo "Deploying origin/dev @ ${SHA:0:7}: $(git log -1 --format=%s "$SHA")"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
git archive "$SHA" | tar -x -C "$TMP"

if $DRY_RUN; then
  echo "Dry run: would deploy $(find "$TMP" -type f | wc -l | tr -d ' ') committed files to production, then fast-forward main to ${SHA:0:7}."
  exit 0
fi

URL=$(cd "$TMP" && vercel deploy --prod --yes --meta "githubCommitSha=$SHA")
echo "Live: $URL"

status=$(gh api "repos/$REPO/compare/main...$SHA" --jq .status)
case "$status" in
  ahead) gh api -X PATCH "repos/$REPO/git/refs/heads/main" -f sha="$SHA" -F force=false > /dev/null && echo "main → ${SHA:0:7}" ;;
  identical | behind) echo "main already contains ${SHA:0:7}" ;;
  *) echo "main has diverged from dev ($status); not moved" >&2 ;;
esac

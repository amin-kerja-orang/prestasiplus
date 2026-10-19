#!/usr/bin/env bash
# Creates (or updates) the GitHub labels the backend programme uses. Idempotent.
# LEAD runs this once, after `gh auth login`:  bash scripts/gh-labels.sh
set -euo pipefail

REPO="${1:-amin-kerja-orang/prestasiplus}"

if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged in. Run: gh auth login" >&2
  exit 1
fi

label() { gh label create "$1" --repo "$REPO" --color "$2" --description "$3" --force; }

for n in 1 2 3 4 5 6; do
  label "lane:PC-$n" "1d76db" "File-ownership lane PC-$n (see docs/plan/sessions.md)"
done
label "contract"        "0e8a16" "Changes packages/contract; the LEAD merges these first"
label "security-review" "d93f0b" "Needs a security review before merge"
label "blocked"         "b60205" "Card is blocked; reason is in the tracker row"
label "question"        "d876e3" "Question for the LEAD"
label "cross-lane"      "fbca04" "Needs a change in a folder owned by another lane"
label "lead"            "000000" "Instruction from the LEAD; read before starting"

echo "Labels ready on $REPO"

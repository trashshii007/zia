#!/bin/sh
# Builds zia.uc.js and chrome.css from the per-feature parts in src/.
#   scripts/build.sh          rebuild both files
#   scripts/build.sh --check  fail if either file doesn't match src/
set -eu
cd "$(dirname "$0")/.."

build() {
  LC_ALL=C ls "src/$1"/*."$2" | while IFS= read -r part; do cat "$part"; done
}

if [ "${1:-}" = "--check" ]; then
  status=0
  build js js | cmp -s - zia.uc.js || { echo "zia.uc.js doesn't match src/js; run scripts/build.sh" >&2; status=1; }
  build css css | cmp -s - chrome.css || { echo "chrome.css doesn't match src/css; run scripts/build.sh" >&2; status=1; }
  exit "$status"
fi

build js js > zia.uc.js
build css css > chrome.css
echo "Built zia.uc.js and chrome.css from src/"

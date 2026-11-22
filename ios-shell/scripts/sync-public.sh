#!/usr/bin/env bash
# Spiegelt die Hülle ins öffentliche Repo philipp-geib/trekking-app (dort laufen die Mac-Builds kostenlos).
# Ohne Android-Schlüssel. Aufruf: bash ios-shell/scripts/sync-public.sh <Klon von trekking-app>
set -euo pipefail
DST="${1:?Ziel-Ordner (Klon von trekking-app)}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
find "$DST" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
git ls-files ios-shell | grep -v -e '^ios-shell/android-signing/' -e '^ios-shell/public/' | while read -r f; do
  mkdir -p "$DST/$(dirname "$f")" && cp "$f" "$DST/$f"
done
mkdir -p "$DST/app/src/lib" "$DST/.github/workflows"
cp app/src/lib/geo.ts app/src/lib/turns.ts "$DST/app/src/lib/"
cp ios-shell/public/README.md "$DST/README.md"
cp ios-shell/public/workflows/ipa.yml "$DST/.github/workflows/ipa.yml"
printf 'node_modules/\n.expo/\n/ios-shell/ios/\n/ios-shell/android/\n*.ipa\n*.apk\n' > "$DST/.gitignore"
echo "Gespiegelt: $(git rev-parse --short HEAD)"

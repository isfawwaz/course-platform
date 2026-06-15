#!/usr/bin/env bash
# Refresh docs/ — the vendored, READ-ONLY mirror of the Course Platform specs.
# docs/ is generated; never hand-edit it. Edit the canonical source in Cowork, then run this.
#
# Source: $DOCS_SRC (default: the Cowork planning workspace) — holds 01_DOCS/ + the setup note.
# NOTE: the db/ migrations, seed, and types are intentionally NOT mirrored — the repo owns those
#       (supabase/ and src/lib/supabase/database.types.ts). See docs/README.md.
#
# Usage:  ./scripts/sync-docs.sh
#         DOCS_SRC="/path/to/Course Platform" ./scripts/sync-docs.sh
set -euo pipefail

SRC="${DOCS_SRC:-$HOME/Documents/Cowork OS v2/Outputs/Course Platform}"
DEST="$(cd "$(dirname "$0")/.." && pwd)/docs"

# Curated subset the context/ files point at:
ITEMS=(01_DOCS db/SUPABASE-SETUP.md COURSE-PLATFORM-CONTEXT.md)

if [ ! -d "$SRC" ]; then
  echo "ERROR: source not found: $SRC"
  echo "Set DOCS_SRC to the canonical Course Platform specs folder."
  exit 1
fi

echo "Syncing docs/ <- $SRC"
for item in "${ITEMS[@]}"; do
  if [ -e "$SRC/$item" ]; then
    # db/SUPABASE-SETUP.md flattens to docs/SUPABASE-SETUP.md
    dest_name="$(basename "$item")"
    rm -rf "${DEST:?}/$dest_name"
    cp -R "$SRC/$item" "$DEST/$dest_name"
    echo "  ✓ $item -> docs/$dest_name"
  else
    echo "  - skipped (not in source): $item"
  fi
done

find "$DEST" -name .DS_Store -delete 2>/dev/null || true
echo "Done. docs/ is a generated mirror — do not hand-edit (see docs/README.md)."

#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env}"
EXAMPLE_FILE="${2:-.env.example}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  echo "Tip: copy $EXAMPLE_FILE -> $ENV_FILE (and never commit it)." >&2
  exit 2
fi

if [[ ! -f "$EXAMPLE_FILE" ]]; then
  echo "Missing example file: $EXAMPLE_FILE" >&2
  exit 2
fi

extract_keys() {
  local file="$1"
  grep -vE '^(#|$)' "$file" \
    | sed -E 's/[[:space:]]+#.*$//' \
    | sed -E 's/^[[:space:]]*export[[:space:]]+//' \
    | sed -E 's/=.*$//' \
    | sed -E 's/[[:space:]]+$//' \
    | sort -u
}

TMP_ENV="$(mktemp)"
TMP_EXAMPLE="$(mktemp)"

extract_keys "$ENV_FILE" > "$TMP_ENV"
extract_keys "$EXAMPLE_FILE" > "$TMP_EXAMPLE"

echo "== Key counts =="
echo "  $ENV_FILE: $(wc -l < "$TMP_ENV")"
echo "  $EXAMPLE_FILE: $(wc -l < "$TMP_EXAMPLE")"
echo

echo "== In $ENV_FILE but missing from $EXAMPLE_FILE =="
comm -23 "$TMP_ENV" "$TMP_EXAMPLE" || true
echo

echo "== In $EXAMPLE_FILE but missing from $ENV_FILE =="
comm -13 "$TMP_ENV" "$TMP_EXAMPLE" || true

rm -f "$TMP_ENV" "$TMP_EXAMPLE"


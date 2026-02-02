#!/usr/bin/env bash
set -euo pipefail

EXAMPLE_FILE="${1:-.env.example}"

if [[ ! -f "$EXAMPLE_FILE" ]]; then
  echo "Missing example file: $EXAMPLE_FILE" >&2
  exit 2
fi

if ! command -v rg >/dev/null 2>&1; then
  echo "Missing dependency: rg (ripgrep)" >&2
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

compose_vars="$(mktemp)"
example_vars="$(mktemp)"

# Extract ${VAR...} occurrences from compose files, but ignore "$${VAR}" which is used to escape
# docker-compose interpolation and should not be treated as a host env var.
rg -P --no-filename -o '(?<!\$)\$\{[A-Z0-9_]+([:-][^}]*)?\}' docker-compose*.y* docker-compose.yaml \
  | sed -E 's/^\$\{([A-Z0-9_]+).*/\1/' \
  | sort -u > "$compose_vars"

extract_keys "$EXAMPLE_FILE" > "$example_vars"

missing="$(comm -23 "$compose_vars" "$example_vars" || true)"
if [[ -n "$missing" ]]; then
  echo "Missing keys in $EXAMPLE_FILE (referenced by docker-compose files):" >&2
  echo "$missing" >&2
  rm -f "$compose_vars" "$example_vars"
  exit 1
fi

rm -f "$compose_vars" "$example_vars"
echo "OK: $EXAMPLE_FILE covers all docker-compose variables."

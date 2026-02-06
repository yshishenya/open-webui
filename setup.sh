#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Project local setup helper (meta-root aware).

This script is intentionally safe and idempotent. It does NOT install system deps.

Usage:
  ./setup.sh [--no-env-sync] [--setup-sdd] [--no-git-hooks]

Options:
  --no-env-sync   Do not create/update .env from .env.example (default: sync .env)
  --setup-sdd     Configure local SDD/Claude settings under .claude/ (ignored by git)
  --no-git-hooks  Skip configuring git hooks + commit message template
  -h, --help      Show this help

Next steps (after running):
  - Read: <META_ROOT>/README.md
  - Local dev: ./scripts/dev_stack.sh
  - Tests: npm run docker:test:backend | npm run docker:test:frontend
  - SDD: <META_ROOT>/tools/sdd list-specs --json
EOF
}

need_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    return 1
  fi
}

repo_root() {
  git rev-parse --show-toplevel 2>/dev/null
}

sync_env=1
setup_sdd=0
setup_git_hooks=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-env-sync) sync_env=0 ;;
    --setup-sdd) setup_sdd=1 ;;
    --no-git-hooks) setup_git_hooks=0 ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      echo >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

need_cmd git

root="$(repo_root || true)"
if [[ -z "${root:-}" ]]; then
  echo "Error: not a git repository. Run from the repo root." >&2
  exit 1
fi

cd "$root"

meta_root=""
shopt -s nullglob dotglob
for candidate in */ ; do
  if [[ -f "${candidate}memory_bank/README.md" ]]; then
    meta_root="${candidate%/}"
    break
  fi
done
shopt -u nullglob dotglob

if [[ -z "${meta_root:-}" ]]; then
  echo "Error: could not find <META_ROOT>/memory_bank/README.md under repo root." >&2
  exit 1
fi

echo "Repo root: $root"
echo "Meta root: $meta_root/"

if [[ -d ".memory_bank" ]]; then
  echo "WARN: legacy '.memory_bank/' directory exists. Use '$meta_root/memory_bank/' instead." >&2
fi

if [[ -d "specs" ]]; then
  if find specs -type f -print -quit 2>/dev/null | grep -q .; then
    echo "WARN: legacy SDD root 'specs/' exists and contains files. Use '$meta_root/tools/sdd ...' and move SDD specs under '$meta_root/sdd/specs/'." >&2
  else
    echo "NOTE: legacy SDD root 'specs/' directory exists (empty). Consider removing it to avoid accidental SDD auto-detection." >&2
  fi
fi

if [[ "$setup_git_hooks" == "1" ]]; then
  if [[ -x "$meta_root/tools/setup_git_hooks.sh" ]]; then
    echo
    echo "Configuring git hooks + commit template..."
    "$meta_root/tools/setup_git_hooks.sh"
  else
    echo "WARN: missing executable $meta_root/tools/setup_git_hooks.sh (skipping git hooks setup)" >&2
  fi
fi

if [[ "$sync_env" == "1" ]]; then
  echo
  echo "Syncing .env with .env.example (safe: preserves existing values; creates a backup if needed)..."
  if need_cmd python3; then
    python3 scripts/sync_env.py --env .env
  else
    echo "WARN: python3 not found; skipping .env sync" >&2
  fi
fi

if [[ "$setup_sdd" == "1" ]]; then
  echo
  echo "Configuring local SDD settings under .claude/ (ignored by git)..."
  if command -v sdd >/dev/null 2>&1; then
    sdd skills-dev verify-install --json >/dev/null
    sdd skills-dev setup-permissions update . --non-interactive --enable-git --no-git-write >/dev/null
    sdd skills-dev start-helper setup-git-config . --non-interactive --enabled --no-auto-branch --no-auto-commit --no-auto-push --show-files --no-ai-pr >/dev/null
    sdd skills-dev start-helper ensure-sdd-config . >/dev/null
    echo "SDD: configured (verify with: $meta_root/tools/sdd find-specs --json)"
  else
    echo "WARN: sdd not found; skipping SDD setup. Install SDD toolkit, then rerun with --setup-sdd." >&2
  fi
fi

echo
echo "Done."
echo "Start here: $meta_root/README.md"

# SDD in This Repo

SDD specs live under:

- `meta/sdd/specs/{pending,active,completed}/`
- Optional long-term archive: `meta/sdd/specs/archived/` (via `move-spec`)

## Always Use The Wrapper

SDD auto-detects a root `specs/` directory. In this repo, specs are under `meta/`, so you must use
the wrapper script:

```bash
meta/tools/sdd <command> [args...]
```

Note: a repo `pre-commit` hook rejects commits that re-introduce legacy roots (`specs/`, `.memory_bank/`).
In particular, it blocks SDD-style `specs/{pending,active,completed}/` so SDD specs stay under `meta/`.

Examples:

```bash
meta/tools/sdd find-specs --json
meta/tools/sdd list-specs --json
meta/tools/sdd task-info <spec_id> <task_id> --json
```

## Lifecycle (Create -> Update -> Close)

### 1) Create

```bash
meta/tools/sdd create "<spec-name>" --json
meta/tools/sdd list-specs --status pending --json
```

### 2) Start work

If the spec is still in `pending`, activate it:

```bash
meta/tools/sdd activate-spec <spec_id> --json
```

### 3) Update during implementation

```bash
meta/tools/sdd task-info <spec_id> <task_id> --json
meta/tools/sdd update-status <spec_id> <task_id> in_progress --json
meta/tools/sdd complete-task <spec_id> <task_id> --note "Implemented and verified" --json
meta/tools/sdd progress <spec_id> --json
```

### 4) Close

Before marking the linked work item spec as done, close the SDD spec:

```bash
meta/tools/sdd check-complete <spec_id> --json
meta/tools/sdd complete-spec <spec_id> --json
```

Optional archival after completion:

```bash
meta/tools/sdd move-spec <spec_id> archived --json
```

## Cross-linking (Required for Non-trivial Work)

For non-trivial work, keep MD and JSON specs connected:

- Work item spec (MD): add `SDD Spec: meta/sdd/specs/...json`
- SDD spec (JSON): set `metadata.work_item_spec` to the work item spec path

## Validation Notes

- `meta/tools/sdd` exports `CLAUDE_SDD_SCHEMA_CACHE=meta/sdd/schema` to make schema discovery stable across environments.
- CI uses `.github/workflows/sdd-validate.yml`, which validates SDD specs directly via JSON Schema + repository policy checks (self-contained, no preinstalled `sdd` required on runner).
- `jsonschema` must be installed in the `sdd` runtime to avoid schema-skip warnings.
  - Codex local toolkit path: `$HOME/.codex/tools/sdd-toolkit/bin/python -m pip install jsonschema`
  - Generic fallback: `python -m pip install jsonschema`
- For strict CI, parse JSON output and gate on both `errors == 0` and `warnings == 0`.

Example gate:

```bash
meta/tools/sdd validate meta/sdd/specs/<status>/<spec>.json --json | jq -e '(.errors == 0) and (.warnings == 0)'
```

Validate all specs in CI (without relying on `validate` exit code):

```bash
for spec in meta/sdd/specs/*/*.json; do
  out="$(meta/tools/sdd validate "$spec" --json || true)"
  echo "$out" | jq -e '((.errors // .summary.errors // 0) == 0) and ((.warnings // .summary.warnings // 0) == 0)' >/dev/null
done
```

# Solutions Log

This folder is a **knowledge persistence** area: when a problem is solved, capture the context and fix so it can be reused later.

## Structure

- `documentation/` — docs/process/tooling fixes
- `patterns/` — promoted patterns (after the same issue repeats 3+ times)
- `templates/` — solution templates
- `schema.yaml` — enums for frontmatter fields

## How to add a solution

1. Start from `templates/solution-template.md`
2. Use frontmatter fields (see `schema.yaml`)
3. Put the file under a matching category folder (e.g. `documentation/`)

## Validation / sanity checks

- Internal links: `python3 meta/tools/check_markdown_links.py`

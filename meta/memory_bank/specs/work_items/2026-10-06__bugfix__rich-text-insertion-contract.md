# Rich text insertion contract

- Type: bugfix; workflow: bug_fix.
- Status: Done; owner: Codex; started: 2026-10-06.
- Branch: `codex/bugfix/rich-text-insertion-contract`; base: `013466ff0ddf5d619de90e75a05d309f264072ac` (`airis_b2c`).
- SDD Spec: `meta/sdd/specs/completed/airis-rich-text-insertion-contract-2026-10-06-001.json`.

## Problem and scope

The shared RichTextInput supplies chat, channel and note inputs. Plain paste passes a Fragment to the single-Node replaceSelectionWith API. Plain command replacement constructs empty text on leading newlines and computes the single-line cursor with an extra position. Deferred template selection reads a mutable nullable editor. Native transaction reproduction confirms command text/cursor defects and obsolete editor access. Plain paste passes runtime cases but violates the documented single-Node API contract. Hard-break command lookup also merges adjacent lines because textContent omits leaf breaks.

Compiled Chromium exposed a second cursor defect when a prompt button takes focus: parent HTMLElement.focus() restores the stale DOM selection after the transaction. Restore model selection with the existing native EditorView.focus() in shared command replacement before parent focus. The first compiled candidate is rejected and was not deployed. Firefox synthetic paste data is now supplied explicitly by the test.

An independently reproduced plain-copy defect also sends the full editor HTML to the clipboard and drops inline breaks from selected plaintext: getHTML accepts no slice argument. Serialize only the native selected slice with existing DOMSerializer and preserve leaf breaks; empty selection returns to native handling. This repair is included before deployment.

## Acceptance

- [x] Native ProseMirror reproduction fails before repair and passes afterward.
- [x] Pasting replaces exactly the selection, preserving prefix/suffix, Unicode and all leading/trailing/consecutive newlines; no HTML insertion in plain mode.
- [x] Command replacement preserves plain text and places the cursor immediately after inserted content; empty replacement deletes the command safely.
- [x] Android/WebView insertion and variable replacement preserve adjacent content and existing rich Markdown behavior.
- [x] Deferred template selection has zero effects after editor destroy/replacement; valid current-editor selection still works.
- [x] Full Docker frontend suite passes; changed-file lint clean; zero new mapped type/lint diagnostics.
- [x] Plain copy contains only selected plaintext/HTML, preserves hard breaks and leaves empty/rich selections to native handling.
- [x] Native focus restoration follows the command transaction; compiled click-and-next-character regression added.
- [x] Compiled Chromium and Firefox scenarios pass without page errors; exact-SHA CI and merge accepted.
- [x] Guarded deployment preserves current base, backend, environment, compiled Metrica, neighbors and data; verified backup, Alembic, digest, public and authenticated smoke accepted.

## Approach and dependency contract

Reuse existing textToNodes and native Slice/Fragment/Selection APIs. Keep existing installed ProseMirror versions for TipTap compatibility; no dependency added/replaced. Read official https://prosemirror.net/docs/ref/ plus installed declarations/implementation. A version upgrade is a separate compatibility-tested work item. No new abstraction or sibling caller patches.

## Upstream impact

Only `src/lib/components/common/RichTextInput.svelte` needs runtime edits: the native editor transaction and lifecycle have no external hook. Reuse its existing helper and remove duplicate line loops. Keep unrelated copy/image/collaboration paths unchanged until independently reproduced.

## Verification and evidence

Native baseline:14 failures/16 successes, plus one independently reproduced hard-break lookup failure. Final32 insertion/copy cases and678/678 full Docker frontend cases; types3428→3396/150 warnings, ESLint1288 unchanged, zero new mapped diagnostics, changed component/test lint clean. One initial test VM declaration collision and a returning test hook were corrected; rejected receipts retained. Compiled Chromium/Firefox:2/2 insertion/copy and16/16 onboarding paths,0pageerrors. All applicable exact-source CI passed; dependency-review intentionally skipped; CodeRabbit review disabled. PR299 merge d96c6536305230891ec3b4acbe50a7fd7b56a92b has the tested source tree. Guarded production accepted on 2026-10-06: immutable digest sha256:5ead6217b36355c10977cce6d79f23819d80c65834ddf362bc26ec335a28e146;4914frontend/426Python equal,69base layers/ENV/compiled Metrica/13neighbors preserved;verified backup,hard Alembic,healthy/restarts0 and23.53GiB free. Default Compose pins the new image without a second recreate. Public version and ordinary read-only browser retain history/answer/empty input/free Luna/zero balance/file manager,0console errors/0new generation. Private evidence remains outside the public repository. Overall onboarding acceptance and real pilot/payment/human criteria are not closed by this component fix.

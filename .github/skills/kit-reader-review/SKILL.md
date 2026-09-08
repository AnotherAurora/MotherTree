---
name: kit-reader-review
description: >-
  Apply surgical review edits to MotherTree pending ATM rows and their proposal JSON
  in a dedicated chat. Use when the user pastes a Kit Reader review prompt, asks for
  review edits on an awakener's pending ATMs, or mentions "Kit Reader review edit".
---

# MotherTree Kit Reader Review

Use this skill for **surgical adjustments** to existing pending ATMs after the initial kit read.

## Locked rules

- **Read only the target awakener's kit pack** (`{slug}.kit.json`) **when the requested edit needs source text or values** to resolve fields (e.g. a new row's `valueScalar` / `dependencyStat`). Do **not** read other awakener `.kit.json` / `.proposal.json` files in `sample-data/kit-reader/` as reference examples. Work from the user's prompt, the target kit pack (as needed), targeted database rows, and the specified `{slug}.proposal.json`.
- **Do NOT run full `insert-kit-pending.ts`** unless the user explicitly requests a full re-insert.
- **Touch ONLY the records specified** in the prompt or review instructions. Never modify, wipe, or regenerate unmentioned records.
- Preserve all existing fields on touched records unless explicitly asked to change them.
- **Synchronize proposal JSON:** Whenever database rows are updated, deleted, or added, update `sample-data/kit-reader/{slug}.proposal.json` to keep proposal definitions in sync with database state.
- **Write safety:** For single-row adjustments, use direct database tool calls via the connected Supabase MCP (e.g. `execute_sql`) or the app's UI endpoints, rather than generating one-off ad-hoc scripts (`scripts/patch-*.ts`).
- **Soft-delete awareness (`deleted_at`):**
  - Always include `deleted_at IS NULL` in all `SELECT` and `UPDATE` queries to avoid inspecting or modifying soft-deleted records.
  - To delete/remove an ATM row, set `deleted_at = NOW()`. Never run hard `DELETE` statements.
- **Compact reporting:** Report **ONLY**:
  1. Changed / deleted / added row IDs
  2. Skipped IDs
  3. Any unresolved blockers or questions
     Do **not** output full manifestation markdown tables or recaps of untouched rows.

## Required reading

All paths below are repo-root-relative — read each from the workspace root.

1. The target awakener's kit pack path from the prompt (usually `sample-data/kit-reader/{slug}.kit.json`) — consult only when the requested edit needs source text/values
2. `src/lib/kit-reader/proposal-schema.ts` — proposal types and schema definitions
3. `docs/admin/kit-reader.md` — operator review workflow

## Typical workflow

1. Identify the targeted rows from the user's prompt (by ATM `#id` or exact tag/metadata criteria).
2. Inspect the current row state in the database using targeted SQL queries (`WHERE id IN (...)` or `WHERE awakener_id = ... AND ...`).
3. Apply requested updates via the connected Supabase MCP (targeted `SELECT` / `UPDATE` / soft-delete SQL through `execute_sql`), honoring `deleted_at IS NULL` filters.
4. Update `sample-data/kit-reader/{slug}.proposal.json` to reflect the changes (update matching `clientKey`, add new items, or remove deleted ones).
5. Output a concise summary of changed IDs and status.

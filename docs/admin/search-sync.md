# Refreshing Search simulation data

Public Search values for **simulated tags** (tags with `tag.is_search_simulated = true`) are precomputed into `public.search_solo_totals`. The Cloudflare Worker only reads that table — it never runs the Path Carver engine at request time.

This exists because a full simulated search is roughly 19 s of CPU (65 solo sims), while the Workers Free plan allows 10 ms per request. Running it in the Worker returned Cloudflare error 1102.

## When to run

Run the sync after any content edit that can change a simulated value:

- `tag` rows (especially `is_percent`, `is_additive`, `layer`, and `is_search_simulated`)
- `awakener` rows (stats, realm)
- `awakener_tag_manifestation`, `awakener_local_manifestation_interaction`
- `realm_tag_manifestation`
- `tag_default_interaction`
- `copy_provider_group_member`

If you flip `is_search_simulated` from **false to true**, run the sync before users search for that tag. Until then Search shows a "pending data sync" notice and no simulated rows for it. Flipping **true to false** needs no sync for correctness (direct rows return immediately), but the next sync deletes the stale rows.

## Command

```bash
npm run sync:search-totals -- --dry-run   # preview counts, no writes
npm run sync:search-totals               # write
```

Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

A full run currently takes ~90–100 s and is idempotent: unchanged rows are skipped (diff-only upsert), and rows for tags/awakener/realm combinations that no longer exist are deleted.

## What it writes

- `public.search_solo_totals` — one row per `(awakener, realm, enlightenment, tag)` that the engine actually produces, plus precomputed display fields (target type and metadata) and `has_realm_gimmick`.
- `public.search_solo_totals_meta` — single-row sync marker with `synced_at` and the tag ids included. Search uses it to detect "flagged after the last sync" instead of guessing from missing rows (a tag can legitimately produce nothing at low enlightenment).

Only anon `SELECT` is granted on both tables; the sync writes with the service role.

## Verification

```bash
npx tsx scripts/smoke-public-solo-search-totals.ts
npx tsx --env-file=.env.local scripts/smoke-public-read.ts
```

The solo search smoke rebuilds the precomputed rows from fixtures and asserts the Search join path. For a live parity check, re-run the sync with `--dry-run` and confirm `upsert=0 delete=0`.

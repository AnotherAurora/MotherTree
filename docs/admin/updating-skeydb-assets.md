# Updating SKeyDB assets

How to refresh Name-column icons (wheel / posse / covenant) and the pinned SKeyDB art commit used by Search and Path Carver.

Awakener portraits resolve by name slug against the same pin; they do **not** use the name→asset JSON maps.

## When to run this

- You added or renamed a **wheel**, **posse**, or **covenant** in Mother Tree and its Search icon is missing
- SKeyDB published new art and Mother Tree is still on an older `SKEYDB_COMMIT`

Search **rows** come from the live DB. This workflow only updates **icons** (and the pin / maps that power them).

## Prerequisites

- `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`)
- The entity’s art already exists on [dansa/SKeyDB](https://github.com/dansa/SKeyDB) (or you will pin a commit that has it)
- Mother Tree display `name` matches the SKeyDB catalog name (case-insensitive)

## Happy path

1. Insert/update the record in the Mother Tree database
2. Run:

```bash
npm run sync:skeydb-assets
```

3. Commit and deploy:
   - `src/lib/assets/skeydb-base.ts` (`SKEYDB_COMMIT`)
   - `src/lib/assets/maps/wheel-by-name.json`, `covenant-by-name.json`, `posse-by-name.json`
   - `sample-data/skeydb-asset-names/*`

## What `sync:skeydb-assets` does

1. **Slim dump** — `npm run db:dump-skeydb-assets` writes alive `name` values for wheel / covenant / posse to `sample-data/skeydb-asset-names/`
2. **Bump pin** — sets `SKEYDB_COMMIT` to the latest `main` tip of SKeyDB (unless you pass a SHA)
3. **Regenerate maps** — `npm run generate:skeydb-assets` joins those names to SKeyDB catalogs at the pin

Pin a specific commit:

```bash
npx tsx --env-file=.env.local scripts/sync-skeydb-assets.ts <fullSha>
```

## Partial commands

| Command | Use when |
| --- | --- |
| `npm run db:dump-skeydb-assets` | Refresh names only |
| `npm run generate:skeydb-assets` | Rebuild maps for the **current** pin (names dump must already exist) |
| `npm run db:dump` | Full sample-data export — **not** required for icons |

## Unmatched names

If generate hard-fails listing unmatched Mother Tree names:

- Name spelling differs from SKeyDB’s catalog, or
- The pinned SKeyDB commit is older than the art for that entity

Fix the name or pin a newer SHA, then re-run sync.

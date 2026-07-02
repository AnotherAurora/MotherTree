# Sample data dumps

Local JSON exports of the Supabase database for development and AI-assisted debugging. **Dump files are gitignored** and must be generated on each machine.

## Generate a dump

1. Ensure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (see [`.env.example`](../.env.example)).
2. Run:

```bash
npm run db:dump
```

Output is written to `sample-data/dumps/YYYY-MM-DD/` using the local date when the export runs.

## Dump layout

Each dated folder contains:

| File | Contents |
|------|----------|
| `_manifest.json` | Dump metadata (`dumpedAt`, `dumpDate`, row counts per table) |
| `tag.json` | All rows from `tag` |
| `awakener.json` | All rows from `awakener` |
| `desire.json` | All rows from `desire` |
| `awakener_tag_manifestation.json` | All rows from `awakener_tag_manifestation` |
| `tag_default_interaction.json` | All rows from `tag_default_interaction` |
| `manifestation_interaction_override.json` | All rows from `manifestation_interaction_override` |
| `desire_demand.json` | All rows from `desire_demand` |
| `path.json` | All rows from `path` |
| `desire_anchored_awakener.json` | All rows from `desire_anchored_awakener` |

Exports include soft-deleted rows (`deleted_at` is not null).

## Git

The `sample-data/dumps/` directory is listed in [`.gitignore`](../.gitignore) so SKeyDB-derived data is not committed to the repository. Only this README and the export script are tracked.

## Data attribution

Game data is sourced from [SKeyDB](https://github.com/dansa/SKeyDB). See [DATA-NOTICE.md](../DATA-NOTICE.md) for licensing terms (CC BY-NC-SA 4.0).

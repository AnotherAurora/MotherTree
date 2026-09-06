# Gear Audit working files

Local-only full-table exports and audit findings. Generated on each machine; not required in git.

| File | Writer |
| --- | --- |
| `{kind}/full.skeydb.json` | `npm run gear:export` |
| `{kind}/full.mothertree.json` | `npm run gear:export` |
| `{kind}/full.findings.json` | `npm run gear:audit` |

Kinds: `posse/`, `wheel/`, `covenant/`.

See [docs/admin/gear-audit.md](../../docs/admin/gear-audit.md).

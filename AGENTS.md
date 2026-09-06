<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Verification Requirements

- Run `npm run typecheck` (`tsc --noEmit`) ONLY when the user explicitly requests it. Never run it automatically or as a side effect of other work (including schema or migration changes).
- If typecheck is run and reports errors, fix them promptly.
- If database schema or migrations were touched, keep `src/lib/database.types.generated.ts` in sync — but do not auto-run typecheck to confirm; only run it if the user asks.

# Script & Database Modification Rules

- **No Ad-Hoc Scripts**: Never create or generate ad-hoc/one-time database migration or patch scripts in `scripts/` (e.g. `scripts/apply-*.ts`, `scripts/patch-*.ts`).
- For Kit Reader proposals/updates, always use proposal JSON with `scripts/insert-kit-pending.ts` (`--patch` or `--append`) or the local UI (`/kit-reader`).
- For general script maintenance, use existing parameterized CLI tools or application APIs.

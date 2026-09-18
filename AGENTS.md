<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Verification Requirements

- Run `npm run typecheck` (`tsc --noEmit`) ONLY when the user explicitly requests it. Never run it automatically or as a side effect of other work (including schema or migration changes).
- If typecheck is run and reports errors, fix them promptly.
- If database schema or migrations were touched, keep `src/lib/database.types.generated.ts` in sync — but do not auto-run typecheck to confirm; only run it if the user asks.
- Run `npm run lint` ONLY when the user explicitly requests it. Never run it automatically or as a side effect of other work.
- When lint is requested, scope it to the files you changed (`npm run lint:changed -- <files>` or `npx eslint --quiet <files>`) instead of the whole repo. `npm run lint` already uses `--quiet`, so only errors are reported.
- Pre-existing lint diagnostics are out of scope: do not fix or refactor unrelated code to clear them. Only address diagnostics your own change introduced.

# Script & Database Modification Rules

- **No Ad-Hoc Scripts**: Never create or generate ad-hoc/one-time database migration or patch scripts in `scripts/` (e.g. `scripts/apply-*.ts`, `scripts/patch-*.ts`).
- For Kit Reader proposals/updates, always use proposal JSON with `scripts/insert-kit-pending.ts` (`--patch` or `--append`) or the local UI (`/kit-reader`).
- For general script maintenance, use existing parameterized CLI tools or application APIs.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Verification Requirements

Before completing any task or concluding a turn where TypeScript code, database types, or scripts were modified:
1. Always run `npm run typecheck` (`tsc --noEmit`).
2. Fix any type errors immediately.
3. If database schema or migrations were touched, ensure `src/lib/database.types.generated.ts` is in sync.


import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ID = "brsxrctacuhllumnfwgx";
const outPath = resolve(process.cwd(), "src/lib/database.types.generated.ts");

const output = execSync(
  `npx supabase gen types typescript --project-id ${PROJECT_ID}`,
  { encoding: "utf-8", stdio: ["ignore", "pipe", "inherit"] },
);

writeFileSync(outPath, output);
console.log(`Wrote ${outPath}`);

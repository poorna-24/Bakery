// Puts your Supabase connection strings into all four env files at once.
//
//   node scripts/set-database-url.mjs
//
// You paste the two strings when prompted. They go straight into the files —
// they are never printed back, never logged, and never leave this machine.
//
// Why four files: each app needs its own copy, and the Prisma CLI reads .env
// while Next reads .env.local. Editing them by hand is four chances to make a
// typo, and a mismatch between the two apps is invisible until the menu comes
// up empty.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Which keys belong in which file. */
const TARGETS = [
  { file: "admin/.env.local", keys: ["DATABASE_URL", "DIRECT_URL"] },
  { file: "admin/.env", keys: ["DATABASE_URL", "DIRECT_URL"] },
  // The customer app only reads; it never changes the schema, so no DIRECT_URL.
  { file: "customer/.env.local", keys: ["DATABASE_URL"] },
  { file: "customer/.env", keys: ["DATABASE_URL"] },
];

function complain(url, label, expectedPort) {
  const problems = [];

  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    problems.push("does not start with postgresql://");
  }
  if (url.includes("[YOUR-PASSWORD]") || url.includes("[YOUR_PASSWORD]")) {
    problems.push("still contains the [YOUR-PASSWORD] placeholder — put your real password in");
  }
  if (/:\/\/[^:]+:@/.test(url)) {
    problems.push("has an empty password");
  }
  if (expectedPort && !url.includes(`:${expectedPort}/`)) {
    problems.push(`does not use port ${expectedPort} — check you copied the right one`);
  }

  return problems.length ? `${label}: ${problems.join("; ")}` : null;
}

/** Sets or replaces `KEY="value"` in an env file, leaving everything else be. */
function upsert(contents, key, value) {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^${key}=.*$`, "m");

  if (pattern.test(contents)) return contents.replace(pattern, line);
  return contents.trimEnd() + `\n${line}\n`;
}

function mask(url) {
  // postgresql://user:secret@host:5432/db  ->  postgresql://user:****@host:5432/db
  return url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");
}

const rl = readline.createInterface({ input: stdin, output: stdout });

console.log("\nSupabase connection strings");
console.log("Get them from your project: Connect -> ORMs tab -> Prisma\n");

const pooled = (await rl.question("DATABASE_URL  (transaction pooler, port 6543):\n> ")).trim();
const direct = (await rl.question("\nDIRECT_URL    (direct connection, port 5432):\n> ")).trim();
rl.close();

const problems = [
  complain(pooled, "DATABASE_URL", "6543"),
  complain(direct, "DIRECT_URL", "5432"),
].filter(Boolean);

if (problems.length) {
  console.error("\nNot saved — these look wrong:\n");
  for (const problem of problems) console.error("  - " + problem);
  console.error("\nNothing was changed. Fix them and run this again.\n");
  process.exit(1);
}

if (!pooled.includes("pgbouncer=true")) {
  console.warn(
    "\nNote: DATABASE_URL has no ?pgbouncer=true. Prisma needs it with a pooler.\n" +
      "      Adding it for you.",
  );
}

const finalPooled = pooled.includes("pgbouncer=true")
  ? pooled
  : pooled + (pooled.includes("?") ? "&" : "?") + "pgbouncer=true";

console.log("");
for (const target of TARGETS) {
  const file = path.join(ROOT, target.file);
  let contents = "";
  try {
    contents = await readFile(file, "utf8");
  } catch {
    // A missing .env is normal on a fresh clone; create it.
  }

  for (const key of target.keys) {
    contents = upsert(contents, key, key === "DIRECT_URL" ? direct : finalPooled);
  }

  await writeFile(file, contents, "utf8");
  console.log(`  updated  ${target.file}  (${target.keys.join(", ")})`);
}

console.log("\nBoth apps now point at the same database:");
console.log("  " + mask(finalPooled));
console.log("\nNothing was printed in full and nothing left this machine.");
console.log("Next: tell Claude, and the migration can run.\n");

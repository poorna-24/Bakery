// Reads the repository-root .env into process.env.
//
// There is one env file for the whole project, a level above this app. Next
// only looks inside its own folder, and the Prisma CLI only reads `.env` next
// to the schema, so both are pointed here instead — which is what lets the
// four per-app env files be a single file.
//
// Written by hand rather than pulling in dotenv: this runs during `postinstall`,
// before dependencies are guaranteed to be on disk.
//
// A missing file is not an error. In Docker and on Vercel there is no .env at
// all — the platform supplies the variables — and this must quietly do nothing.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(here, "..", "..", ".env");

export function loadRootEnv() {
  if (!existsSync(envPath)) return false;

  for (const raw of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Strip one matching pair of quotes, so a value containing spaces or a #
    // survives intact.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // A variable already set wins. That is how Docker Compose and Vercel
    // override the database URL without this file having to know about them.
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return true;
}

// Also usable as a command wrapper, for the Prisma scripts:
//   node scripts/load-root-env.mjs prisma generate
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  loadRootEnv();

  const [command, ...args] = process.argv.slice(2);
  if (command) {
    const { spawnSync } = await import("node:child_process");
    const result = spawnSync(command, args, { stdio: "inherit", shell: true });
    process.exit(result.status ?? 1);
  }
}

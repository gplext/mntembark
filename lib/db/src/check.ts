/**
 * Connection diagnostic.
 *
 *   pnpm --filter @workspace/db run check
 *
 * drizzle-kit hides the underlying driver error behind a spinner, so when
 * `push` fails you get no useful detail. This connects with the same
 * DATABASE_URL and reports precisely what went wrong.
 *
 * Never prints the password.
 */

import pg from "pg";

const raw = process.env["DATABASE_URL"];

if (!raw) {
  console.error("DATABASE_URL is not set in this shell.\n");
  console.error("PowerShell:  $env:DATABASE_URL=\"postgres://...\"");
  console.error("CMD:         set DATABASE_URL=postgres://...");
  process.exit(1);
}

let url: URL;
try {
  url = new URL(raw);
} catch {
  console.error("DATABASE_URL is not a valid URL.");
  console.error(
    "Expected: postgres://user:password@host:5432/database\n" +
      "If the password contains @ # % / ? or :, it must be percent-encoded\n" +
      "(@ becomes %40, # becomes %23, % becomes %25).",
  );
  process.exit(1);
}

const database = url.pathname.replace(/^\//, "");

console.log("Parsed connection details");
console.log("  host:     ", url.hostname);
console.log("  port:     ", url.port || "5432 (default)");
console.log("  user:     ", decodeURIComponent(url.username));
console.log("  database: ", database || "(none — this is wrong)");
console.log("  password: ", url.password ? `set (${url.password.length} chars)` : "MISSING");
console.log();

if (/[@#%?]/.test(decodeURIComponent(url.password))) {
  console.log(
    "Note: the decoded password contains a special character. If the\n" +
      "connection fails, that is the likely cause — percent-encode it.\n",
  );
}

const client = new pg.Client({
  connectionString: raw,
  connectionTimeoutMillis: 10_000,
});

try {
  process.stdout.write("Connecting... ");
  await client.connect();
  console.log("OK\n");

  const { rows: v } = await client.query("SELECT version()");
  console.log(String(v[0].version).split(",")[0]);

  const { rows: tables } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`,
  );

  if (tables.length === 0) {
    console.log("\nNo tables yet. Run:  pnpm --filter @workspace/db run push");
  } else {
    console.log("\nTables:");
    for (const t of tables) {
      const { rows: c } = await client.query(
        `SELECT count(*)::int n FROM "${t.table_name}"`,
      );
      console.log(`  ${t.table_name.padEnd(14)} ${c[0].n} rows`);
    }
    const hasContent = tables.some((t) => t.table_name === "tours");
    if (hasContent) {
      console.log("\nIf the row counts are 0, run: pnpm --filter @workspace/db run seed");
    }
  }
  console.log("\nConnection is healthy.");
} catch (err) {
  const e = err as NodeJS.ErrnoException & { code?: string };
  console.log("FAILED\n");

  switch (e.code) {
    case "28P01":
      console.error("Wrong password.");
      console.error(
        "The password in DATABASE_URL does not match this database.\n" +
          "Copy the connection string again from Coolify — use the copy button\n" +
          "rather than retyping, and make sure you are looking at the current\n" +
          "database resource, not an old one.",
      );
      break;
    case "3D000":
      console.error(`Database "${database}" does not exist on this server.`);
      console.error(
        "Check the name at the end of the URL. Coolify usually uses /postgres.",
      );
      break;
    case "28000":
      console.error(`User "${decodeURIComponent(url.username)}" was rejected.`);
      console.error("Check the username in the URL.");
      break;
    case "ETIMEDOUT":
    case "ECONNREFUSED":
      console.error("Could not reach the server.");
      console.error(
        "The public port is probably closed, or a firewall is blocking it.\n" +
          "Enable the public port on the database in Coolify and confirm the\n" +
          "port number matches the URL.",
      );
      break;
    case "ENOTFOUND":
    case "EAI_AGAIN":
      console.error(`Host "${url.hostname}" could not be resolved.`);
      console.error(
        "If this looks like a container name, you are using the INTERNAL URL.\n" +
          "From your own machine you need the PUBLIC one (an IP address).",
      );
      break;
    default:
      console.error("Error:", e.message);
      if (e.code) console.error("Postgres/driver code:", e.code);
  }
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}

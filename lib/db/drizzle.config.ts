import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  // Must stay a forward-slash relative path. drizzle-kit treats this as a glob,
  // and an absolute Windows path (backslashes, from path.join/__dirname) is not
  // valid glob syntax — it silently matches nothing.
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});

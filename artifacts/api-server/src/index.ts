import app from "./app";
import { logger } from "./lib/logger";
import { backfillTourEmbeddings } from "./routes/tours";
import { ensureTablesExist, seedDatabaseIfEmpty } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Ensure DB schema tables exist and seed sample data if empty
  ensureTablesExist()
    .then(async () => {
      logger.info("Database tables initialized/verified.");
      await seedDatabaseIfEmpty();
      logger.info("Database seeding checked/populated.");
      // Kick off embedding backfill in the background so tours already in the DB
      // get their embeddings the first time the server runs with an OPENAI_API_KEY.
      backfillTourEmbeddings().catch((err) =>
        logger.warn({ err }, "Tour embedding backfill encountered an error"),
      );
    })
    .catch((err) => {
      logger.error({ err }, "Failed to initialize or seed database");
    });
});



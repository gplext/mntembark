import app from "./app";
import { logger } from "./lib/logger";
import { backfillTourEmbeddings } from "./routes/tours";
import { seedInitialContent } from "./lib/seedInitialContent";

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

async function startServer(): Promise<void> {
  await seedInitialContent();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    // Kick off embedding backfill in the background so tours already in the DB
    // get their embeddings the first time the server runs with an OPENAI_API_KEY.
    backfillTourEmbeddings().catch((err) =>
      logger.warn({ err }, "Tour embedding backfill encountered an error"),
    );
  });
}

startServer().catch((err) => {
  logger.error({ err }, "Unable to initialize the API server");
  process.exit(1);
});

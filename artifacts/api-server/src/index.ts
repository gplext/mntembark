import app from './app';
import { logger } from './lib/logger';
import { backfillTourEmbeddings } from './routes/tours';
import { objectStorageService } from './routes/storage';

const port = Number(process.env['PORT'] || 8080);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env['PORT']}"`);
}

async function main(): Promise<void> {
  // Make sure the upload volume exists before we start accepting requests.
  await objectStorageService.init();

  app.listen(port, '0.0.0.0', (err?: Error) => {
    if (err) {
      logger.error({ err }, 'Error listening on port');
      process.exit(1);
    }

    logger.info({ port }, 'Server listening');

    // Kick off embedding backfill in the background so tours already in the DB
    // get their embeddings the first time the server runs.
    backfillTourEmbeddings().catch((err) =>
      logger.warn({ err }, 'Tour embedding backfill encountered an error'),
    );
  });
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});

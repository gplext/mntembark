import app from "./app";
import { logger } from "./lib/logger";
import { seedInitialContent } from "./lib/seedInitialContent";
import { verifyMailer } from "./lib/mailer";
import { startNotificationWorker } from "./lib/notifications";

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

  /*
   * Prove the SMTP credentials before anything depends on them, so a wrong
   * password is one line in the boot log rather than a mystery discovered when
   * the first real enquiry quietly fails to arrive. Neither call can prevent
   * startup: the site is worth serving even when email is down.
   */
  await verifyMailer();
  startNotificationWorker();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

startServer().catch((err) => {
  logger.error({ err }, "Unable to initialize the API server");
  process.exit(1);
});

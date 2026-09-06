import app from "./app";
import { logger } from "./lib/logger";
import { seedInitialContent } from "./lib/seedInitialContent";
import { verifyMailer } from "./lib/mailer";
import { verifySentFolder } from "./lib/sentFolder";
import { verifyWhatsApp } from "./lib/whatsapp";
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

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });

  /*
   * The provider checks run after the port is open, deliberately.
   *
   * Each one only reports - a line in the boot log, and the state the admin
   * panel's channel line reads - and nothing about serving the site depends on
   * the answer. Awaited before listen(), though, they gate it. Catching their
   * errors is not enough, because the failure that matters here is not an
   * error: a provider that hangs rather than refuses holds the server closed
   * for as long as it stays silent. A host with outbound SMTP blocked - which
   * most VPS providers do by default - drops the connection without a word,
   * nodemailer waits two minutes, and a container healthcheck kills the process
   * before it ever accepts a request. The site was fine; nobody could reach it.
   *
   * Every one of these catches internally, so none of them can reject here.
   */
  void verifyMailer();
  void verifySentFolder();
  void verifyWhatsApp();

  startNotificationWorker();
}

startServer().catch((err) => {
  logger.error({ err }, "Unable to initialize the API server");
  process.exit(1);
});

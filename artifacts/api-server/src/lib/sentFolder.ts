import { ImapFlow } from "imapflow";
import { logger } from "./logger";

/**
 * Files a copy of every outgoing message in the mailbox's Sent folder.
 *
 * SMTP only hands a message to the server for delivery — it never files a copy
 * anywhere. A Sent folder is an IMAP folder, and it has messages in it only
 * because a mail client uploaded them after sending. An application that talks
 * SMTP directly has no client doing that, which is why the mailbox looks empty
 * however many messages have gone out.
 *
 * So this does what a mail client would: connects over IMAP and appends the
 * exact bytes that were sent.
 *
 * It is deliberately optional and deliberately silent about failure. The
 * message has already reached the recipient by the time this runs; refusing to
 * mark it sent because the archival copy did not file would turn a delivered
 * email into one the worker retries — and sends a second time.
 */

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

/*
 * Credentials default to the SMTP ones, because on Migadu — and on most
 * providers — they are the same mailbox. Only the host usually differs
 * (smtp.migadu.com vs imap.migadu.com), so that is the one value worth asking
 * for.
 */
function config() {
  const host = env("IMAP_HOST");
  const user = env("IMAP_USER") ?? env("SMTP_USER");
  const pass = env("IMAP_PASS") ?? env("SMTP_PASS");
  if (!host || !user || !pass) return null;

  const port = Number(env("IMAP_PORT") ?? 993);
  return {
    host,
    port,
    // 993 is implicit TLS; 143 starts in the clear and upgrades with STARTTLS.
    secure: port === 993,
    auth: { user, pass },
    mailbox: env("IMAP_SENT_MAILBOX") ?? "Sent",
    // ImapFlow's own logging is a firehose of protocol chatter.
    logger: false as const,
  };
}

export function isSentFolderConfigured(): boolean {
  return config() !== null;
}

/**
 * Find the Sent folder by what the server says it is, not by its name.
 *
 * IMAP servers publish a \Sent special-use flag precisely because the folder is
 * called "Sent" on one server, "Sent Items" on another, and something in the
 * user's own language on a third. Falling back to the configured name covers
 * servers that publish nothing.
 */
async function sentMailbox(client: ImapFlow, configured: string): Promise<string> {
  try {
    for (const box of await client.list()) {
      if (box.specialUse === "\\Sent") return box.path;
    }
  } catch {
    // Not worth failing over: the configured name is a fine second guess.
  }
  return configured;
}

/**
 * Append one already-sent message to the Sent folder.
 *
 * Takes the raw RFC 822 bytes rather than the message fields, so the filed copy
 * is byte-identical to what the recipient received — same Message-ID, same
 * Date, same headers. A recomposed copy would look like a different email and
 * would break threading against any reply.
 *
 * Never throws.
 */
export async function fileInSentFolder(raw: Buffer): Promise<void> {
  const cfg = config();
  if (!cfg) return;

  /*
   * A fresh connection per message. At this volume — a handful of enquiries a
   * day, sent one at a time by the worker — a pooled connection would spend its
   * life idle and dropped, and reconnect logic is a bigger liability than the
   * handshake is a cost.
   */
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
    logger: cfg.logger,
  });

  try {
    await client.connect();
    const path = await sentMailbox(client, cfg.mailbox);
    // \Seen because nobody needs the Sent folder reporting unread mail they
    // wrote themselves.
    await client.append(path, raw, ["\\Seen"]);
    logger.debug({ mailbox: path }, "Filed a copy in the Sent folder");
  } catch (err) {
    logger.warn(
      { err },
      "Could not file a copy in the Sent folder — the message was still sent",
    );
  } finally {
    try {
      await client.logout();
    } catch {
      // The connection is being discarded either way.
    }
  }
}

/**
 * Proves the IMAP credentials work at startup, the way verifyMailer does for
 * SMTP — so a wrong password is a boot-log line rather than a Sent folder that
 * stays mysteriously empty.
 */
export async function verifySentFolder(): Promise<void> {
  const cfg = config();
  if (!cfg) {
    logger.info(
      "Sent-folder copies are off (IMAP_HOST is unset) — mail will still send",
    );
    return;
  }

  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
    logger: cfg.logger,
  });

  try {
    await client.connect();
    const path = await sentMailbox(client, cfg.mailbox);
    logger.info({ host: cfg.host, mailbox: path }, "IMAP ready — sent copies on");
  } catch (err) {
    logger.error(
      { err },
      "IMAP credentials rejected — mail will send, but no copies will be filed",
    );
  } finally {
    try {
      await client.logout();
    } catch {
      // Nothing to salvage.
    }
  }
}

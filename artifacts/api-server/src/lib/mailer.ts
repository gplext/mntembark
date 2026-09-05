import nodemailer, { type Transporter } from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { logger } from "./logger";
import { fileInSentFolder } from "./sentFolder";

/**
 * SMTP transport, built once and reused.
 *
 * Configured for Migadu but provider-agnostic: host, port and credentials all
 * come from the environment, so moving to another provider is an env change.
 *
 * Absent configuration is a supported state, not a crash. A developer running
 * the site locally has no SMTP credentials and should not have to invent any;
 * the site works, enquiries save, and their notifications sit queued with a
 * clear reason. Only a half-configured setup is treated as a mistake, because
 * that one is always a typo rather than a decision.
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /**
   * The branded alternative. Sent alongside the text, never instead of it —
   * the recipient's client picks, and anything that refuses HTML still has a
   * readable message.
   */
  html?: string;
  /** Sets the header so a reply goes to the client, not to the notifications inbox. */
  replyTo?: string;
}

export interface MailResult {
  messageId: string;
}

const REQUIRED = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"] as const;

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

let transporter: Transporter | null = null;
let configError: string | null = null;

function configure(): void {
  const present = REQUIRED.filter((k) => env(k));

  if (present.length === 0) {
    configError =
      "Email is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM are unset).";
    return;
  }

  if (present.length < REQUIRED.length) {
    const missing = REQUIRED.filter((k) => !env(k));
    configError = `Email is half-configured — missing ${missing.join(", ")}.`;
    logger.error({ missing }, "SMTP configuration is incomplete");
    return;
  }

  /*
   * Port 465 is implicit TLS from the first byte; 587 starts in the clear and
   * upgrades with STARTTLS. Getting `secure` wrong for the port hangs the
   * connection rather than failing, so derive it rather than asking for it.
   */
  const port = Number(env("SMTP_PORT") ?? 465);

  transporter = nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port,
    secure: port === 465,
    auth: { user: env("SMTP_USER"), pass: env("SMTP_PASS") },
  });
}

configure();

export function isMailConfigured(): boolean {
  return transporter !== null;
}

export function mailConfigError(): string | null {
  return configError;
}

export function mailFrom(): string {
  const address = env("MAIL_FROM") ?? "";
  const name = env("MAIL_FROM_NAME");
  return name ? `"${name}" <${address}>` : address;
}

/**
 * Who gets told when an enquiry arrives. Comma-separated, falling back to the
 * sending mailbox so a misconfigured deployment still reaches somebody.
 */
export function adminRecipients(): string[] {
  const raw = env("ADMIN_NOTIFY_EMAILS") ?? env("MAIL_FROM") ?? "";
  return raw
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
}

/**
 * Proves the credentials work without sending anything.
 *
 * Called once at startup so a wrong password is a line in the boot log rather
 * than a mystery discovered when the first real enquiry fails to arrive. It
 * only reports: refusing to start over email would take the whole site down for
 * a problem the site can survive.
 */
export async function verifyMailer(): Promise<void> {
  if (!transporter) {
    logger.warn({ reason: configError }, "Email sending is disabled");
    return;
  }
  try {
    await transporter.verify();
    logger.info({ host: env("SMTP_HOST"), from: mailFrom() }, "SMTP ready");
  } catch (err) {
    logger.error({ err }, "SMTP credentials rejected — email will fail");
  }
}

/**
 * Force CRLF line endings on a composed message.
 *
 * RFC 5322 requires them, and the SMTP transport fixes them up on the way out —
 * so a message can go over the wire correct while the composed buffer still
 * holds bare newlines in the body. That buffer is what gets filed in the Sent
 * folder, and IMAP servers are entitled to reject an APPEND of a message with
 * bare newlines. Normalising here means the copy is both valid and identical to
 * what was sent.
 *
 * latin1 round-trips arbitrary bytes through a string unchanged, so this is
 * safe for any transfer encoding.
 */
function toCrlf(raw: Buffer): Buffer {
  return Buffer.from(raw.toString("latin1").replace(/\r?\n/g, "\r\n"), "latin1");
}

/** The bare address out of `"Name" <addr>`, for the SMTP envelope. */
function bareAddress(value: string): string {
  const match = /<([^>]+)>/.exec(value);
  return (match?.[1] ?? value).trim();
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  if (!transporter) {
    throw new Error(configError ?? "Email is not configured");
  }

  const fields = {
    from: mailFrom(),
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    replyTo: message.replyTo,
  };

  /*
   * Compose once, then send those exact bytes.
   *
   * Letting nodemailer compose during send would be simpler, but then the copy
   * filed in the Sent folder would have to be composed a second time — a
   * different Message-ID and Date, so the archive would hold something that
   * merely resembles what the recipient got, and a reply would not thread
   * against it.
   */
  const raw = toCrlf(await new MailComposer(fields).compile().build());

  const info = await transporter.sendMail({
    raw,
    /*
     * Raw mail bypasses header parsing, so the envelope has to be stated. These
     * are the addresses SMTP actually routes on; the headers above are only
     * what the recipient reads.
     */
    envelope: { from: bareAddress(fields.from), to: [message.to] },
  });

  /*
   * Deliberately not awaited and deliberately unable to fail: the message is
   * already delivered. Making the caller wait on an archival copy would let a
   * slow IMAP server stall the queue, and letting it throw would mark a
   * delivered message failed — and send it again on the next pass.
   */
  void fileInSentFolder(raw);

  return { messageId: info.messageId };
}

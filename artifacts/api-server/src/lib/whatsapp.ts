import { logger } from "./logger";

/**
 * Sending WhatsApp messages through Meta's Cloud API.
 *
 * WhatsApp is not email with a different address. Three constraints shape
 * everything here, and all three come from Meta rather than from us:
 *
 *   1. A business cannot write its own words to someone who has not messaged
 *      it in the last 24 hours. It can only name a template Meta approved in
 *      advance and supply the blanks. So this file never sends prose — it
 *      sends a template name and an ordered list of parameters.
 *   2. The recipient must have opted in, demonstrably. That is why the enquiry
 *      form has its own checkbox rather than reusing the marketing one.
 *   3. Numbers are E.164 digits only. "07700 900123" is not a phone number to
 *      this API; it is a 400.
 *
 * As with email, absent configuration is a supported state. A site with no
 * WhatsApp credentials takes enquiries exactly as before.
 */

const REQUIRED = [
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_ACCESS_TOKEN",
] as const;

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

/** Overridable so tests can point at a stub instead of Meta. */
function apiBase(): string {
  return env("WHATSAPP_API_BASE") ?? "https://graph.facebook.com";
}

function apiVersion(): string {
  return env("WHATSAPP_API_VERSION") ?? "v23.0";
}

let configError: string | null = null;

function configure(): void {
  const present = REQUIRED.filter((k) => env(k));
  if (present.length === 0) {
    configError =
      "WhatsApp is not configured (WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN are unset).";
    return;
  }
  if (present.length < REQUIRED.length) {
    const missing = REQUIRED.filter((k) => !env(k));
    configError = `WhatsApp is half-configured — missing ${missing.join(", ")}.`;
    logger.error({ missing }, "WhatsApp configuration is incomplete");
    return;
  }
  configError = null;
}

configure();

export function isWhatsAppConfigured(): boolean {
  return configError === null;
}

export function whatsAppConfigError(): string | null {
  return configError;
}

/** Where the office alert goes. Comma-separated, E.164. */
export function whatsAppAdminRecipients(): string[] {
  return (env("WHATSAPP_NOTIFY_NUMBERS") ?? "")
    .split(",")
    .map((n) => toE164(n))
    .filter((n): n is string => n !== null);
}

export const WHATSAPP_TEMPLATES = {
  clientConfirmation: env("WHATSAPP_CLIENT_TEMPLATE") ?? "enquiry_confirmation",
  adminAlert: env("WHATSAPP_ADMIN_TEMPLATE") ?? "enquiry_alert",
} as const;

export function whatsAppLanguage(): string {
  return env("WHATSAPP_TEMPLATE_LANGUAGE") ?? "en";
}

/**
 * Turn what somebody typed into a phone field into E.164, or admit we can't.
 *
 * Returning null rather than a guess is the point. A wrong number does not
 * fail: it delivers a stranger's travel enquiry to a stranger. So anything
 * this cannot resolve confidently — a local number with no country context, a
 * string with too few digits — comes back null, and no message is queued.
 *
 * `DEFAULT_PHONE_COUNTRY_CODE` (e.g. "44", "92") supplies the country for
 * numbers written in local form, which is most of them. Without it, only
 * numbers the visitor wrote with a + are usable.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 00 is the other way of writing +, used across most of Europe and Asia.
  const international = trimmed.startsWith("+")
    ? trimmed.slice(1)
    : trimmed.replace(/^00/, "").length !== trimmed.length
      ? trimmed.replace(/^00/, "")
      : null;

  if (international !== null) {
    const digits = international.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  const country = env("DEFAULT_PHONE_COUNTRY_CODE")?.replace(/\D/g, "");
  if (!country) return null;

  /*
   * A national number written locally usually carries a trunk prefix — the 0
   * in "07700 900123" — which is not part of the international number and must
   * come off before the country code goes on.
   */
  const national = trimmed.replace(/\D/g, "").replace(/^0+/, "");
  if (national.length < 6) return null;

  const full = `${country}${national}`;
  return full.length >= 8 && full.length <= 15 ? `+${full}` : null;
}

export interface WhatsAppTemplateMessage {
  /** E.164, as produced by toE164. */
  to: string;
  templateName: string;
  languageCode: string;
  /** Body parameters, in the order the approved template expects them. */
  params: string[];
}

export interface WhatsAppResult {
  messageId: string;
}

/**
 * Send one template message.
 *
 * Throws on failure with Meta's own words, because the outbox stores that
 * message and the admin screen shows it — "(#132001) Template name does not
 * exist" tells someone what to fix; "WhatsApp failed" starts a search.
 */
export async function sendWhatsApp(
  message: WhatsAppTemplateMessage,
): Promise<WhatsAppResult> {
  if (configError) throw new Error(configError);

  const url = `${apiBase()}/${apiVersion()}/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`;

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: message.to,
    type: "template",
    template: {
      name: message.templateName,
      language: { code: message.languageCode },
      components: message.params.length
        ? [
            {
              type: "body",
              parameters: message.params.map((text) => ({ type: "text", text })),
            },
          ]
        : [],
    },
  };

  /*
   * A timeout of our own. Left to itself a hung connection would hold a worker
   * slot until the platform's own limit, which is long enough to stall the
   * queue behind it.
   */
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("WHATSAPP_ACCESS_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(
      err instanceof Error && err.name === "AbortError"
        ? "WhatsApp did not respond within 20 seconds"
        : `Could not reach WhatsApp: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const error = (parsed as { error?: { message?: string; code?: number } })?.error;
    throw new Error(
      error?.message
        ? `${error.message}${error.code ? ` (code ${error.code})` : ""}`
        : `WhatsApp returned ${response.status}: ${text.slice(0, 200)}`,
    );
  }

  const messageId = (parsed as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id;
  if (!messageId) {
    /*
     * A 200 with no message id means Meta accepted the request but did not
     * accept the message. Treating that as success would mark a row sent that
     * nobody will ever receive.
     */
    throw new Error(`WhatsApp accepted the request but returned no message id: ${text.slice(0, 200)}`);
  }

  return { messageId };
}

/**
 * Report at startup whether WhatsApp will work, without sending anything.
 *
 * Reads the configured phone number back from the API: a wrong token or a
 * wrong id both fail here, in the boot log, rather than silently at the moment
 * a real client is waiting for a reply.
 */
export async function verifyWhatsApp(): Promise<void> {
  if (configError) {
    logger.info({ reason: configError }, "WhatsApp sending is disabled");
    return;
  }

  const url = `${apiBase()}/${apiVersion()}/${env("WHATSAPP_PHONE_NUMBER_ID")}?fields=display_phone_number,verified_name`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${env("WHATSAPP_ACCESS_TOKEN")}` },
    });
    const data = (await response.json()) as {
      display_phone_number?: string;
      verified_name?: string;
      error?: { message?: string };
    };

    if (!response.ok) {
      logger.error(
        { reason: data.error?.message ?? `HTTP ${response.status}` },
        "WhatsApp credentials rejected — WhatsApp messages will fail",
      );
      return;
    }

    logger.info(
      {
        number: data.display_phone_number,
        name: data.verified_name,
        clientTemplate: WHATSAPP_TEMPLATES.clientConfirmation,
        adminTemplate: WHATSAPP_TEMPLATES.adminAlert,
      },
      "WhatsApp ready",
    );
  } catch (err) {
    logger.error({ err }, "Could not reach WhatsApp at startup");
  }
}

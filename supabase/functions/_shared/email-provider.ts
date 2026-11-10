export const resendEmailUrl = "https://api.resend.com/emails";
export const smtp2goEmailUrl = "https://api.smtp2go.com/v3/email/send";
const emailRequestTimeoutMs = 20_000;
const maxEventIdLength = 200;

export const normalizedDeliveryEvents = [
  "sent",
  "delivered",
  "opened",
  "bounced",
  "failed",
] as const;

export type NormalizedDeliveryEvent = (typeof normalizedDeliveryEvents)[number];
export type EmailProviderName = "resend" | "smtp2go";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
};

export type EmailSendResult = { ok: true; providerEmailId: string } | { ok: false; status: number };

export type EmailProvider = {
  name: EmailProviderName;
  send: (message: EmailMessage) => Promise<EmailSendResult>;
};

export type EmailProviderSecrets = {
  emailProvider?: string | undefined;
  emailFrom?: string | undefined;
  resendKey?: string | undefined;
  resendFrom?: string | undefined;
  smtp2goKey?: string | undefined;
};

export type SuppressionReason = "complaint" | "unsubscribe";

export type NormalizedDelivery = {
  event: NormalizedDeliveryEvent | null;
  providerEmailId: string | null;
  eventId: string | null;
  suppressReason: SuppressionReason | null;
  suppressEmail: string | null;
};

const resendDeliveryEvents: Record<string, NormalizedDeliveryEvent> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.bounced": "bounced",
  "email.failed": "failed",
  "email.complained": "failed",
};

const smtp2goDeliveryEvents: Record<string, NormalizedDeliveryEvent> = {
  processed: "sent",
  delivered: "delivered",
  open: "opened",
  bounce: "bounced",
  reject: "failed",
  spam: "failed",
};

export function selectedEmailProvider(value: string | undefined): EmailProviderName | null {
  const selected = value?.trim().toLowerCase() || "resend";
  if (selected === "resend" || selected === "smtp2go") return selected;
  return null;
}

export function emailSenderAddress(secrets: EmailProviderSecrets) {
  return secrets.emailFrom?.trim() || secrets.resendFrom?.trim() || "";
}

export function deliveryEventKey(provider: EmailProviderName, eventId: string) {
  return `delivery:${provider}:${eventId}`;
}

export function createEmailProvider(
  secrets: EmailProviderSecrets,
  fetchImpl: typeof fetch,
): EmailProvider | null {
  const name = selectedEmailProvider(secrets.emailProvider);
  const from = emailSenderAddress(secrets);
  if (!name || !from) return null;
  if (name === "resend") {
    const apiKey = secrets.resendKey?.trim() ?? "";
    if (!apiKey) return null;
    return { name, send: (message) => sendResend(fetchImpl, apiKey, from, message) };
  }
  const apiKey = secrets.smtp2goKey?.trim() ?? "";
  if (!apiKey) return null;
  return { name, send: (message) => sendSmtp2go(fetchImpl, apiKey, from, message) };
}

export function normalizeResendDelivery(payload: unknown): NormalizedDelivery | null {
  const record = objectRecord(payload);
  if (!record) return null;
  const type = textField(record, "type");
  const event = resendDeliveryEvents[type];
  if (!event) return null;
  const data = objectRecord(record["data"]);
  const emailId = data ? textField(data, "email_id") : "";
  return {
    event,
    providerEmailId: emailId || null,
    eventId: null,
    suppressReason: type === "email.complained" ? "complaint" : null,
    suppressEmail: data ? firstAddress(data["to"]) : null,
  };
}

export function normalizeSmtp2goDelivery(payload: unknown): NormalizedDelivery | null {
  const record = objectRecord(payload);
  if (!record) return null;
  const name = textField(record, "event");
  const event = smtp2goDeliveryEvents[name] ?? null;
  const suppressReason =
    name === "unsubscribe" ? "unsubscribe" : name === "spam" ? "complaint" : null;
  if (!event && !suppressReason) return null;
  const emailId = textField(record, "email_id");
  return {
    event,
    providerEmailId: emailId || null,
    eventId: boundedEventId(textField(record, "id")),
    suppressReason,
    suppressEmail: textField(record, "rcpt") || null,
  };
}

export function verifySmtp2goAuthorization(
  secret: string | undefined,
  authorization: string | null,
) {
  const expected = secret?.trim() ?? "";
  if (!expected) return false;
  const header = authorization?.trim() ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const presented = header.slice(prefix.length).trim();
  if (!presented) return false;
  return timingSafeEqual(presented, expected);
}

async function sendResend(
  fetchImpl: typeof fetch,
  apiKey: string,
  from: string,
  message: EmailMessage,
): Promise<EmailSendResult> {
  try {
    const response = await fetchImpl(resendEmailUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
      signal: AbortSignal.timeout(emailRequestTimeoutMs),
    });
    const body = await readJson(response);
    const id = typeof body?.["id"] === "string" ? body["id"].trim() : "";
    if (!response.ok || !id) return { ok: false, status: response.status };
    return { ok: true, providerEmailId: id };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function sendSmtp2go(
  fetchImpl: typeof fetch,
  apiKey: string,
  from: string,
  message: EmailMessage,
): Promise<EmailSendResult> {
  try {
    const response = await fetchImpl(smtp2goEmailUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Smtp2go-Api-Key": apiKey,
      },
      body: JSON.stringify({
        sender: from,
        to: [message.to],
        subject: message.subject,
        text_body: message.text,
      }),
      signal: AbortSignal.timeout(emailRequestTimeoutMs),
    });
    const body = await readJson(response);
    const data = objectRecord(body?.["data"]);
    const emailId = data ? textField(data, "email_id") : "";
    const failed = typeof data?.["failed"] === "number" ? data["failed"] : 0;
    const failures = Array.isArray(data?.["failures"]) ? data["failures"].length : 0;
    if (!response.ok || !data || failed > 0 || failures > 0 || !emailId) {
      return { ok: false, status: response.status };
    }
    return { ok: true, providerEmailId: emailId };
  } catch {
    return { ok: false, status: 0 };
  }
}

function objectRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function firstAddress(value: unknown) {
  const address = Array.isArray(value) ? value.find((item) => typeof item === "string") : value;
  return typeof address === "string" && address.trim() ? address.trim() : null;
}

function boundedEventId(value: string) {
  if (!value || value.length > maxEventIdLength) return null;
  return value;
}

async function readJson(response: Response) {
  try {
    const payload: unknown = await response.json();
    return objectRecord(payload);
  } catch {
    return null;
  }
}

function timingSafeEqual(left: string, right: string) {
  const encodedLeft = new TextEncoder().encode(left);
  const encodedRight = new TextEncoder().encode(right);
  const length = Math.max(encodedLeft.length, encodedRight.length);
  let mismatch = encodedLeft.length === encodedRight.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (encodedLeft[index] ?? 0) ^ (encodedRight[index] ?? 0);
  }
  return mismatch === 0;
}

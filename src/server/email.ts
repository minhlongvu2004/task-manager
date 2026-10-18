/** Sends sign-in emails through the Resend HTTP API. */
export const LOGIN_LINK_MINUTES = 15;

export type EmailSender = (to: string, url: string) => Promise<void>;

let override: EmailSender | null = null;
/** Tests install a fake sender here; pass null to restore the real one. */
export function setEmailSender(sender: EmailSender | null): void {
  override = sender;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const CALLBACK_PREFIX = "/api/auth/callback/resend?";

/**
 * Mail scanners (Outlook Safe Links and the like) fetch every link in a message, which would use up the
 * one-time token. The email therefore links to a page that does nothing on GET; the token is only spent
 * when the person presses its button.
 */
export function confirmPageUrl(url: string): string {
  const u = new URL(url);
  return `${u.origin}/signin/confirm?next=${encodeURIComponent(u.pathname + u.search)}`;
}

/** Returns `next` only if it is the email sign-in callback on this site (path and query, never another host). */
export function safeCallbackPath(next: unknown): string | null {
  if (typeof next !== "string" || !next.startsWith(CALLBACK_PREFIX)) return null;
  return next;
}

export function buildLoginEmail(callbackUrl: string) {
  const url = confirmPageUrl(callbackUrl);
  const { host } = new URL(url);
  const subject = `Sign in to ${host}`;
  const text = `Sign in to Task Manager:\n\n${url}\n\nThis link expires in ${LOGIN_LINK_MINUTES} minutes and works once. If you did not ask for it, ignore this email.\n`;
  const u = escapeHtml(url);
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#18181b"><h1 style="font-size:20px">Task Manager</h1><p>Use the link below to sign in.</p><p><a href="${u}" style="display:inline-block;background:#18181b;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Sign in</a></p><p style="font-size:13px;color:#52525b">Or paste this into your browser:<br>${u}</p><p style="font-size:13px;color:#52525b">This link expires in ${LOGIN_LINK_MINUTES} minutes and works once. If you did not ask for it, ignore this email.</p></div>`;
  return { subject, text, html };
}

export const RESEND_TIMEOUT_MS = 10_000;

/** Exported for tests only; use sendLoginEmail. */
export async function sendWithResend(to: string, url: string, timeoutMs = RESEND_TIMEOUT_MS): Promise<void> {
  const key = process.env.AUTH_RESEND_KEY;
  if (!key) throw new Error("AUTH_RESEND_KEY is not set");
  const { subject, text, html } = buildLoginEmail(url);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs), // a hung Resend call must not hang sign-in
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || "login@minhlongvu.com", to, subject, text, html }),
  });
  // Never include the response body or the URL in the error: neither belongs in logs.
  if (!res.ok) throw new Error(`Resend responded with status ${res.status}`);
}

export async function sendLoginEmail(to: string, url: string): Promise<void> {
  if (override) return override(to, url);
  // Tests must install a fake with setEmailSender; the real sender is never reachable from them.
  if (process.env.NODE_ENV === "test") throw new Error("No email sender set in test");
  return sendWithResend(to, url);
}

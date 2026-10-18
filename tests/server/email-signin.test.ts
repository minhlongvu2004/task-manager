import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { count, eq } from "drizzle-orm";
import { Auth, skipCSRFCheck, type AuthConfig } from "@auth/core";
import { db } from "@/db/client";
import { allowedEmails, users, verificationTokens } from "@/db/schema";
import { resetDb } from "../db/helpers";
import { setEmailSender } from "@/server/email";
import { authAdapter } from "@/server/auth-adapter";
import { emailProvider } from "@/server/email-auth";
import { signInCallback } from "@/server/auth-callbacks";

const sent: { to: string; url: string }[] = [];
const config = (): AuthConfig => ({
  providers: [emailProvider({ apiKey: "test-not-a-real-key", from: "login@example.com" })],
  adapter: authAdapter,
  secret: "test-secret-test-secret-test-secret",
  trustHost: true,
  basePath: "/api/auth",
  skipCSRFCheck,
  session: { strategy: "jwt" as const },
  pages: { signIn: "/signin", error: "/not-invited", verifyRequest: "/verify-request" },
  callbacks: { signIn: signInCallback },
});
const O = "http://localhost:3000";
const requestLink = (email: string) =>
  Auth(
    new Request(`${O}/api/auth/signin/resend`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email, callbackUrl: `${O}/` }),
    }),
    config(),
  );
const useLink = (url: string) => Auth(new Request(url), config());
const hasSession = (res: Response) =>
  res.headers.getSetCookie().some((c) => /session-token=[^;]+/.test(c) && !/Max-Age=0/i.test(c));
const nUsers = async () => (await db.select({ c: count() }).from(users))[0].c;
const nTokens = async () => (await db.select({ c: count() }).from(verificationTokens))[0].c;

beforeEach(async () => {
  await resetDb();
  process.env.OWNER_EMAIL = "owner@example.com";
  sent.length = 0;
  setEmailSender(async (to, url) => void sent.push({ to, url }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  setEmailSender(null);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("requesting a link", () => {
  it("sends exactly one email for an allowed address (normalized)", async () => {
    await db.insert(allowedEmails).values({ email: "friend@example.com" });
    await requestLink("  Friend@Example.com ");
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("friend@example.com");
    expect(await nTokens()).toBe(1);
  });

  it("sends nothing and stores nothing for a stranger, with an identical response", async () => {
    await db.insert(allowedEmails).values({ email: "friend@example.com" });
    const ok = await requestLink("friend@example.com");
    const no = await requestLink("stranger@example.com");
    expect(sent).toHaveLength(1);
    expect(await nTokens()).toBe(1);
    expect(await nUsers()).toBe(0);
    expect(no.status).toBe(ok.status);
    expect(no.headers.get("location")).toBe(ok.headers.get("location"));
    expect(no.headers.get("location")).toContain("/verify-request");
    expect(hasSession(no)).toBe(false);
  });

  it("gives the same response when the email sender fails", async () => {
    await db.insert(allowedEmails).values({ email: "friend@example.com" });
    setEmailSender(async () => {
      throw new Error("boom");
    });
    const res = await requestLink("friend@example.com");
    expect(res.headers.get("location")).toContain("/verify-request");
  });
});

describe("using a link", () => {
  const issue = async (email: string) => {
    await requestLink(email);
    return sent[sent.length - 1].url;
  };

  it("signs an allowed address in once and reuses a pre-created user row", async () => {
    await db.insert(allowedEmails).values({ email: "friend@example.com" });
    const [pre] = await db.insert(users).values({ email: "friend@example.com" }).returning();
    const res = await useLink(await issue("friend@example.com"));
    expect(hasSession(res)).toBe(true);
    expect(res.headers.get("location")).toBe(`${O}/`);
    expect(await nUsers()).toBe(1);
    const [row] = await db.select().from(users).where(eq(users.email, "friend@example.com"));
    expect(row.id).toBe(pre.id);
    expect(await nTokens()).toBe(0);
  });

  it("creates the owner user and workspace on first email sign-in", async () => {
    const res = await useLink(await issue("OWNER@example.com"));
    expect(hasSession(res)).toBe(true);
    expect(await nUsers()).toBe(1);
  });

  it("fails the second time the same link is used", async () => {
    await db.insert(allowedEmails).values({ email: "friend@example.com" });
    const url = await issue("friend@example.com");
    expect(hasSession(await useLink(url))).toBe(true);
    const again = await useLink(url);
    expect(hasSession(again)).toBe(false);
  });

  it("fails after the link expires (15 minutes or less)", async () => {
    await db.insert(allowedEmails).values({ email: "friend@example.com" });
    const url = await issue("friend@example.com");
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 16 * 60 * 1000 });
    expect(hasSession(await useLink(url))).toBe(false);
    expect(await nUsers()).toBe(0);
  });

  it("rejects a tampered token or a different email", async () => {
    await db.insert(allowedEmails).values({ email: "friend@example.com" });
    const u = new URL(await issue("friend@example.com"));
    const bad = new URL(u);
    bad.searchParams.set("token", "0".repeat(64));
    expect(hasSession(await useLink(bad.toString()))).toBe(false);
    const other = new URL(u);
    other.searchParams.set("email", "owner@example.com");
    expect(hasSession(await useLink(other.toString()))).toBe(false);
  });

  it("signs nobody in if the address was removed from the allowlist after the link was sent", async () => {
    await db.insert(allowedEmails).values({ email: "friend@example.com" });
    const url = await issue("friend@example.com");
    await db.delete(allowedEmails);
    const res = await useLink(url);
    expect(hasSession(res)).toBe(false);
    expect(res.headers.get("location")).toContain("/not-invited");
    expect(await nUsers()).toBe(0);
  });
});

describe("adapter", () => {
  it("useVerificationToken is single-use", async () => {
    await db.insert(allowedEmails).values({ email: "a@example.com" });
    const t = { identifier: "a@example.com", token: "tok", expires: new Date(Date.now() + 60_000) };
    await authAdapter.createVerificationToken!(t);
    expect(await authAdapter.useVerificationToken!({ identifier: t.identifier, token: "tok" })).toMatchObject({ identifier: t.identifier });
    expect(await authAdapter.useVerificationToken!({ identifier: t.identifier, token: "tok" })).toBeNull();
  });
  it("createUser refuses non-allowed addresses", async () => {
    await expect(authAdapter.createUser!({ id: "x", email: "stranger@example.com", emailVerified: null })).rejects.toThrow();
    expect(await nUsers()).toBe(0);
  });
});

describe("sendLoginEmail", () => {
  it("escapes the link in the HTML body and states the expiry", async () => {
    const { buildLoginEmail } = await import("@/server/email");
    const m = buildLoginEmail(`${O}/api/auth/callback/resend?a=1&b="><script>x</script>`);
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&amp;b=&quot;&gt;&lt;script&gt;");
    expect(m.html).toContain("expires in 15 minutes");
    expect(m.text).toContain("expires in 15 minutes");
  });
  it("refuses to use the real sender under test", async () => {
    const { sendLoginEmail } = await import("@/server/email");
    setEmailSender(null);
    await expect(sendLoginEmail("a@example.com", `${O}/x`)).rejects.toThrow("No email sender");
  });
});

describe("Resend request timeout", () => {
  const hang = () =>
    vi.stubGlobal(
      "fetch",
      (_url: unknown, init: RequestInit) =>
        new Promise((_res, rej) => init.signal!.addEventListener("abort", () => rej(init.signal!.reason))),
    );
  afterEach(() => vi.unstubAllGlobals());

  it("aborts a hung request without leaking the URL or token", async () => {
    process.env.AUTH_RESEND_KEY = "k";
    hang();
    const { sendWithResend } = await import("@/server/email");
    const err = await sendWithResend("a@example.com", `${O}/cb?token=SECRET`, 30).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(String(err.message)).not.toContain("SECRET");
    delete process.env.AUTH_RESEND_KEY;
  });

  it("leaves the sign-in response unchanged when the send times out", async () => {
    process.env.AUTH_RESEND_KEY = "k";
    hang();
    const { sendWithResend } = await import("@/server/email");
    setEmailSender((to, url) => sendWithResend(to, url, 30));
    await db.insert(allowedEmails).values({ email: "friend@example.com" });
    const res = await requestLink("friend@example.com");
    expect(res.headers.get("location")).toContain("/verify-request");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("token=");
    delete process.env.AUTH_RESEND_KEY;
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { count, eq } from "drizzle-orm";
import { Auth, customFetch, skipCSRFCheck, type AuthConfig } from "@auth/core";
import Google from "next-auth/providers/google";
import { db } from "@/db/client";
import { allowedEmails, users, workspaces } from "@/db/schema";
import { resetDb } from "../db/helpers";
import { GOOGLE_OPTIONS } from "@/auth.config";
import { authAdapter } from "@/server/auth-adapter";
import { emailProvider } from "@/server/email-auth";
import { signInCallback } from "@/server/auth-callbacks";

const O = "http://localhost:3000";
const ISS = "https://accounts.google.com";
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

// Stubs Google's discovery and token endpoints. oauth4webapi does not verify the id_token
// signature (it relies on TLS to the token endpoint), so an unsigned-looking JWT is accepted.
let profileClaims: Record<string, unknown> = {};
let nonce = "";
const fakeGoogle = async (input: RequestInfo | URL): Promise<Response> => {
  const url = String(input instanceof Request ? input.url : input);
  const json = (b: unknown) => new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } });
  if (url.includes("openid-configuration"))
    return json({
      issuer: ISS,
      authorization_endpoint: `${ISS}/o/oauth2/v2/auth`,
      token_endpoint: `${ISS}/token`,
      userinfo_endpoint: `${ISS}/userinfo`,
      jwks_uri: `${ISS}/certs`,
    });
  if (url.endsWith("/token")) {
    const now = Math.floor(Date.now() / 1000);
    const claims = { iss: ISS, aud: "cid", sub: "g-123", iat: now, exp: now + 600, ...(nonce ? { nonce } : {}), ...profileClaims };
    return json({ access_token: "at", token_type: "Bearer", expires_in: 3600, id_token: `${b64({ alg: "RS256" })}.${b64(claims)}.sig` });
  }
  throw new Error(`unexpected fetch ${url}`);
};

const config = (withEmail: boolean): AuthConfig => ({
  providers: [
    Google({ ...GOOGLE_OPTIONS, clientId: "cid", clientSecret: "csecret", [customFetch]: fakeGoogle } as never),
    ...(withEmail ? [emailProvider({ apiKey: "test-not-a-real-key", from: "login@example.com" })] : []),
  ],
  ...(withEmail ? { adapter: authAdapter } : {}),
  secret: "test-secret-test-secret-test-secret",
  trustHost: true,
  basePath: "/api/auth",
  skipCSRFCheck,
  session: { strategy: "jwt" },
  pages: { signIn: "/signin", error: "/not-invited", verifyRequest: "/verify-request" },
  callbacks: { signIn: signInCallback },
});

const cookieHeader = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => !c.endsWith("="))
    .join("; ");
const hasSession = (res: Response) =>
  res.headers.getSetCookie().some((c) => /session-token=[^;]+/.test(c) && !/Max-Age=0/i.test(c));

/** Real round trip: start at /signin/google, then return to the callback with the issued state cookies. */
async function googleSignIn(withEmail: boolean, claims: Record<string, unknown>) {
  profileClaims = claims;
  const start = await Auth(
    new Request(`${O}/api/auth/signin/google`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ callbackUrl: `${O}/` }),
    }),
    config(withEmail),
  );
  const auth = new URL(start.headers.get("location")!);
  nonce = auth.searchParams.get("nonce") ?? "";
  const state = auth.searchParams.get("state");

  return Auth(
    new Request(`${O}/api/auth/callback/google?${new URLSearchParams({ code: "abc", ...(state ? { state } : {}) })}`, { headers: { cookie: cookieHeader(start) } }),
    config(withEmail),
  );
}

const nUsers = async () => (await db.select({ c: count() }).from(users))[0].c;

beforeEach(async () => {
  await resetDb();
  process.env.OWNER_EMAIL = "owner@example.com";
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// Order matters: @auth/core keeps a module-level "hasEmail" flag that stays set once any config with an
// email provider has been seen, so the no-adapter run must come first in this file.
describe.each([false, true])("Google callback (adapter + email provider enabled: %s)", (withEmail) => {
  it("creates the owner's user and workspace on first sign-in, then reuses them", async () => {
    const claims = { email: "Owner@Example.com", email_verified: true, name: "Olivia" };
    const first = await googleSignIn(withEmail, claims);
    expect(hasSession(first)).toBe(true);
    expect(first.headers.get("location")).toBe(`${O}/`);
    expect(await nUsers()).toBe(1);
    const second = await googleSignIn(withEmail, claims);
    expect(hasSession(second)).toBe(true);
    expect(await nUsers()).toBe(1);
    expect((await db.select({ c: count() }).from(workspaces))[0].c).toBe(1);
  });

  it("reuses a row pre-created by addMemberByEmail and fills in the name", async () => {
    await db.insert(allowedEmails).values({ email: "friend@example.com" });
    const [pre] = await db.insert(users).values({ email: "friend@example.com" }).returning();
    const res = await googleSignIn(withEmail, { email: "friend@example.com", email_verified: true, name: "Frank" });
    expect(hasSession(res)).toBe(true);
    expect(await nUsers()).toBe(1);
    const [row] = await db.select().from(users).where(eq(users.email, "friend@example.com"));
    expect(row).toMatchObject({ id: pre.id, name: "Frank" });
  });

  it("sends a non-allowed Google account to /not-invited with no users row", async () => {
    const res = await googleSignIn(withEmail, { email: "stranger@example.com", email_verified: true, name: "S" });
    expect(hasSession(res)).toBe(false);
    expect(res.headers.get("location")).toContain("/not-invited");
    expect(await nUsers()).toBe(0);
  });

  it("rejects an allowed address whose Google email is not verified", async () => {
    const res = await googleSignIn(withEmail, { email: "owner@example.com", email_verified: false });
    expect(hasSession(res)).toBe(false);
    expect(res.headers.get("location")).toContain("/not-invited");
    expect(await nUsers()).toBe(0);
  });
});

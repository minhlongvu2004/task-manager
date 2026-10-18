import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { authConfig } from "@/auth.config";

// proxy.ts imports next-auth (needs the Next runtime), and Next requires a literal matcher, so
// read the literal out of the source instead of importing the module.
const src = fs.readFileSync(path.join(process.cwd(), "src/proxy.ts"), "utf8");
const literal = src.match(/matcher:\s*\[\s*"([^"]+)"/)![1];
const re = new RegExp(`^${literal}$`);
const authorized = authConfig.callbacks.authorized as (a: unknown) => boolean;
const check = (p: string, user: boolean) =>
  authorized({ auth: user ? { user: {} } : null, request: { nextUrl: new URL(p, "http://x") } });

describe("proxy matcher", () => {
  it("protects ordinary and look-alike paths", () => {
    for (const p of ["/projects/1", "/foo-png", "/xico", "/"]) expect(re.test(p), p).toBe(true);
  });
  it("skips Next static assets and the favicon", () => {
    for (const p of ["/_next/static/x", "/_next/image", "/favicon.ico"]) expect(re.test(p), p).toBe(false);
  });
});

describe("authorized callback", () => {
  it("keeps sign-in, not-invited and auth routes public", () => {
    for (const p of ["/signin", "/not-invited", "/api/auth/callback/google", "/api/auth/callback/resend"]) expect(check(p, false)).toBe(true);
  });
  it("lets the healthcheck and cron routes through without a session", () => {
    for (const p of ["/api/health", "/api/cron/purge"]) expect(check(p, false)).toBe(true);
  });
  it("does not open look-alike or other api paths", () => {
    for (const p of ["/api/health/x", "/api/cron/other", "/api/cron"]) expect(check(p, false)).toBe(false);
  });
  it("keeps /signin and /not-invited public by exact match only", () => {
    for (const p of ["/signin/x", "/not-invited/x", "/signinx", "/not-invitedx"]) expect(check(p, false), p).toBe(false);
  });
  it("requires a session elsewhere", () => {
    expect(check("/projects/1", false)).toBe(false);
    expect(check("/projects/1", true)).toBe(true);
  });
});

describe("verify-request page", () => {
  it("is public, exactly", () => {
    expect(check("/verify-request", false)).toBe(true);
    expect(check("/verify-requestx", false)).toBe(false);
    expect(check("/verify-request/x", false)).toBe(false);
  });
});

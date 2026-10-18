import Resend from "next-auth/providers/resend";
import { isEmailAllowed } from "./access";
import { LOGIN_LINK_MINUTES, sendLoginEmail } from "./email";

/** The Auth.js email provider: sends only to allowed addresses, silently ignores the rest. */
export function emailProvider(opts: { apiKey: string; from: string }) {
  return Resend({
    apiKey: opts.apiKey,
    from: opts.from,
    maxAge: LOGIN_LINK_MINUTES * 60,
    async sendVerificationRequest({ identifier, url }) {
      if (!(await isEmailAllowed(identifier))) return;
      try {
        await sendLoginEmail(identifier, url);
      } catch (e) {
        // Swallowed so success and failure look the same to the visitor; never log the URL.
        console.error("Sign-in email failed:", e instanceof Error ? e.message : "unknown error");
      }
    },
  });
}

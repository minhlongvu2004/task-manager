# Turning on email sign-in links (Resend)

Email sign-in lets invited people get a one-time link by email instead of using Google. It stays switched off until you add the key in step 4, so nothing changes until you are ready.

## Before you start
- Only addresses on the invite list (or the owner) ever receive a link. Anyone else sees the same "If that address is invited, a sign-in link is on its way." screen and gets nothing.
- Links work once and expire after 15 minutes.

## Steps
1. Make an account at resend.com.
2. In Resend, add the domain `minhlongvu.com` (Domains, then Add Domain).
3. Resend shows a short list of DNS records. Add ONLY those new records at the place where `minhlongvu.com` DNS is managed.
   - Do not edit or delete any record that already exists. Your portfolio site depends on them.
   - You may already have MX or TXT records on the root domain (`minhlongvu.com`). Leave them alone. Resend normally asks for its sending records on a subdomain (often something like `send`), so they should not clash, but copy exactly what Resend displays and do not merge them into existing records. If Resend ever asks you to change an existing record, stop and check before doing it.
4. Wait until Resend shows the domain as "Verified" (can take minutes to hours).
5. In Resend, create an API key (sending access is enough).
6. In Railway, set these variables on the app and redeploy:
   - `AUTH_RESEND_KEY` = the key from step 5
   - `EMAIL_FROM` = `login@minhlongvu.com`
7. The database change (a table for the one-time links) is applied automatically on the next start.

## Check it on the live site
- [ ] On the sign-in page, "Email me a link" appears under the Google button.
- [ ] Enter your own (owner) email: the "Check your email" screen appears, the email arrives from `login@minhlongvu.com`, and the link signs you in.
- [ ] Open the same link a second time: it does not sign you in.
- [ ] Enter an address that is NOT on the invite list: you see the same "Check your email" screen and nothing arrives.
- [ ] Add a friend in the app, ask them to try it: it works for them, and removing them from the list stops their link and their session.

## Things not verified (written without access to Resend)
These were not checked against Resend itself, so confirm on screen as you go:
- The exact DNS records Resend asks for, their names, and whether they sit on a subdomain.
- How long verification takes.
- Whether a brand-new Resend account can send to any address, or only to its own until the domain is verified.
- The API key permission names ("sending access") and where the menu items are.
- Delivery to spam folders and any sending limits on the free plan.
The app only sends via `POST https://api.resend.com/emails` with a Bearer key, the same call the Auth.js Resend provider makes.

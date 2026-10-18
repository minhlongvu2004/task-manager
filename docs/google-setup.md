# Google sign-in setup (one time, about 10 minutes)

The app signs people in with Google. Google needs to know about your app first. You do this once.

## 1. Create a Google Cloud project
1. Go to https://console.cloud.google.com and sign in with the Google account you want as the owner.
2. Click the project picker at the top, then **New project**. Name it "Task Manager" and click **Create**. Make sure it is selected afterwards.

## 2. Configure the OAuth consent screen
1. Open **APIs & Services > OAuth consent screen** (in newer consoles this is called **Google Auth Platform**; click **Get started**).
2. App name: `Task Manager`. User support email: your email. Developer contact email: your email.
3. Audience / user type: **External**.
4. Under **Test users** (Audience page), click **Add users** and add the owner's email. While the app is in "Testing" only listed test users can sign in, which is what you want.
5. Save.

## 3. Create the OAuth client
1. Open **APIs & Services > Credentials** (or **Clients**), then **Create credentials > OAuth client ID**.
2. Application type: **Web application**. Name: `Task Manager local`.
3. Under **Authorized redirect URIs** click **Add URI** and enter exactly:
   `http://localhost:3000/api/auth/callback/google`
4. Click **Create**. Copy the **Client ID** and **Client secret**.

## 4. Fill in `.env.local`
Copy `.env.example` to `.env.local` (if you have not) and set:

```
AUTH_GOOGLE_ID=<Client ID from step 3>
AUTH_GOOGLE_SECRET=<Client secret from step 3>
AUTH_SECRET=<random string>
OWNER_EMAIL=<the owner's Google email>
```

Make `AUTH_SECRET` with `npx auth secret` (it writes the value for you) or `openssl rand -base64 32`.
`OWNER_EMAIL` must be the same Google account you added as a test user.

## 5. Try it
Run `npm run dev`, open http://localhost:3000, click **Sign in with Google**, and choose the owner account. You should land on the app. A different Google account is sent to a "not invited" page and nothing is saved.

## Later: deployment
When the app is deployed to Railway (Task 9), come back to the OAuth client and add a second authorized redirect URI:
`https://<your-railway-domain>/api/auth/callback/google`

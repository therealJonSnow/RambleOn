# Setting up your own RambleOn (early guide)

This is the short version for M1. The full guide (Netlify, Vercel and Cloudflare, with screenshots) arrives in M5.

You need: a free [Supabase](https://supabase.com) account, a free [Netlify](https://netlify.com) account, Node 22+, and this repo on GitHub.

## 1. Try it locally without Supabase (optional)

```sh
cd app
npm install
npm run dev
```

With no Supabase settings the app runs in **demo mode**: no sign-in, and the encrypted journal is stored in that browser only.

## 2. Create the database

1. In Supabase, create a new project.
2. Open **SQL Editor**, paste the whole of [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) and click **Run**.

## 3. Set up sign-in

RambleOn signs in with email and password, so it doesn't need Supabase to send any emails. That matters because on the free tier the email templates can't be edited without custom SMTP, and the built-in sender only allows a couple of emails an hour.

**Authentication → Sign In / Providers → Email**:
- make sure **Email** is enabled
- switch off **Confirm email**. You're the only user, and sign-ups get turned off in step 5.

## 4. Connect the app

From **Project Settings → API**, copy the project URL and the publishable key (or the legacy anon key).

```sh
cd app
cp .env.example .env.local
# edit .env.local and paste both values
npm run dev
```

Open the app, choose **Create account**, then choose a passphrase and **print your recovery key**. Let iCloud Keychain (or your password manager) save the password; on iPhone it then fills in with Face ID.

## 5. Turn off sign-ups

Now that your account exists: **Authentication → Sign In / Providers**, switch off **Allow new users to sign up**. Otherwise anyone who finds your app could create an account. Row-level security would keep your journal private, but they'd be using your free quota.

## 6. Deploy to Netlify

1. **Add new site → Import an existing project**, pick your repo. `netlify.toml` already sets the base directory (`app`), build command and publish folder.
2. **Site configuration → Environment variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Deploy.

The build is a plain folder of static files with hash-based routing, so any static host works without rewrite rules.

## 7. Keep the database awake

Free Supabase projects pause after about a week without activity. The workflow in `.github/workflows/keepalive.yml` pings the database every three days. In your GitHub repo, **Settings → Secrets and variables → Actions**, add:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Then run it once by hand from the **Actions** tab to check it works.

## 8. Install on your iPhone

Open your Netlify URL in Safari → **Share** → **Add to Home Screen**. Open it from the home screen, sign in (Keychain fills in your password), and enter your passphrase once.

To dictate: tap the red button (bottom right), then the mic key on the keyboard.

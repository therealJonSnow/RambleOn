# RambleOn: plan

Decisions from the planning session, worked through question by question, against the open questions in [brief.md](./brief.md). This is the source of truth until code exists. Anything not listed here is still open.

## Product

### Platform
- **PWA only, mobile-first.** No native app. On a laptop it's a normal website, which suits reading, the archive and export.

### Today page (home view)
- Opens to **today's page**.
- **Prose section:** all of today's passages read as one continuous page of writing.
  - Each passage is headed with **the time by default** (e.g. `00:40`). You can type a title as well.
  - Images sit inline in the prose (M2).
- **Notes area** at the bottom: text-first, works like a small notes app for that day. Holds links, podcast tips and jot-downs like "met so-and-so in the park".
  - Notes **stay on their day**. An **All notes** view lists every note newest first, searchable, showing the day each came from.
  - Notes are editable at all times, including on past days.
- **Record button** in the **bottom-right corner** (thumb zone). A Setting moves it to bottom-left.
  - Without the AI add-on, it opens a new passage with the keyboard up, and you use iOS keyboard dictation (two taps).
  - With the AI add-on (M3), it records and transcribes in one tap.

### Days and editing
- **Day rollover at 4am**, changeable in Settings. Each passage stores its real time **and** a journal date, so a passage written at 00:40 belongs to the previous day.
- You can move a passage to a different day by hand.
- **Past days lock at rollover.** After that you can only add dated **margin notes** (corrections). Settings has an escape hatch to unlock a day, e.g. to delete something.

### Transcription and cleanup
- **Default: iOS keyboard dictation.** No audio is stored and there's no AI.
- **The raw text is always kept.** The page shows the cleaned version, and a toggle on each passage shows the original.
- **Rule-based filler removal** when a passage is saved:
  - The text is split into words and punctuation, never blind find-and-replace. A one-word filler sentence (`Um.`) is removed with its full stop and space. A filler inside a sentence (`It was, um, fine.`) is removed with its commas. Capitals are fixed afterwards. Stutters like `I I` are collapsed.
  - The **list of filler words can be edited in Settings.** English defaults: um, uh, er, erm, plus stutters. Multi-word phrases (e.g. "you know") can be added but are off by default. It's a plain list, not regular expressions, and it's saved with your account and included in exports.
  - It's checked against fixtures made from real dictations.
- Mistranscriptions are fixed by editing by hand, or with Tidy in M3.

### Privacy and security
- **Encrypted on the device from day one.** A key is derived from a passphrase, and text is encrypted with WebCrypto AES-GCM before it leaves the phone.
  - Encrypted: passage text (raw and cleaned), notes, margin notes, images, link titles.
  - Readable: dates and timestamps, needed for sorting.
  - A **printable recovery key** is shown once at setup.
  - The passphrase is entered once per device. The key is stored as a non-extractable `CryptoKey` in IndexedDB. Settings has a "lock journal" button.
- **Sign-in: email one-time code** (a 6-digit code typed into the PWA). Magic links don't work well in installed iOS PWAs, because the link opens in Safari, which has separate storage.
- **Sign-ups are turned off** once your account exists. The self-host guide makes this a required step.
- Passkeys are a later upgrade.

### Offline and sync
- The app needs a connection, apart from saving your writing.
- **Drafts and unsynced passages are saved locally** (encrypted, in IndexedDB) and upload when the connection is back. The app shows a "waiting to sync" marker.
  - iOS Safari can't upload in the background while the app is closed. Uploads happen the next time the app opens or comes to the foreground.
  - The app requests persistent storage with `navigator.storage.persist()`.
- Each passage and note is its own record, and the latest save wins. If the same record is edited on two devices, the losing version is kept as a "conflict copy" note.

### Export and restore
- Built in the browser: entries are decrypted and zipped on the device.
- One zip:
  ```
  rambleon-export-YYYY-MM-DD.zip
  ├── days/YYYY-MM-DD.md   # headlines, prose, margin notes, notes section
  ├── media/               # images, referenced from the .md files
  └── journal.json         # everything: raw + cleaned text, real times, journal dates, settings, filler-word list
  ```
- The export is **unencrypted**, and the app warns about this before downloading.
- **Restore from `journal.json`** is in M1. An automated round-trip test checks that export, then import into a fresh project, loses nothing.

### Images (M2)
- Compressed on the device to about 1600px on the long edge, WebP or JPEG at roughly 200–300KB.
- The device also makes its own thumbnail. Both are encrypted, then uploaded to **Supabase Storage**.
- **Location data is stripped**, and the date taken is kept.
- Placed **inline at the cursor** in a passage.
- Cloudflare R2 is the option if Supabase Storage is outgrown. Nothing in the design ties you to Supabase Storage.

### Links (M2)
- **Copy and paste.** The notes area offers "Paste link from clipboard?"
- A small Edge Function fetches the page title (no images), and the title is stored encrypted.
- No share-sheet integration. iOS doesn't let a PWA appear in the share sheet, and a Shortcut can't encrypt.

### AI add-on (M3, optional)
- Whoever runs a copy pastes in their own API key, which is kept in a Supabase Edge Function and never in the browser. One switch in Settings turns it on.
- **AI transcription:** a one-tap record button. Audio goes to a Whisper-type service and is thrown away after transcription.
- **Tidy:** fixes mistranscriptions only (no rewording), with a before-and-after view before anything is saved.
- **Headline suggestions:** offered, never filled in silently.
- The app is fully usable without it.

## Stack

| Part | Choice |
|---|---|
| App | Vite + React + TypeScript, `vite-plugin-pwa`, React Router |
| Styling | Tailwind v4. Typewriter theme tokens (paper, ink, ribbon red, typewriter fonts) defined in `@theme` |
| Backend | Supabase: Postgres with row-level security, Auth (email one-time code), Storage, Edge Functions |
| Crypto | WebCrypto (AES-GCM, key derived from a passphrase) |
| Tests | Vitest |
| Docs | Astro Starlight, holding the self-host guide and landing page |
| Hosting | Netlify for Jonny's copy. The guide covers Netlify, Vercel and Cloudflare Pages. The build is plain static files, so you're not tied to a host. |
| Keep-alive | A GitHub Action pings Supabase every 3 days. The app shows a clear message if the database is paused. |

Repo layout:
```
/app    → the journal PWA
/docs   → Starlight guide (plus planning docs)
```

## Milestones

### M1: Capture and read
PWA shell; email one-time code sign-in with sign-ups off; encryption plus recovery key; today page; passages with time headlines; notes area and All notes view; keyboard dictation flow; filler removal with editable list and raw text kept; 4am rollover; locked past days and margin notes; local save and upload on reconnect; export zip plus restore; typewriter styling; record button can move to the left; keep-alive Action.
**Done when:** Jonny has used it from bed for a week without missing a night.

### M2: Images and links
Inline encrypted images; paste links with encrypted titles; on-device search across passages and notes.

### M3: AI add-on
Your own key, AI transcription for one-tap recording, Tidy, headline suggestions, "Enable AI" guide chapter.

### M4: Journal feel
Page-turn animations, typed-page layout, two-page spreads, maybe typewriter sounds. A print view styled with print CSS (per day or month) for printing to paper or PDF, so pages can go in the binder.

### M5: Open-source release
Starlight self-host guide with exact commands; Supabase setup script; deploy instructions for Netlify, Vercel and Cloudflare.

## Out of scope
Native app · storing audio · Android share target · Action button or Shortcut capture · full offline reading · social features and sharing · streaks and gamification · mood tracking · multiple users or teams.

### Later, maybe
Passkeys · "on this day" resurfacing · gentle nightly reminder · pinning notes to carry them forward · AI routing of spoken notes · full offline reading.

## To verify before M1
- [ ] Supabase free-tier pausing policy (third-party sources say 7 days without activity), checked against Supabase's own docs. The keep-alive workflow covers it either way.
- [x] The Supabase **Data API change from 30 October 2026**: new tables in `public` need explicit `GRANT`s before supabase-js can reach them. The migration grants `authenticated` only. ([changelog](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically))
- [ ] Netlify's current free-tier credit limits.
- [x] Real dictations collected. Anonymised versions are the fixtures in `app/src/lib/filler.test.ts`.

## Build notes (M1)
Decisions made while building, on top of the ones above:
- **Hash routing** (`#/day/2026-10-25`) and a relative base path: the build works on any static host with no rewrite rules.
- **Demo mode:** with no Supabase settings the app runs without sign-in, keeping the encrypted journal in browser storage. Useful for trying it out and for development.
- **Key design:** a random master key encrypts everything. The vault stores it twice, wrapped by the passphrase (PBKDF2-SHA256, 600k iterations) and by the recovery key. Each ciphertext is bound to its table and row id. The vault is only saved after the recovery key has been shown.
- **Versioned rows:** each passage and note has a `version`, and saves only apply if the version matches. On a mismatch the incoming save wins and the other version becomes a "Conflict copy" note.
- **Settings are cached on the device** (encrypted) so writing works offline.
- **The new-passage button uses a pen icon**, not a mic, because without the AI add-on it opens the keyboard. It becomes a mic in M3.
- **The composer is always in the page**, so it can take focus inside the button tap. iOS only opens the keyboard when focus happens in a user gesture.

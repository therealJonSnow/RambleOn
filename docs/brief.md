# Project brief: typewriter voice journal

Handoff from a claude.ai planning chat. Nothing is decided beyond what's listed under "Decided". Everything else is open and should be stress-tested before building.

## Origin

Jonny keeps a journal on a physical typewriter and loves it: analogue, tactile, a record of his life to look back on. The gap is convenience. Entries get missed when he's away from the desk, especially at night ("gone to bed, realised I haven't written anything").

Goal: a journal app he builds himself, for himself first, that fills those gaps without losing the feel.

## Core ideas (Jonny's)

- **Feels like a real journal.** Typewriter styling, typed pages, page-turn animations.
- **Voice-to-text is the main input.** Stream-of-consciousness capture for quick updates, especially from bed.
- **Also saves links and images.**
- **Open source**, with an online guide so others can run their own copy.
- **Free, simple stack.** Static frontend on Netlify or Vercel (open on which, ethics matter to him), free Supabase account as the database.
- **Full data export** for personal backups.

## Decided

- Static frontend + Supabase.
- Open source with a self-host guide.
- Export of all data is a must-have.

## Open questions to grill

1. **Typewriter UI vs fast capture.** Does the skeuomorphic UI slow down capture? Possible split: plain, instant capture screen; typewriter treatment in the reading/archive view.
2. **The bedtime moment.** PWA vs an iOS Shortcut (Action button / Back Tap) that records and posts straight to the backend. How fast must capture be?
3. **Raw vs cleaned transcripts.** Keep original audio plus a verbatim transcript? Is AI tidy-up an optional layer, or skipped entirely?
4. **Transcription provider.** Web Speech API (free, inconsistent, Safari sends audio to Apple) vs Whisper via API key (cost, setup friction for guide users) vs local model.
5. **Image storage.** GitHub repo was floated, but is likely a poor fit (binary bloat, privacy). Supabase Storage is the default candidate; Cloudflare R2 if it's outgrown. Compress client-side.
6. **Supabase free-tier inactivity pausing.** Verify current behaviour; a paused DB is a bad failure mode for an occasionally used journal.
7. **Privacy / encryption.** Client-side encryption (strong trust, harder search and AI features) or not? Decide early.
8. **Hosting.** Keep host-agnostic (Netlify, Vercel, Cloudflare Pages) so the choice isn't lock-in.
9. **Scope of v1.** Is this primarily a fun build or a journal he'll use daily? If the latter: capture + export first, aesthetics second.
10. **Export format.** Markdown + media zip as baseline. Stretch: typewriter-styled printable pages so digital entries can go in the same binder as the physical typed pages.

## Prior art (none match the full concept)

- Commercial: Day One, Apple Journal, Rosebud-style AI journals.
- Open source: Marée (local-first markdown, voice capture planned), Healthyself Journal (voice CLI, therapy-flavoured).
- Gap: analogue-feeling, voice-captured, own-your-data journal with a follow-along self-host guide.

## About Jonny

Front-end developer (~6 years), comfortable with Figma, motion, and the Vercel ecosystem. Prefers concise, structured communication and exact copy-paste terminal commands.

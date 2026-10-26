# RambleOn

A typewriter-style voice journal you host yourself. Open source.

Dictate a few minutes from bed, and it lands on today's typed page. Everything is encrypted on your device before it's uploaded, and you can export the whole journal at any time.

- **Plan and decisions:** [docs/plan.md](docs/plan.md)
- **Set up your own copy:** [docs/setup.md](docs/setup.md)

## Repo layout

```
app/        the journal PWA (Vite + React + TypeScript + Tailwind)
supabase/   database schema (SQL migrations)
docs/       brief, plan and setup guide (Starlight site in M5)
```

## Development

```sh
cd app
npm install
npm run dev      # demo mode unless .env.local has Supabase settings
npm test         # unit tests (filler removal, crypto, sync, export round trip)
npm run lint
npm run build
```

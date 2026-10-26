-- RambleOn schema.
-- Everything the user writes is encrypted in the browser before it arrives
-- here: `ciphertext` columns are opaque. Only dates, times and versions are
-- readable, so pages can be sorted.

-- Wrapped (encrypted) copies of the master key. See app/src/lib/crypto.ts.
create table public.vaults (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  salt text not null,
  iterations integer not null,
  wrapped_by_passphrase text not null,
  wrapped_by_recovery text not null,
  created_at timestamptz not null default now()
);

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

-- Passages (prose) and margin notes (corrections added to locked days).
create table public.passages (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null default 'passage' check (kind in ('passage', 'margin')),
  journal_date date not null,
  written_at timestamptz not null,
  version integer not null default 1,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);
create index passages_user_date on public.passages (user_id, journal_date);

-- The notes area at the bottom of each day.
create table public.notes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  journal_date date not null,
  written_at timestamptz not null,
  version integer not null default 1,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);
create index notes_user_date on public.notes (user_id, journal_date);

-- Row-level security: each user can only see and change their own rows.
alter table public.vaults enable row level security;
alter table public.settings enable row level security;
alter table public.passages enable row level security;
alter table public.notes enable row level security;

create policy "own vault" on public.vaults for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own settings" on public.settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own passages" on public.passages for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own notes" on public.notes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Explicit grants. Since 30 Oct 2026 Supabase no longer exposes new tables to
-- the Data API automatically. Only signed-in users get access; anon gets none.
grant select, insert, update, delete on public.vaults, public.settings, public.passages, public.notes
  to authenticated;

-- Days that have something on them, for the Days list.
create function public.journal_days()
returns table (date date, passages bigint, notes bigint)
language sql stable security invoker set search_path = ''
as $$
  select d.journal_date,
         count(*) filter (where d.src = 'p'),
         count(*) filter (where d.src = 'n')
  from (
    select journal_date, 'p' as src from public.passages where kind = 'passage'
    union all
    select journal_date, 'n' from public.notes
  ) d
  group by d.journal_date
  order by d.journal_date desc
$$;
revoke execute on function public.journal_days() from public, anon;
grant execute on function public.journal_days() to authenticated;

-- Keep-alive: called every few days by .github/workflows/keepalive.yml so the
-- free-tier project is not paused for inactivity. Reads no user data.
create function public.ping()
returns timestamptz
language sql stable security invoker set search_path = ''
as $$ select now() $$;
grant execute on function public.ping() to anon, authenticated;

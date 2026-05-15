-- ─── TLC Booking App — Supabase Schema ────────────────────────────────────────
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ──────────────────────────────────────────────────────────────────────────────


-- ─── TABLE: leads ─────────────────────────────────────────────────────────────

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  phone       text not null,
  source      text default 'google_sheets',
  created_at  timestamptz not null default now()
);

-- Index for fast phone-number lookups (booking flow's primary query)
create index if not exists leads_phone_idx on public.leads (phone);

comment on table public.leads is 'Mortgage leads synced from Google Sheets via Apps Script.';


-- ─── TABLE: bookings ──────────────────────────────────────────────────────────

create table if not exists public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  lead_id             uuid not null references public.leads (id) on delete cascade,
  slot_start          timestamptz not null,
  slot_end            timestamptz not null,
  status              text not null default 'confirmed'
                        check (status in ('confirmed', 'cancelled')),
  calendar_event_id   text,                  -- Google Calendar event ID
  created_at          timestamptz not null default now()
);

-- Index for quickly finding bookings by lead
create index if not exists bookings_lead_id_idx on public.bookings (lead_id);

-- Index for slot conflict checks
create index if not exists bookings_slot_start_idx on public.bookings (slot_start);

comment on table public.bookings is 'Confirmed mortgage consultation bookings.';


-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- The app uses the service role key server-side only.
-- The anon key (client-side) should have NO direct table access.
-- All reads/writes go through API routes using supabaseAdmin.

alter table public.leads    enable row level security;
alter table public.bookings enable row level security;

-- No policies = anon key cannot read or write anything directly.
-- Service role key bypasses RLS entirely (correct for server-side use).


-- ─── DONE ─────────────────────────────────────────────────────────────────────
-- After running this, verify:
--   select count(*) from public.leads;
--   select count(*) from public.bookings;

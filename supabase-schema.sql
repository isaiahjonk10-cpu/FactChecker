-- Run this once in your Supabase project's SQL Editor (Supabase dashboard →
-- SQL Editor → New query → paste this → Run).
--
-- This version ties usage to real authenticated accounts (Supabase Auth's
-- built-in `auth.users` table) instead of a client-supplied device ID. A
-- client-supplied ID can never be trusted — anyone can just send a made-up
-- one. A verified login session can be.

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'max', 'party')),
  created_at timestamptz not null default now()
);

create table if not exists usage_monthly (
  user_id uuid not null references profiles(user_id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  debate_seconds numeric not null default 0,
  video_seconds numeric not null default 0,
  debate_count int not null default 0,
  primary key (user_id, month)
);

-- Row Level Security: only the server (using the service role key) can read
-- or write these tables. The browser never talks to these tables directly —
-- it only ever talks to your /api routes, which verify the user's login
-- session before touching anything here.
alter table profiles enable row level security;
alter table usage_monthly enable row level security;

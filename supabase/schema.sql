-- Rode este SQL no editor do Supabase antes do deploy.
-- A chave service_role fica só nas variáveis da Vercel.
-- Com RLS ligado e sem política pública, o navegador não lê estas tabelas.

create extension if not exists pgcrypto;

create table if not exists leads (
  id uuid primary key,
  name text not null,
  whatsapp text not null unique,
  session_id text,
  watched_seconds numeric not null default 0,
  max_seconds numeric not null default 0,
  duration_seconds numeric,
  percent numeric not null default 0,
  checkout_clicked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads (id) on delete set null,
  session_id text,
  type text not null,
  video_time numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists eventos_lead_id_idx on eventos (lead_id);
create index if not exists eventos_session_id_idx on eventos (session_id);

alter table leads enable row level security;
alter table eventos enable row level security;

-- Recuperação: quem assistiu e ainda não clicou no checkout.
-- select name, whatsapp, percent, watched_seconds, max_seconds, created_at
-- from leads
-- where checkout_clicked_at is null
-- order by percent desc;

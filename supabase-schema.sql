-- ============================================================
-- SHYEN Supabase schema — run this in Supabase SQL Editor
-- ============================================================

create table if not exists incidents (
  id                 text primary key,
  type               text not null,
  severity           text not null,
  status             text not null default 'DETECTED',
  victim_name        text,
  victim_asn         text,
  attacker_asn       text,
  attacker_country   text,
  prefix             text,
  confidence         int,
  is_demo            boolean not null default false,
  payload            jsonb not null,
  detected_at        timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_incidents_detected_at on incidents (detected_at desc);
create index if not exists idx_incidents_severity on incidents (severity);
create index if not exists idx_incidents_status on incidents (status);

create table if not exists change_log (
  id           bigint generated always as identity primary key,
  incident_id  text references incidents(id) on delete set null,
  entry_type   text not null,
  label        text not null,
  payload      jsonb not null,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_changelog_created_at on change_log (created_at desc);
create index if not exists idx_changelog_incident on change_log (incident_id);

create table if not exists chat_messages (
  id           bigint generated always as identity primary key,
  session_id   text not null default 'default',
  role         text not null,
  content      text not null,
  payload      jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists idx_chat_session on chat_messages (session_id, created_at);

create table if not exists activity_log (
  id           bigint generated always as identity primary key,
  level        text not null,
  message      text not null,
  incident_id  text references incidents(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_activitylog_created_at on activity_log (created_at desc);

alter table incidents enable row level security;
alter table change_log enable row level security;
alter table chat_messages enable row level security;
alter table activity_log enable row level security;

create policy "anon full access" on incidents for all using (true) with check (true);
create policy "anon full access" on change_log for all using (true) with check (true);
create policy "anon full access" on chat_messages for all using (true) with check (true);
create policy "anon full access" on activity_log for all using (true) with check (true);

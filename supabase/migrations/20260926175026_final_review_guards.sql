-- Runtime diagnostics are reported by the trusted worker; admin edits use a strict API allowlist.
alter table public.voice_settings add column if not exists worker_seen_at timestamptz;
alter table public.voice_settings add column if not exists media_ready boolean not null default false;
alter table public.voice_settings add column if not exists last_error text;
alter table public.voice_members add column if not exists muted_by_owner boolean not null default false;

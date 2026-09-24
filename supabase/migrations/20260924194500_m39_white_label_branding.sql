alter table public.site_appearance
  add column if not exists secondary_hex text not null default '#00A3FF' check (secondary_hex ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists background_hex text not null default '#02060C' check (background_hex ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists surface_hex text not null default '#07101D' check (surface_hex ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists text_hex text not null default '#F5F8FF' check (text_hex ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists white_label_enabled boolean not null default false,
  add column if not exists show_powered_by boolean not null default true,
  add column if not exists brand_name text not null default 'CRAZZY PROJECT',
  add column if not exists tagline text not null default 'QUEM NAO XITA NAO BRILHA',
  add column if not exists logo_hero_url text not null default '/brand/crazzy-logo-hero.png',
  add column if not exists logo_navbar_url text not null default '/brand/crazzy-logo-navbar.png',
  add column if not exists favicon_url text not null default '/favicon.ico',
  add column if not exists site_wallpaper_url text not null default '',
  add column if not exists hero_cover_url text not null default '/backgrounds/hero-tokyo.webp',
  add column if not exists discord_invite_cover_url text not null default '';

comment on column public.site_appearance.white_label_enabled is
  'Allows storefront branding to be replaced without changing admin authorization.';

comment on column public.site_appearance.discord_invite_cover_url is
  'Optional visual cover used by the Discord guild gate.';

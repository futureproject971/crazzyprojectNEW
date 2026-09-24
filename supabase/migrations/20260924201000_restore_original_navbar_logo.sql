alter table public.site_appearance
  alter column logo_navbar_url set default '/brand/crazzy-logo-hero.png';

update public.site_appearance
set logo_navbar_url = '/brand/crazzy-logo-hero.png',
    updated_at = now()
where id = 'default'
  and white_label_enabled = false
  and logo_navbar_url = '/brand/crazzy-logo-navbar.png';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-branding',
  'site-branding',
  true,
  10485760,
  array['image/png','image/jpeg','image/webp','image/gif','image/x-icon','image/vnd.microsoft.icon']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins upload site branding" on storage.objects;
create policy "Admins upload site branding"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'site-branding'
  and private.has_role((select auth.uid()), 'admin'::public.app_role)
);

drop policy if exists "Admins update site branding" on storage.objects;
create policy "Admins update site branding"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'site-branding'
  and private.has_role((select auth.uid()), 'admin'::public.app_role)
)
with check (
  bucket_id = 'site-branding'
  and private.has_role((select auth.uid()), 'admin'::public.app_role)
);

drop policy if exists "Admins delete site branding" on storage.objects;
create policy "Admins delete site branding"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'site-branding'
  and private.has_role((select auth.uid()), 'admin'::public.app_role)
);

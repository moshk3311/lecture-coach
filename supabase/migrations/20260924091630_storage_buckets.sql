-- Private storage buckets (ARCHITECTURE §6). Every object lives under {user_id}/...
-- Free plan caps a single upload at 50 MB.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('recordings', 'recordings', false, 52428800,
    array['audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/mp4']),
  ('reference-audio', 'reference-audio', false, 5242880,
    array['audio/mpeg', 'audio/wav', 'audio/x-wav']),
  ('pptx', 'pptx', false, 52428800,
    array['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/pdf']),
  ('slides', 'slides', false, 10485760,
    array['image/png', 'image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "app buckets: read own folder" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('recordings', 'reference-audio', 'pptx', 'slides')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "app buckets: insert into own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('recordings', 'reference-audio', 'pptx', 'slides')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "app buckets: update own folder" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('recordings', 'reference-audio', 'pptx', 'slides')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('recordings', 'reference-audio', 'pptx', 'slides')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "app buckets: delete own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('recordings', 'reference-audio', 'pptx', 'slides')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

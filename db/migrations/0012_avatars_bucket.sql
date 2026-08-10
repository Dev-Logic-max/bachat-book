-- 0012_avatars_bucket.sql
--
-- Storage for profile pictures. profiles.avatar_url has existed since M1 and was
-- never written to — there was not one storage.from() call in the app.
--
-- THE RULE THAT MATTERS: write access is scoped by PATH PREFIX to auth.uid().
-- A bucket that is merely "authenticated write" lets any signed-in user overwrite
-- any other user's avatar, because the object name is the only thing separating
-- them. Files live at `<uid>/<filename>`.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,                                    -- public READ; writes are still policed
  2097152,                                 -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_public_read"   on storage.objects;
drop policy if exists "avatars_owner_insert"  on storage.objects;
drop policy if exists "avatars_owner_update"  on storage.objects;
drop policy if exists "avatars_owner_delete"  on storage.objects;

-- Public read: an <img src> carries no Authorization header.
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- storage.foldername(name) splits the object path; [1] is the first segment, which
-- must equal the caller's uid. This is the whole isolation guarantee.
create policy "avatars_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;

notify pgrst, 'reload schema';

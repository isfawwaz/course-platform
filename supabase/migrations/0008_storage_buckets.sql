-- 0008_storage_buckets: private/public buckets for light assets (RFC-001/003).
-- Video source/HLS live in R2, NOT here. All writes + private reads go through the
-- server (service role); private buckets therefore need no client object policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('org-assets',   'org-assets',   true,  5242880,  array['image/png','image/jpeg','image/svg+xml','image/webp']),
  ('thumbnails',   'thumbnails',   false, 5242880,  array['image/png','image/jpeg','image/webp']),
  ('certificates', 'certificates', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- seed.sql: data seed (not a schema migration). Safe to re-run.

-- First client / use case: the nail art studio.
insert into public.orgs (name, slug, theme_accent, locale)
values ('Nail Art Academy','nail-art-academy','#E11D48','id')
on conflict (slug) do nothing;

-- After the people below sign up through the app (which creates auth.users + a profiles
-- row via the handle_new_user trigger), run these from the SQL editor / service role:
--
--   -- make yourself (Fawwaz) the platform admin:
--   select app.set_platform_admin('isfawwaz@gmail.com');
--
--   -- attach the studio owner to the org as owner:
--   select app.add_member('OWNER_EMAIL@example.com', 'nail-art-academy', 'owner');
--
-- add_member also works for 'admin' / 'student' roles.

-- Supabase public launch migration for Levain Lab.
-- Run this after the original auth setup has already been applied.
-- Existing auth_allowlist rows become role overrides:
-- - admin stays admin
-- - missing/null roles default to user
-- - the old login-restriction hook becomes permissive

insert into public.auth_allowlist (email, role)
values ('ehdrhquf88@gmail.com', 'admin')
on conflict (email) do update
set role = excluded.role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowlist_role public.app_role;
begin
  select role
  into allowlist_role
  from public.auth_allowlist
  where lower(email) = lower(new.email);

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    coalesce(allowlist_role, 'user'::public.app_role)
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    role = excluded.role;

  return new;
end;
$$;

revoke execute
  on function public.handle_new_user
  from authenticated, anon, public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update on auth.users
for each row execute function public.handle_new_user();

create or replace function public.sync_profile_role_from_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.profiles
    set role = 'user'::public.app_role
    where lower(email) = lower(old.email);

    return old;
  end if;

  if tg_op = 'UPDATE' and lower(old.email) <> lower(new.email) then
    update public.profiles
    set role = 'user'::public.app_role
    where lower(email) = lower(old.email);
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  select
    users.id,
    users.email,
    coalesce(users.raw_user_meta_data ->> 'full_name', users.raw_user_meta_data ->> 'name'),
    coalesce(users.raw_user_meta_data ->> 'avatar_url', users.raw_user_meta_data ->> 'picture'),
    coalesce(new.role, 'user'::public.app_role)
  from auth.users
  where lower(users.email) = lower(new.email)
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    role = excluded.role;

  return new;
end;
$$;

revoke execute
  on function public.sync_profile_role_from_allowlist
  from authenticated, anon, public;

drop trigger if exists on_auth_allowlist_role_changed on public.auth_allowlist;
create trigger on_auth_allowlist_role_changed
after insert or update or delete on public.auth_allowlist
for each row execute function public.sync_profile_role_from_allowlist();

create or replace function public.hook_restrict_login_to_allowlist(event jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return '{}'::jsonb;
end;
$$;

grant execute
  on function public.hook_restrict_login_to_allowlist
  to supabase_auth_admin;

revoke execute
  on function public.hook_restrict_login_to_allowlist
  from authenticated, anon, public;

insert into public.profiles (id, email, full_name, avatar_url, role)
select
  users.id,
  users.email,
  coalesce(users.raw_user_meta_data ->> 'full_name', users.raw_user_meta_data ->> 'name'),
  coalesce(users.raw_user_meta_data ->> 'avatar_url', users.raw_user_meta_data ->> 'picture'),
  coalesce(allowlist.role, 'user'::public.app_role)
from auth.users
left join public.auth_allowlist as allowlist
  on lower(allowlist.email) = lower(users.email)
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  avatar_url = excluded.avatar_url,
  role = excluded.role;

update public.profiles
set role = 'user'::public.app_role
where role is null;

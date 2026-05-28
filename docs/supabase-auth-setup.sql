-- Supabase Auth setup for Levain Lab.
-- Run this in Supabase SQL Editor, then configure Authentication > Hooks.
-- References:
-- - https://supabase.com/docs/guides/auth/social-login/auth-google
-- - https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
-- - https://supabase.com/docs/guides/auth/managing-user-data
-- - https://supabase.com/docs/guides/database/postgres/row-level-security

do $$
begin
  create type public.app_role as enum ('admin', 'user');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.auth_allowlist (
  email text primary key,
  role public.app_role null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text null,
  avatar_url text null,
  role public.app_role null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  user_id uuid not null references auth.users(id) on delete cascade,
  id bigint not null,
  recipe_data jsonb not null,
  is_public boolean not null default false,
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.cost_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  id bigint not null,
  item_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.temp_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  id bigint not null,
  log_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.auth_allowlist enable row level security;
alter table public.profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.cost_items enable row level security;
alter table public.temp_logs enable row level security;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant usage on schema public to supabase_auth_admin;

grant select on public.auth_allowlist to supabase_auth_admin;
revoke all on public.auth_allowlist from anon, authenticated;
grant select, insert, update, delete on public.auth_allowlist to authenticated;

revoke all on public.profiles from anon;
grant select, update on public.profiles to authenticated;

revoke all on public.recipes from anon;
grant select, insert, update, delete on public.recipes to authenticated;

revoke all on public.cost_items from anon;
grant select, insert, update, delete on public.cost_items to authenticated;

revoke all on public.temp_logs from anon;
grant select, insert, update, delete on public.temp_logs to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'::public.app_role
  );
$$;

revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

create or replace function private.has_app_access()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('admin'::public.app_role, 'user'::public.app_role)
  );
$$;

revoke all on function private.has_app_access() from public, anon, authenticated;
grant execute on function private.has_app_access() to authenticated;

create or replace function private.prevent_last_admin_role_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_count integer;
  target_profile_is_admin boolean;
begin
  if tg_table_schema = 'public' and tg_table_name = 'profiles' then
    if tg_op = 'UPDATE'
      and old.role = 'admin'::public.app_role
      and coalesce(new.role::text, '') <> 'admin'
    then
      select count(*)
      into admin_count
      from public.profiles
      where role = 'admin'::public.app_role;

      if admin_count <= 1 then
        raise exception 'At least one admin profile must remain.';
      end if;
    end if;

    return new;
  end if;

  if tg_table_schema = 'public' and tg_table_name = 'auth_allowlist' then
    if (
      tg_op = 'DELETE'
      and old.role = 'admin'::public.app_role
    ) or (
      tg_op = 'UPDATE'
      and old.role = 'admin'::public.app_role
      and coalesce(new.role::text, '') <> 'admin'
    ) then
      select count(*)
      into admin_count
      from public.profiles
      where role = 'admin'::public.app_role;

      select exists (
        select 1
        from public.profiles
        where lower(email) = lower(old.email)
          and role = 'admin'::public.app_role
      )
      into target_profile_is_admin;

      if target_profile_is_admin and admin_count <= 1 then
        raise exception 'At least one admin profile must remain.';
      end if;
    end if;

    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  return new;
end;
$$;

revoke execute
  on function private.prevent_last_admin_role_removal
  from authenticated, anon, public;

drop trigger if exists on_profiles_prevent_last_admin_removal on public.profiles;
create trigger on_profiles_prevent_last_admin_removal
before update on public.profiles
for each row execute function private.prevent_last_admin_role_removal();

drop trigger if exists on_auth_allowlist_prevent_last_admin_removal on public.auth_allowlist;
create trigger on_auth_allowlist_prevent_last_admin_removal
before update or delete on public.auth_allowlist
for each row execute function private.prevent_last_admin_role_removal();

drop policy if exists "Supabase Auth can read the login allowlist" on public.auth_allowlist;
create policy "Supabase Auth can read the login allowlist"
on public.auth_allowlist
for select
to supabase_auth_admin
using (true);

drop policy if exists "Admins can view the login allowlist" on public.auth_allowlist;
create policy "Admins can view the login allowlist"
on public.auth_allowlist
for select
to authenticated
using ((select private.is_admin()));

drop policy if exists "Admins can insert the login allowlist" on public.auth_allowlist;
create policy "Admins can insert the login allowlist"
on public.auth_allowlist
for insert
to authenticated
with check ((select private.is_admin()));

drop policy if exists "Admins can update the login allowlist" on public.auth_allowlist;
create policy "Admins can update the login allowlist"
on public.auth_allowlist
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins can delete the login allowlist" on public.auth_allowlist;
create policy "Admins can delete the login allowlist"
on public.auth_allowlist
for delete
to authenticated
using ((select private.is_admin()));

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
  and (select private.has_app_access())
);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
on public.profiles
for select
to authenticated
using ((select private.is_admin()));

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
on public.profiles
for update
to authenticated
using ((select private.is_admin()))
with check (true);

drop policy if exists "Users can view their own recipes" on public.recipes;
create policy "Users can view their own recipes"
on public.recipes
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.has_app_access())
);

drop policy if exists "Users can view public community recipes" on public.recipes;
create policy "Users can view public community recipes"
on public.recipes
for select
to authenticated
using (
  is_public = true
  and (select private.has_app_access())
);

drop policy if exists "Users can insert their own recipes" on public.recipes;
create policy "Users can insert their own recipes"
on public.recipes
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.has_app_access())
);

drop policy if exists "Users can update their own recipes" on public.recipes;
create policy "Users can update their own recipes"
on public.recipes
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.has_app_access())
)
with check (
  user_id = (select auth.uid())
  and (select private.has_app_access())
);

drop policy if exists "Users can delete their own recipes" on public.recipes;
create policy "Users can delete their own recipes"
on public.recipes
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.has_app_access())
);

drop policy if exists "Users can view their own cost items" on public.cost_items;
create policy "Users can view their own cost items"
on public.cost_items
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.has_app_access())
);

drop policy if exists "Users can insert their own cost items" on public.cost_items;
create policy "Users can insert their own cost items"
on public.cost_items
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.has_app_access())
);

drop policy if exists "Users can update their own cost items" on public.cost_items;
create policy "Users can update their own cost items"
on public.cost_items
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.has_app_access())
)
with check (
  user_id = (select auth.uid())
  and (select private.has_app_access())
);

drop policy if exists "Users can delete their own cost items" on public.cost_items;
create policy "Users can delete their own cost items"
on public.cost_items
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.has_app_access())
);

drop policy if exists "Users can view their own temp logs" on public.temp_logs;
create policy "Users can view their own temp logs"
on public.temp_logs
for select
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.has_app_access())
);

drop policy if exists "Users can insert their own temp logs" on public.temp_logs;
create policy "Users can insert their own temp logs"
on public.temp_logs
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.has_app_access())
);

drop policy if exists "Users can update their own temp logs" on public.temp_logs;
create policy "Users can update their own temp logs"
on public.temp_logs
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.has_app_access())
)
with check (
  user_id = (select auth.uid())
  and (select private.has_app_access())
);

drop policy if exists "Users can delete their own temp logs" on public.temp_logs;
create policy "Users can delete their own temp logs"
on public.temp_logs
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.has_app_access())
);

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
    allowlist_role
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
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.handle_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute
  on function public.handle_profile_updated_at
  from authenticated, anon, public;

drop trigger if exists on_profile_updated on public.profiles;
create trigger on_profile_updated
before update on public.profiles
for each row execute function public.handle_profile_updated_at();

drop trigger if exists on_recipe_updated on public.recipes;
create trigger on_recipe_updated
before update on public.recipes
for each row execute function public.handle_profile_updated_at();

drop trigger if exists on_cost_item_updated on public.cost_items;
create trigger on_cost_item_updated
before update on public.cost_items
for each row execute function public.handle_profile_updated_at();

drop trigger if exists on_temp_log_updated on public.temp_logs;
create trigger on_temp_log_updated
before update on public.temp_logs
for each row execute function public.handle_profile_updated_at();

create or replace function public.sync_profile_role_from_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.profiles
    set role = null
    where lower(email) = lower(old.email);

    return old;
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  select
    users.id,
    users.email,
    coalesce(users.raw_user_meta_data ->> 'full_name', users.raw_user_meta_data ->> 'name'),
    coalesce(users.raw_user_meta_data ->> 'avatar_url', users.raw_user_meta_data ->> 'picture'),
    new.role
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
declare
  user_email text;
  is_allowed boolean;
begin
  user_email := lower(event -> 'user' ->> 'email');

  select exists (
    select 1
    from public.auth_allowlist
    where lower(email) = user_email
  )
  into is_allowed;

  if is_allowed then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'message', '초대된 사람만 로그인 가능합니다',
      'http_code', 403
    )
  );
end;
$$;

grant execute
  on function public.hook_restrict_login_to_allowlist
  to supabase_auth_admin;

revoke execute
  on function public.hook_restrict_login_to_allowlist
  from authenticated, anon, public;

-- Backfill existing Auth users and keep profile roles aligned with the current allowlist.
insert into public.profiles (id, email, full_name, avatar_url, role)
select
  users.id,
  users.email,
  coalesce(users.raw_user_meta_data ->> 'full_name', users.raw_user_meta_data ->> 'name'),
  coalesce(users.raw_user_meta_data ->> 'avatar_url', users.raw_user_meta_data ->> 'picture'),
  allowlist.role
from auth.users
left join public.auth_allowlist as allowlist
  on lower(allowlist.email) = lower(users.email)
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  avatar_url = excluded.avatar_url,
  role = excluded.role;

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

alter table public.auth_allowlist enable row level security;

drop policy if exists "Supabase Auth can read the login allowlist" on public.auth_allowlist;
create policy "Supabase Auth can read the login allowlist"
on public.auth_allowlist
for select
to supabase_auth_admin
using (true);

grant select on public.auth_allowlist to supabase_auth_admin;
revoke all on public.auth_allowlist from anon, authenticated;

insert into public.auth_allowlist (email, role)
values ('ehdrhquf88@gmail.com', 'admin')
on conflict (email) do update
set role = excluded.role;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text null,
  avatar_url text null,
  role public.app_role null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
security definer
set search_path = public
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

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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
  );

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

create or replace function public.hook_restrict_login_to_allowlist(event jsonb)
returns jsonb
language plpgsql
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

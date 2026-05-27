# Supabase Auth Setup

This app uses Supabase Google OAuth for login. Keep recipe, cost, and temp/pH data in localStorage for now.

Official Supabase references:

- Google login: https://supabase.com/docs/guides/auth/social-login/auth-google
- Auth Hooks: https://supabase.com/docs/guides/auth/auth-hooks
- Before User Created Hook: https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook
- User profiles: https://supabase.com/docs/guides/auth/managing-user-data
- Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security

## Dashboard Steps

1. Create or open a Supabase project.
2. In Google Cloud Console, create an OAuth client for this app.
3. In Supabase, go to `Authentication > Providers > Google` and enable Google.
4. Add Supabase's callback URL to Google OAuth redirect URIs:
   `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
5. Run [supabase-auth-setup.sql](/Users/hayoungkim/levain-lab/bakery-app/docs/supabase-auth-setup.sql) in Supabase SQL Editor.
6. In `Authentication > Hooks`, configure a SQL hook:
   - Hook: `Before User Created`
   - Type: `Postgres`
   - Schema: `public`
   - Function: `hook_restrict_login_to_allowlist`
7. Add local env values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```
8. In `Project Settings > API > Data API`, expose only the tables the app needs:
   - `public.profiles`
   - `public.auth_allowlist`

Keep `Automatically expose new tables` disabled. Both exposed tables must keep RLS enabled.

## Roles

`public.profiles.role` uses the enum `public.app_role`:

- `admin`
- `user`
- `null`

Use Supabase Table Editor or SQL to change a user's role after the user has signed in once and the profile row exists. The initial role comes from `public.auth_allowlist.role`.

The Auth Hook allows only emails in `public.auth_allowlist` to create an account. The app also keeps a secondary gate: only `admin` and `user` roles can enter the product UI. A `null` role is treated as not invited and the app signs the session out with `초대된 사람만 로그인 가능합니다`.

## Allowlist

Only emails in `public.auth_allowlist` can create an account. Add a user:

```sql
insert into public.auth_allowlist (email, role)
values ('newuser@example.com', 'user')
on conflict (email) do update
set role = excluded.role;
```

Remove a user:

```sql
delete from public.auth_allowlist
where email = 'newuser@example.com';
```

The `Before User Created` hook blocks new unauthorized accounts before they are created. If an unauthorized account already exists from before the hook was enabled, remove or disable it in `Authentication > Users`.

Admins can also manage `public.auth_allowlist` from the app's Admin page. The table is safe to expose through the Data API only with the admin-only RLS policies from [supabase-auth-setup.sql](/Users/hayoungkim/levain-lab/bakery-app/docs/supabase-auth-setup.sql).

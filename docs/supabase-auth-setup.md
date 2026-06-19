# Supabase Auth Setup

This app uses Supabase Google OAuth for login. Recipes, cost items, temp/pH logs, and announcements are stored in Supabase. Recipe images are stored in Cloudflare R2 through server-side API routes.

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
5. In Supabase `Authentication > URL Configuration`, set the production site URL and add any local/deployment redirect URLs you use.
6. Run [supabase-auth-setup.sql](/Users/hayoungkim/levain-lab/bakery-app/docs/supabase-auth-setup.sql) in Supabase SQL Editor.
7. In `Authentication > Hooks`, configure a SQL hook:
   - Hook: `Before User Created`
   - Type: `Postgres`
   - Schema: `public`
   - Function: `hook_restrict_login_to_allowlist`
8. Add env values:

```env
# Supabase browser client
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY

# Cloudflare R2 server-only values
R2_ACCOUNT_ID=YOUR_CLOUDFLARE_ACCOUNT_ID
R2_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=YOUR_R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME=YOUR_R2_BUCKET_NAME
```
9. In `Project Settings > API > Data API`, expose only the tables the app needs:
   - `public.profiles`
   - `public.auth_allowlist`
   - `public.recipes`
   - `public.cost_items`
   - `public.temp_logs`
   - `public.announcements`
   - `public.announcement_reads`

Keep `Automatically expose new tables` disabled. All exposed tables must keep RLS enabled.

## Roles

`public.profiles.role` uses the enum `public.app_role`:

- `admin`
- `user`
- `null`

Use Supabase Table Editor or SQL to change a user's role after the user has signed in once and the profile row exists. The initial role comes from `public.auth_allowlist.role`.

The Auth Hook allows only emails in `public.auth_allowlist` to create an account. The app also keeps a secondary gate: only `admin` and `user` roles can enter the product UI. A `null` role is treated as not invited and the app signs the session out with `초대된 사람만 로그인 가능합니다`.

The profile RLS policy also requires `admin` or `user` access before a user can read their own profile through the Data API. This keeps previously-created users with a `null` role from reading app profile data after they are removed from the allowlist.

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

The SQL setup prevents removing or demoting the last existing admin profile. Create another admin first before changing the final admin to `user` or `null`.

## Recipes

`public.recipes` stores each user's recipe DB rows in Supabase:

- `user_id`: the Supabase Auth user id
- `id`: the app's numeric recipe id
- `recipe_data`: the full recipe object used by the app
- `is_public` and `published_at`: legacy publishing fields kept for compatibility while community sharing is disabled

RLS allows authenticated `admin` or `user` profiles to select, insert, update, and delete only rows where `user_id = auth.uid()`. Existing browser-local recipes are uploaded to Supabase the first time a user opens the app and no remote recipes exist yet.

## Cost Items

`public.cost_items` stores each user's material cost DB rows in Supabase:

- `user_id`: the Supabase Auth user id
- `id`: the app's numeric cost item id
- `item_data`: the full cost item object used by the app

RLS allows authenticated `admin` or `user` profiles to select, insert, update, and delete only rows where `user_id = auth.uid()`. Existing browser-local cost items are uploaded to Supabase the first time a user opens the app and no remote cost items exist yet.

## Temp/pH Logs

`public.temp_logs` stores each user's fermentation temperature and pH history in Supabase:

- `user_id`: the Supabase Auth user id
- `id`: the app's numeric log id
- `log_data`: the full temp/pH log object used by the app

RLS allows authenticated `admin` or `user` profiles to select, insert, update, and delete only rows where `user_id = auth.uid()`. Existing browser-local temp/pH logs are uploaded to Supabase the first time a user opens the app and no remote temp/pH logs exist yet.

## Community And Announcements

The community feature is currently disabled. `public.community_bookmarks`, `public.community_saves`, and the community RPC helpers are kept in the schema for compatibility, but authenticated users are not granted access to them.

If the community feature is enabled again later, restore the relevant Data API exposure, RLS policies, and RPC execute grants deliberately.

`public.announcements` stores active admin announcements. `public.announcement_reads` stores each user's read state.

RLS keeps announcement writes tied to admins and read state tied to the authenticated user, while admin-only policies control allowlist/profile administration and announcement management.

## Cloudflare R2

Recipe images are uploaded, copied, read, and deleted through authenticated server routes. Keep the bucket private and store R2 credentials only as server-side environment variables.

The app expects:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

Use an R2 access key scoped to the target bucket with only the object permissions the app needs. Do not put R2 secrets in `NEXT_PUBLIC_*` variables.

## Security Hardening

- Keep `private` out of Data API exposed schemas.
- Keep `Automatically expose new tables` disabled.
- Do not put a Supabase service role key in `NEXT_PUBLIC_*` variables or browser code.
- Do not put Cloudflare R2 secrets in `NEXT_PUBLIC_*` variables or browser code.
- Security definer functions use an empty `search_path` and fully-qualified table names.
- Keep community RPC execute grants revoked while the community feature is disabled.
- Enable leaked password protection in Supabase Auth settings to clear the dashboard security warning.
- If you remove an existing user from the allowlist, also remove or disable the user in `Authentication > Users` when you want to block the Supabase Auth account itself, not only app/API access.

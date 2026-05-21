# Service Worker Cache Issue

## Symptom

After pushing changes to the `dev` branch, the app still did not appear correctly in the browser even though the project built successfully.

## Cause

The app registers a service worker from `public/sw.js`.

That service worker was using a fixed cache name:

```js
const CACHE_NAME = "bakery-app-v1";
```

Because the cache version did not change, some browsers could keep serving old cached app files after a new deploy. This can make it look like the pushed code is not working, even when the deploy itself is fine.

## Fix

The cache name was changed to a new version and old app caches are removed on activation:

```js
const CACHE_PREFIX = "bakery-app-";
const CACHE_NAME = `${CACHE_PREFIX}v2`;
```

```js
keys
  .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
  .map((key) => caches.delete(key))
```

## What To Check Next Time

If the app does not update after a push:

1. Check whether `npm run build` succeeds.
2. Check the browser console for runtime errors.
3. Check whether `public/sw.js` cache version needs to be bumped.
4. Refresh the page, or press the in-app update banner if it appears.
5. If needed, unregister the service worker from browser DevTools and reload.


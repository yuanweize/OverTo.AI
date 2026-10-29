# Site settings

Status: implemented in the local account environment; production account setup is not complete.

Run local migrations, register and verify the intended operator account, then run:

```sh
npx tsx scripts/bootstrap-admin.ts operator@example.com
```

The CLI only accepts the dedicated local database. It refuses to create a second root. It assigns an existing verified account; no public endpoint can claim the role. Sign in with that account and open `/admin`.

The form edits the site name, Czech/English descriptions, local logo path, contrasting primary color, language/theme defaults, contact, support URL and announcements. It accepts plain text, not HTML or JavaScript. The logo must be a safe filename under `/public/brand`; no server fetch of an arbitrary URL occurs.

Every save checks verified platform-admin authorization, validates the full public schema, locks the settings row, checks the expected version, writes the new values and writes an audit entry in one transaction. A concurrent stale edit returns 409. Loading a previous version only fills the form; saving it creates a new audited version. Request-scoped caching means the next server request sees committed changes without an in-process invalidation mechanism.

`GET /api/site` returns only public configuration and its version, with `Cache-Control: no-store`. It never includes authentication, database, AI or Stripe secrets. `PUT /api/admin/site` requires the administrator session and canonical origin. Configuration is not a secret store.

Theme and language preferences use HttpOnly SameSite cookies. Set `OVERTO_PUBLIC_URL` to the canonical public origin behind a proxy; the local environment uses `BETTER_AUTH_URL`. Forwarded host headers do not authorize preference writes.

Not implemented here: production setup wizard, provider secrets, registration/maintenance controls, pricing, user administration, or organization roles. Do not expose the local account experiment as a production service.

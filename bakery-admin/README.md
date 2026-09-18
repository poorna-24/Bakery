# bakery-admin

The owner's dashboard. Everything on the customer menu is created, edited and deleted here.

Password-protected, never linked from the public site, and marked `noindex`. Keep this repo
**private** — it holds the shape of the login, and its `.env.local` holds the password.

> Its sibling repo is **bakery-customer**, the public menu. Both must point at the same
> `DATABASE_URL` and the same `BAKERY_DATA_DIR`.

## First run

```bash
npm install
npm run db:push      # creates ../data/bakery.db from the schema
npm run db:seed      # optional: 8 starter categories, 23 sample items, no photos
npm run dev          # http://localhost:3001
```

Sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env.local` (out of the box:
`owner@bakery.com` / `bakery123` — change these).

## Configuration

`.env.local`:

| Variable | What it does |
|---|---|
| `DATABASE_URL` | The shared database. Must match bakery-customer. |
| `BAKERY_DATA_DIR` | Folder holding `bakery.db` and `uploads/`. Must match bakery-customer. |
| `ADMIN_EMAIL` | The only account that can sign in. |
| `ADMIN_PASSWORD` | Plain text — development only. |
| `ADMIN_PASSWORD_HASH` | A bcrypt hash. Set this instead of the above before going live. |
| `SESSION_SECRET` | Signs the login cookie. Long and random. Changing it logs everyone out. |
| `CUSTOMER_APP_URL` | Where the Preview tab points. |

`DATABASE_URL` also has to be in `.env` — the Prisma CLI does not read `.env.local`.

### Before going live

1. Generate a hash and put it in `ADMIN_PASSWORD_HASH`, then delete `ADMIN_PASSWORD`:
   ```bash
   node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" "your-new-password"
   ```
2. Replace `SESSION_SECRET` with something long and random:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
3. Serve it over HTTPS. The session cookie is marked `secure` in production and a browser will
   refuse to store it over plain HTTP, which means the login silently fails.

## What the owner can do

- **Categories** — create, rename, describe, reorder, hide, delete. Deleting one asks whether to
  move its items elsewhere or delete them too.
- **Items** — create, edit, delete, reorder, and flip Available / Sold out in one click. A sold-out
  item stays on the menu, greyed, so customers know it exists.
- **Photos** — JPG / PNG / WebP / AVIF up to 5 MB. Stored under `BAKERY_DATA_DIR/uploads` with a
  random name. Replacing or deleting a photo removes the old file from disk.
- **Sizes** — optional per-item variants ("500 g ₹450", "1 kg ₹850"). Add them and the menu shows a
  price range instead of the single price.
- **Preview** — the live customer page in a phone-sized frame.

A category with no items never appears on the customer menu, so a half-finished category is not
visible to anyone.

## How it is built

- `middleware.ts` guards every route. It runs on the Edge runtime, so the JWT check is inlined
  rather than imported from `lib/auth.ts` (bcryptjs is Node-only).
- `app/actions.ts` holds every mutation as a server action.
- `lib/saveImage.ts` writes uploads into the shared folder and cleans up orphans.
- `lib/db.ts`, `lib/types.ts` and `lib/storage.ts` are byte-identical to the copies in
  bakery-customer. Change one, copy it across.

## Behind a corporate proxy

If `prisma generate` fails with `unable to get local issuer certificate`, Node does not trust the
proxy's certificate. Point it at the system roots:

```bash
NODE_EXTRA_CA_CERTS="C:\Users\<you>\.node-ca\windows-root-ca.pem" npx prisma generate
```

# Running the bakery locally

One command brings up a Postgres database and the app that serves both the
customer menu and the owner's dashboard.

Nothing here touches Supabase, Cloudinary or Vercel — it is a self-contained
copy for local work.

| | Address |
|---|---|
| Customer menu | http://localhost:3000 |
| Owner's dashboard | http://localhost:3000/admin |
| Postgres | `localhost:5432`, user `bakery`, database `bakery` |

## First run

```bash
cp .env.example .env
```

Fill in `.env` — at minimum `POSTGRES_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
and `SESSION_SECRET`. The session secret must be at least 16 characters or the
app refuses to start.

Create the tables, then start:

```bash
npm run docker:setup
```

```bash
npm run docker
```

The database starts empty. Sign in to `/admin` and add a category, or load the
sample menu with `npm run docker:seed`.

## Day to day

| Command | What it does |
|---|---|
| `npm run docker` | start |
| `npm run docker:stop` | stop, keeping the database and photos |
| `npm run docker:rebuild` | rebuild the image, then start |
| `npm run docker:dev` | **hot reload** — edits refresh the browser |
| `npm run docker:logs` | follow the output |

`docker:stop` keeps your data — the database and uploaded photos live in named
volumes. To throw those away as well: `docker compose down -v`.

## Two modes

**`npm run docker`** runs a production build. It is what actually ships, so use
it when you want to check the real thing — but every code change needs
`npm run docker:rebuild`.

**`npm run docker:dev`** runs `next dev` against your working copy, so a saved
file refreshes the browser. Use it while building. It still points at the local
throwaway database, so experimenting cannot touch the live menu.

Switching between the two rebuilds the image; that is expected.

## Without Docker

```bash
npm run dev
```

Same app on the same port — but this reads `DATABASE_URL` from `.env`, which
points at **production Supabase**. Changes you make there are live. Docker is
the safe sandbox; this is not.

> **Do not run `npm run build` while a dev server is running.** They share the
> same `.next` folder, and the production build replaces the dev server's
> chunks — the running site loses its CSS. Docker builds are safe, because they
> happen inside the container against a copy of the source.

## Things worth knowing

**One app, two audiences.** The menu is public at `/`; the dashboard sits behind
a login at `/admin`. `middleware.ts` matches `/admin/:path*` and nothing else —
widening that matcher would put the customer menu behind the login, which is the
one mistake here that matters.

**Shop details are runtime values.** Name, phone, address and the credit line
are read on the server and passed down as props, so editing them in `.env` needs
a restart, not a rebuild:

```bash
npm run docker
```

**Photos.** With `CLOUDINARY_URL` empty, uploads go to the `uploads` volume
mounted at `/data`, so a rebuild does not lose them. Set `CLOUDINARY_URL` and
they go to Cloudinary instead, as in production.

**Schema changes.** Edit `prisma/schema.prisma`, then re-run `npm run docker:setup`.

**Behind a corporate network.** If your network re-signs TLS with its own root
certificate, `prisma generate` cannot verify `binaries.prisma.sh` and the build
fails at `npm ci`. Point `EXTRA_CA_CERTS_FILE` in `.env` at that root
certificate; it is passed in as a build secret, trusted for the install step
only, and never written into the image. On an ordinary network, leave it unset.

## What is where

```
bakery/
  app/
    page.tsx              the menu
    admin/                the dashboard, behind the login
    api/v1/               the public JSON API
    uploads/[name]/       serves photos from the data folder
  components/             menu components
  components/admin/       dashboard components
  lib/                    shared by both — one copy, not two
  middleware.ts           guards /admin and nothing else
  prisma/                 schema and seed
  docker-compose.yml      db + app
  docker-compose.dev.yml  the hot-reload overlay
  .env                    the one env file (git-ignored)
  .env.example            its template
```

## Deploying

Vercel does not use the Dockerfile — it builds Next.js natively. One repo, one
project, one URL: the menu at `/` and the dashboard at `/admin`. Set the
environment variables from `.env.example` in the project's dashboard, using
`ADMIN_PASSWORD_HASH` rather than the plain password.

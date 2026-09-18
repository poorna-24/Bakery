# Running the bakery in Docker

One command brings up the whole thing: a Postgres database, the admin dashboard
and the customer menu, with both apps pointed at that database and sharing one
folder for uploaded photos.

Nothing here touches Supabase, Cloudinary or Vercel. Production still deploys
from Vercel exactly as before — this is a self-contained copy for local work,
and a starting point if the apps ever need to run somewhere other than Vercel.

| | Address |
|---|---|
| Customer menu | http://localhost:3000 |
| Admin dashboard | http://localhost:3001 |
| Postgres | `localhost:5432`, user `bakery`, database `bakery` |

## First run

```bash
cp .env.docker.example .env
```

Fill in `.env` — at minimum `POSTGRES_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
and `SESSION_SECRET`. The session secret must be at least 16 characters or the
admin refuses to start.

Create the tables, then start everything:

```bash
docker compose --profile setup run --rm migrate
```

```bash
docker compose up -d --build
```

The database starts empty. Sign in to the admin and add a category, or load the
existing data with `docker compose --profile setup run --rm migrate npm run db:seed`.

## Day to day

```bash
docker compose ps
```

```bash
docker compose logs -f customer
```

```bash
docker compose down
```

`down` keeps the database and the photos — they live in named volumes. To throw
those away too and start from nothing:

```bash
docker compose down -v
```

## After changing code

The images are built from source, so a rebuild is needed for changes to show:

```bash
docker compose up -d --build
```

For everyday development the dev servers are still quicker — `npm run dev` in
each repo, with hot reload. Docker is for checking the app as it will actually
be served: a production build, behind a real Postgres.

> **Do not run `npm run build` on the host while a dev server is running.** They
> share the same `.next` folder, and the production build replaces the dev
> server's chunks — the running site loses its CSS. Docker builds are safe,
> because they happen inside the container against a copy of the source.

## Things worth knowing

**Shop details are baked in at build time.** Everything beginning with
`NEXT_PUBLIC_` is compiled into the customer bundle, so changing the shop name
or phone number in `.env` needs a rebuild, not a restart:

```bash
docker compose up -d --build customer
```

**Photos.** With `CLOUDINARY_URL` empty, uploads are written to the `uploads`
volume, which both containers mount at `/data`. That shared mount is what lets
the admin save a photo and the customer menu show it. Set `CLOUDINARY_URL` and
photos go to Cloudinary instead, exactly as in production.

**Schema changes.** Edit `prisma/schema.prisma` in *both* repos — they are meant
to stay identical — then re-run the migrate step above.

**Behind a corporate network.** If your network re-signs TLS with its own root
certificate, `prisma generate` cannot verify `binaries.prisma.sh` and the build
fails at `npm ci`. Point `EXTRA_CA_CERTS_FILE` in `.env` at that root
certificate; it is passed in as a build secret, trusted for the install step
only, and never written into the image. On an ordinary network, leave it unset.

**Everything here is version-controlled.** Both apps now live in one repo, so
the compose file that wires them together is tracked alongside them rather than
sitting loose on one machine.

## What is where

```
bakery/                     one repo, both apps
  docker-compose.yml        the stack: db + admin + customer, shared volumes
  .env                      your filled-in copy (secrets — git-ignored)
  .env.docker.example       the template
  docker/no-extra-ca.pem    placeholder for the optional corporate CA
  data/                     local uploads and the pre-Postgres backup (ignored)
  scripts/                  set-database-url.mjs and friends
  admin/
    Dockerfile
    .dockerignore
    .env.local              local secrets (git-ignored)
  customer/
    Dockerfile
    .dockerignore
    .env.local              local secrets (git-ignored)
```

## Deploying

Vercel does not use these Dockerfiles — it builds Next.js natively. From one
repo you deploy **two Vercel projects**, each with its Root Directory set:

| Project | Root Directory |
|---|---|
| customer menu | `customer` |
| admin dashboard | `admin` |

Vercel then rebuilds a project only when files under its own directory change.
Environment variables stay per-project, exactly as they are now.

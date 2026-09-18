# bakery-customer

The public menu page. This is what opens when a customer scans the QR code on the table.

Read-only, mobile-first, no login, no cart, no ordering. It renders whatever the owner has saved
in the admin app — the two apps share one database.

> Its sibling repo is **bakery-admin**, the owner's dashboard. Both must point at the same
> `DATABASE_URL` and the same `BAKERY_DATA_DIR`, or the menu will look empty.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

The database is created and seeded from the admin repo — do that first if this page is empty.

### Seeing it on a real phone

With the phone on the same Wi-Fi as this computer, find the machine's IP and open
`http://<that-ip>:3000`. On Windows:

```bash
ipconfig | findstr IPv4
```

## Configuration

`.env.local`:

| Variable | What it does |
|---|---|
| `DATABASE_URL` | The shared database. Must match bakery-admin. |
| `BAKERY_DATA_DIR` | Folder holding `bakery.db` and `uploads/`. Must match bakery-admin. |
| `NEXT_PUBLIC_SHOP_NAME` | Shown in the header and the page title. |
| `NEXT_PUBLIC_SHOP_TAGLINE` | The line under "Our Menu". |
| `NEXT_PUBLIC_SHOP_ADDRESS` | Address text in the footer. |
| `NEXT_PUBLIC_SHOP_MAP_URL` | Google Maps link behind the "Get directions" button. |
| `NEXT_PUBLIC_SHOP_PHONE` | Optional. Set it and a "Call the shop" button appears. |

`DATABASE_URL` also has to be in `.env` — the Prisma CLI does not read `.env.local`.

## The QR code

```bash
npm run qr -- https://menu.yourbakery.com
```

Writes `qr/menu-qr.svg` and `qr/table-card.html` (an A6 card — open it and print). Run it without
an argument and it points at localhost, which only works on this machine.

## How it is built

- `app/page.tsx` reads the menu from the database on every request, so a change saved in the admin
  app is live on the next scan. Categories with no items are dropped, hidden ones are skipped.
- `components/Menu.tsx` holds the whole page: the sticky header, the scrolling category chips with
  scroll-spy, search, and the card grid.
- `components/ItemSheet.tsx` is the bottom sheet that opens when a card is tapped.
- `app/uploads/[name]/route.ts` serves item photos out of the shared data folder. They cannot live
  in `public/` because the admin app — a different repo — is what writes them.
- `lib/db.ts`, `lib/types.ts` and `lib/storage.ts` are byte-identical to the copies in
  bakery-admin. Change one, copy it across.

## Moving to hosted Postgres

Change the `provider` in `prisma/schema.prisma` to `postgresql` **in both repos**, point
`DATABASE_URL` at the server, and run `npx prisma db push` once. Nothing else changes.

Photos are the other half: replace `lib/storage.ts` with an S3 / Supabase Storage client, since a
single folder on disk does not work once the two apps run on different machines.


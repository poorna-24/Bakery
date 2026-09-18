# Bakery Digital Menu — Plan & Status

**Goal:** A customer sits at a table, scans a QR code with their phone, and instantly sees the full
bakery menu — categories, item names, photos, prices, description — without asking staff anything.
No login, no app install, no ordering. Pure "look at what we have".

Separately, the **owner** logs into an admin dashboard and controls everything on that menu: add a
category, add items under it, set prices, upload images, mark things sold out, delete. Whatever the
owner saves shows up on the customer page.

Reference for look & content structure: ksbakers.com/products (category chips + card grid).

> **Status: built and working.** Both apps run, the database is seeded, and the full loop was
> tested end to end — created a category in the admin, added an item with a photo, saw it on the
> customer page, flipped it to sold out, hid the category, deleted it, and confirmed the orphaned
> photo was removed from disk. Section 7 lists exactly what was verified.

---

## 1. The two pieces

| | Customer app | Admin app |
|---|---|---|
| Who uses it | Anyone who scans the QR | Only the owner / manager |
| Device | **Mobile phone** (built at 360–430px) | Laptop mostly, works on phone |
| Login | None. Public. | Email + password |
| Can do | Browse, search, read | Create / edit / delete categories, items, prices, images, availability |
| Folder | `bakery-customer/` | `bakery-admin/` |
| Dev URL | http://localhost:3000 | http://localhost:3001 |

**How they are interconnected:** two separate Next.js apps, two separate repos, but both read and
write **one shared database** and **one shared folder of photos**. The admin writes; the customer
app reads. The moment the owner hits Save, the customer page shows it on the next load.

```
        +---------------------+
        |   Owner (laptop)    |
        |   localhost:3001    |   <- login required
        +----------+----------+
                   | create / update / delete
                   v
        +---------------------------------+
        |   SHARED DATA FOLDER  ../data   |
        |   bakery.db  +  uploads/        |
        +----------+----------------------+
                   | read only
                   v
        +---------------------+        +----------+
        |  Customer (phone)   | <----- | QR code  |
        |   localhost:3000    |  scan  | on table |
        +---------------------+        +----------+
```

That `data/` folder sits **outside both repos** and is gitignored. It is the seam between them —
the one thing they share.

---

## 2. Stack as built

| Layer | Choice | Note |
|---|---|---|
| Framework | Next.js 15.1.6 (App Router) + TypeScript | Server-rendered, so the menu paints fast on a weak phone signal. |
| Styling | Tailwind CSS 3.4 | Mobile-first. Dark mode follows the phone's setting. |
| Database | **SQLite via Prisma 6** | Chosen so it runs today with zero accounts, no server, no keys. |
| Photos | Files in `data/uploads/`, served by a route | Written by admin, read by both. |
| Admin login | Signed JWT cookie (`jose`) + bcrypt | One owner account from `.env.local`. No sign-up, no user table. |
| QR code | `npm run qr` in bakery-customer | Outputs an SVG plus a printable A6 table card. |

Node on this machine is v18.20.8, which Next 15 supports.

**Why SQLite and not Supabase, as originally planned.** Supabase would have meant you creating an
account and handing me project keys before a single line could run. SQLite gets the whole thing
working on your machine now. The schema is plain Prisma, so switching is a two-line change:
set `provider = "postgresql"` in both `prisma/schema.prisma` files, point `DATABASE_URL` at the
server, run `npx prisma db push`. Say the word and I'll do it.

The one thing that does **not** survive that move is photo storage: a shared folder on disk only
works while both apps sit on the same machine. Hosting them separately means swapping
`lib/storage.ts` for S3 / Supabase Storage. Contained to that one file, by design.

---

## 3. Data model

### `categories`
| Column | Type | Notes |
|---|---|---|
| id | string | primary key |
| name | string | "Cakes", "Chocolate Delights" |
| slug | string | `cakes` — the `#anchor` the chips jump to, kept unique automatically |
| description | string | one line under the heading |
| sortOrder | int | owner reorders with ▲▼ |
| isVisible | bool | hide a whole category without deleting it |

### `items`
| Column | Type | Notes |
|---|---|---|
| id | string | primary key |
| categoryId | string | → categories.id, cascade delete |
| name | string | "Choco Truffle Cake" |
| description | string | short, optional |
| price | float | base price in ₹ |
| unit | string | "per kg", "per piece", "per glass"… |
| imageUrl | string? | `/uploads/<uuid>.jpg`, optional |
| isVeg | bool | green / red dot |
| isEggless | bool | EGGLESS badge |
| isBestseller | bool | ★ badge |
| isAvailable | bool | **false = greyed out + "Sold out"**, item stays on the menu |
| sortOrder | int | |

### `itemVariants` — optional, for things sold by weight
| Column | Type | Notes |
|---|---|---|
| id | string | |
| itemId | string | → items.id, cascade delete |
| label | string | "500 g", "1 kg" |
| price | float | |

An item with variants shows a price range (₹350 – ₹650) on the card and the full list in the
detail sheet. Every size the same price, or only one size? It collapses to a single figure. No
variants at all? It shows the base price and its unit. The owner can ignore variants entirely.

### Seeded content
The eight categories from your reference site, with 23 sample items and no photos:
Cakes · Traditional Cakes Collection · Hot & Fresh Bites · Pizza, Burgers & More ·
Fresh Juice, Cold Drinks & Milk Shake · Breads, Dry Cakes & Biscuits · Chocolate Delights ·
Kidz Lava, Donut & More

All of it is editable and deletable — it is a starting point, not furniture.

---

## 4. Customer UI

One scrolling page. No navigation, no reloads.

- **Sticky header** — shop name, search icon.
- **Category chips** — horizontally scrolling rail under the header. Tap one to jump to that
  section; the highlight follows you as you scroll (scroll-spy), and the rail keeps the active chip
  in view.
- **Search** — expands from the icon, filters every category live, hides categories with no match.
- **Cards** — two per row, square photo, veg/non-veg dot, EGGLESS and ★ BESTSELLER badges, price.
  Photos lazy-load behind a shimmer so the page never jumps.
- **Sold out** — the card greys out and gets a "Sold out" stamp. It stays on the menu: customers
  should know the item exists.
- **Tap a card** → bottom sheet with the large photo, tags, description, every size and price, and
  a "Call the shop" button if you set a phone number. Escape or tap-outside closes it; the page
  behind does not scroll while it is open.
- **Dark mode** follows the phone. Pinch-zoom is deliberately left enabled — it is a menu, and
  people zoom into prices.

```
+-------------------------------+
|  KS BAKERS              (Q)   |  sticky
| [Cakes] Traditional  Hot & F >|  chips, sticky
+-------------------------------+
|         Our Menu              |
|  Handcrafted delights...      |
+-------------------------------+
| | CAKES                       |
| | Celebrate life's sweet...   |
|  +----------+ +----------+    |
|  |★BESTSELL | |          |    |
|  |  photo   | |  photo   |    |
|  +----------+ +----------+    |
|  |■ Choco   | |■ Butter  |    |
|  |  Truffle | |  Scotch  |    |
|  |₹350–₹650 | |₹320–₹600 |    |
|  +----------+ +----------+    |
+-------------------------------+
```

---

## 5. Admin UI

- **Login** — one account, from `.env.local`. Wrong credentials give a deliberately vague error.
- **Dashboard** — counts of categories / items / sold-out, then the category list in customer
  order, each row showing its item count. Per row: ▲▼ reorder, Hide/Show, Rename, Delete.
- **Category page** — its items as rows: thumbnail, name, price, a one-click Available ⇄ Sold out
  toggle, ▲▼ reorder, Edit, Delete (with a confirm step).
- **Item form** — category dropdown, name, description, price, unit, photo upload with live
  preview, four checkboxes (Veg / Eggless / Bestseller / Available), and repeatable size rows.
- **Preview** — the live customer page inside a phone-shaped frame.

**The flow you asked for works exactly as described:** the owner creates a category → it appears
immediately in the item form's dropdown → items get assigned to it → it renders as a new section on
the customer menu. An empty category is never shown to customers, so a half-built one stays private
until it has something in it.

Deleting a category with items asks first: move them to another category, or delete them too.
Deleting a photo, replacing a photo, or deleting an item removes the old file from disk — no
orphans pile up.

---

## 6. Repo layout

```
Bakery/
├── PLAN.md                     this file
├── data/                       SHARED — gitignored, in neither repo
│   ├── bakery.db
│   └── uploads/
│
├── bakery-customer/            repo 1 — public menu
│   ├── app/
│   │   ├── page.tsx            reads the menu, drops empty categories
│   │   ├── layout.tsx
│   │   └── uploads/[name]/     serves photos from ../data/uploads
│   ├── components/
│   │   ├── Menu.tsx            chips, scroll-spy, search, grid
│   │   ├── ItemCard.tsx
│   │   ├── ItemSheet.tsx
│   │   └── VegMark.tsx
│   ├── lib/                    db.ts · types.ts · storage.ts
│   ├── scripts/qr.mjs          QR + printable table card
│   └── prisma/schema.prisma
│
└── bakery-admin/               repo 2 — owner dashboard (keep private)
    ├── middleware.ts           guards every route
    ├── app/
    │   ├── actions.ts          every create / update / delete
    │   ├── login/
    │   ├── page.tsx            dashboard
    │   ├── categories/[id]/    items in a category, + /new
    │   ├── items/[id]/         edit an item
    │   └── preview/            phone-frame preview
    ├── components/             Shell · CategoryRow · ItemRow · ItemForm · NewCategoryForm
    ├── lib/                    db.ts · types.ts · storage.ts · auth.ts · saveImage.ts
    └── prisma/                 schema.prisma · seed.mjs
```

`lib/db.ts`, `lib/types.ts` and `lib/storage.ts` are byte-identical in both repos on purpose — that
is what keeps two separate codebases agreeing about one database. Change one, copy it across. (In a
monorepo they would be one shared package; say so and I'll convert it.)

---

## 7. What was tested

Run against the real apps, not mocked:

- Customer page renders all 8 categories and 23 items, light and dark, at 375×812.
- Category chips: correct active highlight, and jumping updates it.
- Item sheet opens with the right variants and prices, locks the page behind it, closes on Escape.
- Search: typing "brownie" narrowed the page to one card in one category.
- Admin: unauthenticated request to `/` redirects to `/login`; wrong password is rejected; correct
  password lands on the dashboard.
- Created a category → confirmed it appeared in the item-form dropdown, pre-selected.
- Added an item with a real uploaded PNG and a size variant → file written to `data/uploads/`,
  served over HTTP at 200 with the right content type, visible on the customer page.
- Flipped it to Sold out → customer page kept the item, greyed, badged "Sold out".
- Hid the category → it vanished from the customer page; the rest stayed.
- Deleted the category and its item → gone from both apps, and the photo was removed from disk.
- Both apps compile clean: `next build` passes with no type errors.

**Not verified:** the smooth-scroll jump when tapping a chip. The automated browser here blocks
scripted scrolling, so I could not measure it. The code uses a standard `scrollIntoView`, and real
mouse scrolling worked fine — but you should tap a few chips yourself and tell me if the landing
position looks off.

---

## 8. How to run it

Two terminals.

```bash
cd bakery-customer
npm run dev          # http://localhost:3000  — the menu
```

```bash
cd bakery-admin
npm run dev          # http://localhost:3001  — the dashboard
```

Sign in with `owner@bakery.com` / `bakery123` (both in `bakery-admin/.env.local` — change them).

**On your real phone**, same Wi-Fi as this laptop:

```bash
ipconfig | findstr IPv4
```

then open `http://<that-ip>:3000` on the phone.

**The QR code:**

```bash
cd bakery-customer
npm run qr -- https://menu.yourbakery.com
```

writes `qr/menu-qr.svg` and `qr/table-card.html` — open the card and print it. Run it without a URL
and it points at localhost, which only works on this machine.

**Note about this machine:** your network inspects TLS, which broke Prisma's engine download. I
exported the certificates Windows already trusts to
`C:\Users\poterala\.node-ca\windows-root-ca.pem`. If a Prisma command ever fails with
"unable to get local issuer certificate", prefix it:

```bash
NODE_EXTRA_CA_CERTS="C:\Users\poterala\.node-ca\windows-root-ca.pem" npx prisma generate
```

---

## 9. Before this goes live

1. **Change the admin password.** Generate a bcrypt hash, put it in `ADMIN_PASSWORD_HASH`, delete
   `ADMIN_PASSWORD`. The README has the one-line command.
2. **Change `SESSION_SECRET`** to something long and random.
3. **Serve both over HTTPS.** The session cookie is `secure` in production — over plain HTTP the
   login will silently fail. It also matters for the QR: phones warn on insecure pages.
4. **Move off SQLite** if the two apps will live on different machines (section 2).
5. **Back up `data/`.** It is the entire menu. Two files, so a scheduled copy is enough.

---

## 10. GitHub

You said you'll handle the pushes. Both folders are initialised as git repos with an initial
commit, and `.gitignore` keeps `node_modules`, `.next`, `.env*` and `data/` out.

Create two empty repos on github.com, then:

```bash
cd bakery-customer
git remote add origin https://github.com/<you>/bakery-customer.git
git push -u origin main
```

```bash
cd bakery-admin
git remote add origin https://github.com/<you>/bakery-admin.git
git push -u origin main
```

Suggested: **bakery-customer public** (it is a public menu anyway), **bakery-admin private**.

Nothing has been pushed anywhere, and no remotes are configured.

---

## 11. Still open — your call

1. **Bakery name and brand colours.** Currently "KS Bakers" with a warm cream/brown palette, set by
   `NEXT_PUBLIC_SHOP_NAME` in both `.env.local` files. A logo image would replace the wordmark.
2. **Phone number.** Set `NEXT_PUBLIC_SHOP_PHONE` and a "Call the shop" button appears on every
   item. Left empty for now, so it is hidden.
3. **Tax line.** Prices show as inclusive with a footer note. Change it if that is wrong.
4. **Multiple outlets.** Your reference site has a location picker. Not built — it would mean a
   branch table and per-branch availability. Worth doing only if prices actually differ.
5. **Real photos.** The menu carries a cupcake placeholder until photos are uploaded. Send me a
   folder and I can bulk-attach them instead of you doing it one at a time.

---

## 12. Not in v1 — easy to add later

Ordering / cart · payments · WhatsApp order button · customer accounts · reviews & ratings ·
multi-language (Telugu / Hindi) · analytics on most-viewed items · daily specials scheduling ·
staff accounts with limited permissions · printable PDF menu · drag-and-drop reordering (it is
▲▼ buttons today) · bulk photo import.

Say which of these you want and I'll fold them in.

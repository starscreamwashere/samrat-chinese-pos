# Samrat Chinese — POS & Manager

Tap-to-order POS for a 15-seat Chinese restaurant in Worli, Mumbai. Replaces the
pen-and-paper notebook with a one-tap button grid, tracks the money (revenue vs.
rent/salary/capital), and sends the owner a WhatsApp summary every night.

Built to the six project docs (PRD, TRD, App Flow, UI/UX, Schema, Plan).

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Prisma** ORM → **PostgreSQL** (Supabase, used as a plain Postgres DB)
- **NextAuth** (Credentials, bcrypt) — owner + staff roles, JWT sessions
- **React Query** for data fetching, **Zod** for validation, **Recharts** for charts
- **WhatsApp Cloud API** (Meta) for the nightly summary, fired by **Vercel Cron**

## Features (all built)

| Screen | What it does |
|---|---|
| `/login` | Email/password login (owner pre-created by seed) |
| `/` | Button-grid order screen — Half/Full pills, +Gravy ₹10 on rice/noodles/starters, live total, Dine-in/Phone, Save |
| `/orders` | Today's orders with items, per-order + running daily total |
| `/dashboard` | Today's revenue, order count, **net position** (revenue − expenses), 14-day revenue chart, all-time finance breakdown *(owner only)* |
| `/expenses` | Log rent/salary/capital/other, list + delete *(owner only)* |
| `/menu` | Add/edit/hide menu items, fix prices — no developer needed *(owner only)* |
| `/more` | Menu + Expenses links, restaurant details, logout |
| `/api/cron/daily-summary` | Computes totals + top items, writes `daily_summaries`, sends WhatsApp *(protected by `CRON_SECRET`)* |

**Roles:** `owner` = full access. `staff` = take orders + view today's orders only
(Dashboard/Expenses/Menu are hidden and API-blocked with 403).

## Local setup

1. **Install deps**

   ```bash
   npm install
   ```

2. **Create `.env`** — copy `.env.example` to `.env` and fill in real values:

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL` — a Postgres connection string. For local dev you can run one
     in Docker:

     ```bash
     docker run -d --name samrat-pg -e POSTGRES_PASSWORD=samrat \
       -e POSTGRES_DB=samrat -p 5433:5432 postgres:16-alpine
     # DATABASE_URL="postgresql://postgres:samrat@localhost:5433/samrat?schema=public"
     ```

     For production, use your **Supabase** connection string
     (Project Settings → Database → Connection string → URI).
   - `NEXTAUTH_SECRET` / `CRON_SECRET` — generate each with `openssl rand -base64 32`.
   - `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` — the owner login the seed creates.

3. **Migrate + seed**

   ```bash
   npx prisma migrate deploy   # or: npx prisma migrate dev
   npm run db:seed             # creates owner + seeds the full menu
   ```

4. **Run**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 and log in with the seed owner credentials.

## Deploy to Vercel

1. Push this repo to GitHub, then import it in Vercel.
2. Set the environment variables from `.env.example` in **Vercel → Settings →
   Environment Variables** (use your Supabase `DATABASE_URL`, and set
   `NEXTAUTH_URL` to your production URL).
3. The build runs `prisma generate && next build`. Apply migrations against the
   production DB once (locally with the prod `DATABASE_URL`, or a one-off job):

   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```

4. **Cron** is configured in `vercel.json` to hit `/api/cron/daily-summary` daily
   at **19:00 UTC (00:30 IST)** — just after the restaurant closes, still within
   the same UTC calendar day, so the query captures the full business day.
   Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET`.

### Timezone note

The app computes "today" using the server's local time. On Vercel (UTC) this is
correct for Mumbai because the restaurant's hours (12pm–12am IST = 06:30–18:30
UTC) sit entirely inside one UTC day. If you want dates/labels pinned to IST
explicitly, set an env var **`TZ=Asia/Kolkata`** in Vercel.

## WhatsApp setup

The nightly summary uses the **Meta WhatsApp Cloud API**:

1. Create a Meta Business app with the WhatsApp product; note the **Phone Number
   ID** (`WHATSAPP_PHONE_NUMBER_ID`) and generate a **permanent access token**
   (`WHATSAPP_API_TOKEN`).
2. Set `OWNER_WHATSAPP_NUMBER` to the owner's number in international format,
   digits only (e.g. `918591929077`).
3. Test the endpoint:

   ```bash
   curl -X POST https://<your-app>/api/cron/daily-summary \
     -H "Authorization: Bearer <CRON_SECRET>"
   ```

> **Meta 24-hour window:** outside a 24h customer-service window, Meta only
> delivers **pre-approved template messages**. For a reliable nightly push,
> register a template and switch `sendWhatsAppText` in
> [`src/lib/whatsapp.ts`](src/lib/whatsapp.ts) to a `template` payload. Plain text
> is wired up now for easy testing; the summary is always viewable on the
> Dashboard regardless of send status.

## Menu prices to confirm before launch

A few board prices were smudged. The seed handles them so nothing rings up wrong:

- **Seeded but hidden** (missing full price — enable + set price in `/menu`):
  Chicken Burnt Garlic Rice, Chicken Burnt Garlic Noodles.
- **Skipped** (no price at all): Chicken Triple Rice — add it from `/menu`.
- **Seeded active, single-price** (half was smudged — add a half price if wanted):
  Chicken 1000 Noodles, Paneer Fried Rice, Paneer Hakka Noodles, Paneer Schezwan
  Noodles, Veg 1000 Rice, Veg 1000 Noodles.

## Project structure

```
prisma/schema.prisma      six tables + enums + indexes
prisma/seed.ts            owner account + full transcribed menu (124 items)
src/app/                  pages (order, orders, dashboard, expenses, menu, more, login)
src/app/api/              menu, orders, expenses, dashboard, cron, NextAuth
src/lib/                  prisma, auth, api-auth (role guards), whatsapp, daily-summary, validators
src/components/           AppShell, BottomNav, ui primitives
vercel.json               nightly cron schedule
```

## Scripts

```bash
npm run dev            # dev server
npm run build          # prisma generate + next build
npm run typecheck      # tsc --noEmit
npm run db:seed        # seed owner + menu
npx prisma studio      # browse the DB
```

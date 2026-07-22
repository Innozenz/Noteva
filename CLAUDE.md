# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Noteva** — a marketplace where students find music/singing teachers and book lessons with them. Built on a Next.js 16 (App Router) SaaS boilerplate: Better Auth, Prisma 7 + PostgreSQL, Stripe.

**Business model, because it drives the data model:** teachers subscribe to the platform (Stripe subscription on `TeacherProfile`). Students pay their teacher directly, offline — there is **no student-facing payment**, no Stripe Connect, no escrow. `priceCents` fields exist for display and history only and must never trigger a charge.

The UI under `app/` is still largely boilerplate demo code (`app/page.tsx` is a marketing page that doubles as the sign-in screen). The domain model in `prisma/schema.prisma` is the part that reflects the real product.

User-facing copy is in **French** (including `toLocaleDateString("fr-FR", …)` calls); match that when editing existing UI. Schema comments are in French too; code identifiers stay in English.

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build (standalone output)
npm run start    # run production build
npm run lint     # eslint (flat config, eslint-config-next)

npx prisma generate        # regenerate Prisma client after schema changes
npx prisma migrate dev     # create + apply a migration (dev)
npx prisma migrate deploy  # apply pending migrations (CI/prod)
npx prisma migrate status  # what's applied vs pending
```

**Do not use `prisma db push`.** This project is on `prisma migrate` because the schema depends on hand-written SQL that `db push` would silently drop (see *Integrity constraints* below).

There is no test suite configured in this repo. The slot-computation engine is the one place that warrants one when it lands.

### Environment

`.env.example` lists every variable — `cp .env.example .env` and fill it in. Non-obvious consumers:

- `DATABASE_URL` — read by `prisma.config.ts`, not by `schema.prisma` (see Prisma 7 note below).
- `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` — read by Better Auth itself; they don't appear anywhere in the source.
- `NEXT_PUBLIC_APP_URL` — Better Auth *client* baseURL (`lib/auth-client.ts`) and the Stripe checkout success/cancel URLs. Separate from `BETTER_AUTH_URL`; keep them in sync.
- `NEXT_PUBLIC_STRIPE_PRICE_ID` — fallback price in `components/subscription-button.tsx` when no `priceId` prop is passed. This is the **teacher** subscription price.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — only consumed by `lib/stripe-client.ts`, which nothing imports, so it's currently unused at runtime.

### Database setup

`DATABASE_URL` must point at a PostgreSQL instance — currently a hosted **Neon** database; `docker-compose.yml` also provides a local `postgres:16-alpine`. After changing `prisma/schema.prisma`, run `npx prisma generate` before TypeScript picks up the new client types, then `npx prisma migrate dev`.

**Prisma 7 has two traps, both already worked around — don't undo them:**

1. **The datasource URL is not in `schema.prisma`.** `prisma.config.ts` is the CLI entrypoint: it declares the schema path, the migrations path, the datasource URL, and does the `import "dotenv/config"` that loads `.env` (Prisma 7 no longer auto-loads it). `datasource db` deliberately has no `url` field; don't "fix" it by adding one. Any script hitting the DB outside the CLI must load dotenv itself.
2. **The runtime client needs a driver adapter.** Prisma 7 dropped the Rust engine *and* the `datasourceUrl` constructor option, so `new PrismaClient()` with no argument throws at instantiation — the app cannot reach the database at all. `lib/prisma.ts` passes `new PrismaPg({ connectionString })` from `@prisma/adapter-pg`. That adapter works against both Neon and the local docker Postgres.

## Architecture

### Auth (Better Auth)

- `lib/auth.ts` — server-side Better Auth instance, wired to Prisma via `prismaAdapter`. Email/password and Google OAuth.
- `lib/auth-client.ts` — browser client (`createAuthClient` from `better-auth/react`); `authClient.useSession()` is how client components read the session.
- `app/api/auth/[...better-auth]/route.ts` — catch-all that mounts Better Auth's handlers; all auth traffic (sign-in, session, OAuth callback) flows through here.
- Server-side session reads (API routes, server components) go through `auth.api.getSession({ headers: await headers() })` — see `app/api/stripe/checkout/route.ts` and `app/api/user/subscription/route.ts`.

**There are no `/login` or `/register` pages.** Sign-in/sign-up is the `AuthButtons` client component rendered inline on `app/page.tsx`, with Zod-validated email/password fields plus a Google button. `middleware.ts` lists `/login` and `/register` in `authRoutes` and in its `matcher`, but those routes 404 today — the entries are placeholders for when dedicated pages get added.

**`User.role` is nullable on purpose.** With Google OAuth the account is created before the user can say whether they're a teacher or a student, so the role is filled in by a post-signup onboarding step. Treat `role === null` as "onboarding incomplete" and redirect there; don't assume a role is present.

**Route gating is two-layer and both layers are shallow:**
1. `middleware.ts` checks only for the *presence* of the `better-auth.session_token` cookie (no signature/expiry check at the edge). Unauthenticated hits on `protectedRoutes` (`/dashboard`) redirect to `/` with a `callbackUrl` search param — note nothing currently consumes `callbackUrl`.
2. `app/dashboard/page.tsx` is a `"use client"` component that re-checks `authClient.useSession()` and `router.push("/")` if absent.

Real validation only happens server-side in API routes via `auth.api.getSession`. When adding a protected page, update `protectedRoutes` **and** the `matcher` in `middleware.ts`, and don't rely on either layer for authorization of data — guard in the route handler.

This matters more now than it did for the boilerplate: the data is multi-tenant. Every handler touching a booking, a calendar or a profile must check *this user owns this resource*, not merely *this user is logged in* — otherwise any student can read another's lessons through `/api/bookings/[id]`.

### Public pages must be Server Components

Search discovery is how a marketplace lives, so the public surface (teacher profiles at `/profs/[slug]`, search, instrument/city landing pages) needs Server Components with `generateMetadata` and ISR. **Do not copy the pattern from `app/dashboard/page.tsx`** — it is `"use client"` and reads the session via `authClient.useSession()`, which renders nothing crawlable. Public = RSC; the signed-in area can stay client-side.

### Domain model (Prisma)

`User`/`Session`/`Account`/`Verification` match Better Auth's expected shape and are `@@map`ped to lowercase tables — don't rename fields or mappings without adjusting the adapter config in `lib/auth.ts`. Everything else is Noteva's domain. `lib/prisma.ts` exports a singleton `PrismaClient` cached on `globalThis` outside production to survive dev hot-reload.

**Two conventions hold the whole booking model together. Read them before touching availability or bookings:**

**1. Availability is rules, never materialized slots.** A teacher's availability is `AvailabilityRule` (weekly recurrence) plus `AvailabilityException` (`BLOCKED` for time off, `EXTRA` for one-off openings). Free slots are computed at read time from `rules − exceptions − bookings`. Never write a slots table: it explodes in size and drifts out of sync.

**2. Wall-clock time vs instants.** `AvailabilityRule.startMinute`/`endMinute` are minutes-since-midnight (0–1440) **in the teacher's own timezone** (`User.timezone`, IANA). This is what makes "available Mondays at 9am" survive DST. `Booking.startsAt`/`endsAt` are absolute instants in `@db.Timestamptz(3)` — the `timestamptz` mapping is **required**, not stylistic: the overlap constraint builds a `tstzrange` from those columns. `weekday` is ISO-8601 (1 = Monday … 7 = Sunday).

Other decisions worth knowing:

- `Instrument` is a table, not a `String[]`, because search filters and facets on it; `aliases[]` (GIN-indexed) lets "technique vocale" match "chant".
- Skill level lives on the **pair**, in `StudentInstrument` — a student can be advanced at piano and a beginner at singing. `TeacherInstrument.levelsTaught` is the mirror image.
- `StudentProfile` carries `birthDate` plus guardian contacts: a lot of music students are minors, and the app layer must require guardian details when `birthDate` implies under 18.
- `Booking.status` starts at `PENDING` — with no online payment there's nothing to lock commitment, so the teacher confirms explicitly.
- `Review` hangs off a `bookingId` (unique) so only a real lesson can be reviewed, and `publishedAt` is null until moderated.

#### Integrity constraints (hand-written SQL)

The tail of `prisma/migrations/20260722120000_init_noteva/migration.sql`, below the generated section, is written by hand and **`prisma migrate diff` will not regenerate it**. If you ever rebuild the migration from scratch, port that block over.

The important one is anti-double-booking. An application-level "is this slot free?" check followed by an `INSERT` leaves a race window where two students take the same slot, so the guarantee is a Postgres exclusion constraint (needs the `btree_gist` extension):

- `booking_teacher_no_overlap` — no overlapping `PENDING` or `CONFIRMED` booking per teacher. Pending requests **do** hold the slot, otherwise a teacher gets several competing requests for one hour.
- `booking_student_no_overlap` — `CONFIRMED` only, so a student can legitimately have pending requests with several teachers for the same slot while shopping around.
- Ranges are half-open `[)`: a 11:00 lesson right after a 10:00–11:00 one is allowed. Cancelled/declined bookings release the slot.
- Plus `CHECK`s: `booking_time_order`, minute ranges on availability rows, `review_rating_range` (1–5).

Expect SQLSTATE `23P01` (exclusion violation) on a booking conflict and surface it as "créneau déjà pris" rather than a 500.

### Payments (Stripe) — teachers only

The Stripe integration bills **teachers** for platform access. All four `stripe*` fields live on `TeacherProfile`, not `User`. Students never touch Stripe.

Teacher visibility should be **derived at read time** (`status = PUBLISHED AND stripeCurrentPeriodEnd > now()`) rather than flipping the profile to `SUSPENDED` from a webhook — that keeps one source of truth instead of a state to resynchronize.

- `lib/stripe.ts` — server-side Stripe SDK client.
- `app/api/stripe/checkout/route.ts` — creates a subscription-mode Checkout Session, 403s if the user has no `TeacherProfile` (otherwise the webhook would have no row to update), and stamps `userId` into `metadata`. Returns `{ url }`; the client does a plain `window.location.href` redirect (`components/subscription-button.tsx`).
- `lib/stripe-client.ts` (`loadStripe`) exists but is **not imported anywhere** — it's leftover scaffolding for a `redirectToCheckout` flow the app doesn't use.
- `app/api/webhooks/stripe/route.ts` — verifies the Stripe signature and handles `checkout.session.completed` (initial attach, matched by `metadata.userId` → `teacherProfile.userId`) and `invoice.payment_succeeded` (renewal, matched by `stripeSubscriptionId`, which is `@unique` for exactly that reason). Both read the period end off `subscription.items.data[0].current_period_end` — the Stripe v20 API shape, where the field lives on the item rather than the subscription. Extend this handler for new lifecycle behavior (cancellation, plan change) rather than polling Stripe elsewhere.
- `app/api/user/subscription/route.ts` — read-only endpoint deriving `isActive` from a non-null `stripeSubscriptionId` plus `stripeCurrentPeriodEnd > now()`. Returns `isActive: false` rather than 404 for a user with no teacher profile (i.e. every student). This is the source of truth for the client; there's no separate cache.

### State management convention

- **Server state** (anything backed by an API/DB — subscription status, user data) → TanStack Query. `components/providers.tsx` creates one `QueryClient` (1 min `staleTime`, no refetch-on-focus) wrapping the app in `app/layout.tsx`.
- **UI-only state** (not persisted, not fetched) → Zustand. `lib/store.ts` holds only sidebar-open state; keep it scoped to ephemeral UI concerns rather than mirroring server data.

### UI components

`components/ui/*` are shadcn/ui-style primitives (Radix + `class-variance-authority` + `tailwind-merge`, composed via `cn()` in `lib/utils.ts`). Extend these rather than adding another component library. Note some carry **non-stock variants** added for this project — e.g. `variant="success"` on both `Button` and `Badge` — so check the `cva` config before assuming upstream shadcn defaults. Styling is Tailwind CSS 4 (`postcss.config.mjs`); animations use Framer Motion (`app/page.tsx`, `app/dashboard/page.tsx`).

### Path aliases

`@/*` maps to the repo root (`tsconfig.json`), e.g. `@/lib/auth`, `@/components/ui/button`.

## Current state

The schema is migrated and applied, but the app on top of it is still the boilerplate. Concretely:

- The `instrument` table is **empty**, so nothing is bookable until it's seeded. There is no seed script yet (`prisma db seed` on a `.ts` file would need `tsx` added).
- No slot-computation engine yet. It should be a pure function `(rules, exceptions, bookings, range, timezone) → slots[]` with no DB access, so it can be tested against DST transitions directly.
- No onboarding page, no teacher/student areas, no public teacher pages — `app/dashboard/page.tsx` is still the boilerplate demo.
- `npm run lint` reports two pre-existing errors (an `any` in the Stripe webhook, an unescaped apostrophe in the dashboard).

## Docker

`Dockerfile` is a multi-stage build producing Next.js `standalone` output (`next.config.ts` sets `output: "standalone"`); it runs `prisma generate` at build time and copies `prisma/` into the final image so migrations can run at runtime. `docker-compose.yml` wires the app container to a local `postgres` service — it overrides `DATABASE_URL` to the `db` service host, so that value wins over whatever is in `.env`.

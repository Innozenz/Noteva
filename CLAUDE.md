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
npm test         # vitest, single run
npm run test:watch

npx vitest run lib/availability            # one file
npx vitest run -t "heure d'été"            # one test / describe block by name

npx prisma generate        # regenerate Prisma client after schema changes
npx prisma migrate dev     # create + apply a migration (dev)
npx prisma migrate deploy  # apply pending migrations (CI/prod)
npx prisma migrate status  # what's applied vs pending
npx prisma db seed         # instrument catalogue (idempotent, upsert by slug)
```

**Do not use `prisma db push`.** This project is on `prisma migrate` because the schema depends on hand-written SQL that `db push` would silently drop (see *Integrity constraints* below).

Tests cover `lib/availability` only, and that's deliberate: it's the one piece of logic whose bugs are invisible by inspection (see below). Don't feel obliged to backfill tests for CRUD routes.

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
- `app/api/auth/[...all]/route.ts` — catch-all that mounts Better Auth's handlers; all auth traffic (sign-in, session, OAuth callback) flows through here. **Keep the segment name a valid JS identifier.** It used to be `[...better-auth]`, and the hyphen made Next 16 crash its dev render worker on *every* `/api/auth/*` request ("Jest worker encountered 2 child process exceptions") — a total auth outage that looked like a Better Auth bug rather than a routing one. Renaming a route directory also requires a dev-server restart; hot reload keeps serving 404s.
- Server-side session reads (API routes, server components) go through `auth.api.getSession({ headers: await headers() })` — see `app/api/stripe/checkout/route.ts` and `app/api/user/subscription/route.ts`.

**There are no `/login` or `/register` pages.** Sign-in/sign-up is the `AuthButtons` client component rendered inline on `app/page.tsx`, with Zod-validated email/password fields plus a Google button. `middleware.ts` lists `/login` and `/register` in `authRoutes` and in its `matcher`, but those routes 404 today — the entries are placeholders for when dedicated pages get added.

**`User.role` is nullable on purpose.** With Google OAuth the account is created before the user can say whether they're a teacher or a student, so `POST /api/onboarding` fills it in and creates the matching profile in one transaction. Treat `role === null` as "onboarding incomplete"; don't assume a role is present.

**The role gate is in `app/dashboard/layout.tsx`, not the middleware** — and it has to be. The middleware runs on the edge, sees only the session cookie, and has no Prisma access, so it cannot read a role. Any new signed-in area needs its own Server Component layout doing the same check, or it will be reachable with `role === null`.

Choosing a role is **one-way**: `/api/onboarding` answers 409 once `role` is set. A teacher profile carries a public slug, availability and lesson history that a switch to "student" would orphan. Teacher slugs come from `lib/slug.ts` (accent-stripped, reserved words avoided, `-2`/`-3` on collision) and are unit-tested — they end up in indexed public URLs, so they're painful to change later.

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

### Slot engine (`lib/availability`)

`computeAvailableSlots(input)` is a **pure function**: no Prisma import, no DB access, and it never reads the clock — `now` is passed in. Load the rules, exceptions and bookings in the caller, then hand them over. Keep it that way; that property is what makes the DST tests possible.

The pipeline is: expand weekly rules per local civil day → union with `EXTRA` exceptions → subtract `BLOCKED` → project each local interval to instants → subtract bookings widened by `bufferMin` → clamp to the request window, the `minNoticeHours` floor and the `bookingHorizonDays` ceiling → slice into slots.

Things that will bite you:

- **`range` is in instants, not civil dates.** A `Date` built from `"2026-10-25T00:00:00Z"` is 2am in Paris and will silently clip the start of the local day. Pass real wall-clock boundaries.
- **Slicing happens in instant space**, so a local 1am–4am window yields 2 slots on the spring-forward day and 4 on the fall-back day. That's correct: a lesson is a real duration, not a wall-clock one. Both cases are pinned by tests.
- `@db.Date` columns come back from Prisma as **UTC-midnight** `Date`s. Rule validity bounds and exception dates are therefore read with `getUTC*` — reading them in server-local time shifts them a day for any zone behind UTC.
- Intervals are half-open `[start, end)` throughout, matching the `tstzrange('[)')` in the DB constraint, so a lesson may start exactly when another ends.

The engine narrows candidates; it is **not** the booking guarantee. Two requests can pass through it concurrently for the same slot — the exclusion constraint below is what actually prevents the double booking.

Its one caller is `app/api/teachers/[slug]/availability/route.ts` (`GET ?from=&to=&duration=`), which is **public** — discovery is the point of a marketplace, so a student can browse a calendar before signing up. It returns slots only, never student identities or the teacher's private notes.

Two things that route establishes and new code should follow:

- **Teacher visibility is derived, never stored:** `status === "PUBLISHED" && stripeCurrentPeriodEnd > now()`. A lapsed subscription hides the profile with no webhook writing a `SUSPENDED` state. It answers **404, not 403**, for an invisible teacher, so the endpoint doesn't confirm that an unpublished profile exists.
- The booking query filters on `status IN (PENDING, CONFIRMED)` — the same set as `booking_teacher_no_overlap`. If you change one, change the other, or the UI will offer slots the database then refuses.

#### Integrity constraints (hand-written SQL)

The tail of `prisma/migrations/20260722120000_init_noteva/migration.sql`, below the generated section, is written by hand and **`prisma migrate diff` will not regenerate it**. If you ever rebuild the migration from scratch, port that block over.

The important one is anti-double-booking. An application-level "is this slot free?" check followed by an `INSERT` leaves a race window where two students take the same slot, so the guarantee is a Postgres exclusion constraint (needs the `btree_gist` extension):

- `booking_teacher_no_overlap` — no overlapping `PENDING` or `CONFIRMED` booking per teacher. Pending requests **do** hold the slot, otherwise a teacher gets several competing requests for one hour.
- `booking_student_no_overlap` — `CONFIRMED` only, so a student can legitimately have pending requests with several teachers for the same slot while shopping around.
- Ranges are half-open `[)`: a 11:00 lesson right after a 10:00–11:00 one is allowed. Cancelled/declined bookings release the slot.
- Plus `CHECK`s: `booking_time_order`, minute ranges on availability rows, `review_rating_range` (1–5).

A booking conflict surfaces as an exclusion violation. **The driver adapter does not expose SQLSTATE `23P01` on the error object** — the constraint *name* is what survives into the serialized error, so `overlapConflict()` in `app/api/bookings/route.ts` matches on `booking_teacher_no_overlap` / `booking_student_no_overlap`. Rename a constraint and you must update that function, or conflicts start returning 500.

### Booking lifecycle

The state machine lives in `lib/bookings/transitions.ts`, deliberately apart from the handler and free of Prisma or HTTP so the rules read at a glance and are unit-tested. `app/api/bookings/[id]/route.ts` applies it.

`PENDING` and `CONFIRMED` hold a slot; every other status releases it. That's why decline and cancel matter as much as confirm — an untreated request would otherwise block the teacher's calendar forever. Verified end to end: cancelling a booking makes the slot reappear in the availability endpoint and become bookable again.

- `confirm` / `decline` — teacher, from `PENDING`.
- `cancel` — either party, from `PENDING` or `CONFIRMED`. Returns `lateCancellation` when inside the teacher's `cancellationWindowHours`; with no online payment there's nothing to charge, so it informs rather than blocks.
- `complete` / `no_show` — teacher, from `CONFIRMED`, and only once the lesson has ended (resp. started). `complete` is what gates reviews.
- Terminal statuses accept no further action.

Two conventions the handler establishes:

- **Non-participants get 404, never 403**, on both `GET` and `PATCH`. A 403 would confirm that an id exists and let someone probe other people's calendars.
- Transitions are applied with a **conditional `updateMany` on the current status**, not a plain `update`. Concurrent requests can't apply the same transition twice — the loser sees `count === 0` and gets a 409.

`PATCH` also accepts `teacherNote`/`meetingUrl` **without** an `action`. Don't remove that path: when those fields could only ride along with a transition, a rejected transition silently discarded them.

### Two guards on writes

Writing a booking needs **two** guards, and neither replaces the other: re-derive availability server-side (a client can POST any timestamp — the constraint stops overlaps, not 3am on a Sunday), then let the constraint arbitrate the race that re-derivation cannot see. Verified: six concurrent requests for one slot produce exactly one booking, one constraint-driven 409, and four re-validation 409s.

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

- `prisma/seed.ts` (run via `tsx`, declared in `prisma.config.ts`) holds 37 instruments across the 8 families, with search aliases. Seeded and idempotent.
- The slot engine is tested (27 tests) and exposed through the public availability route.
- The booking API is complete: create, list, read, and the full lifecycle. Nothing consumes it — **there is no UI**.
- `/onboarding` exists and gates `/dashboard`. Everything past it is still boilerplate: no availability editor, no request inbox for teachers, no public teacher pages, and `app/dashboard/page.tsx` is unchanged demo code.
- A teacher profile is created in `DRAFT` with nothing but a slug — there is no form to fill in a bio, rates, instruments or availability, so no teacher can reach `PUBLISHED` yet.
- `npm run lint` reports two pre-existing errors (an `any` in the Stripe webhook, an unescaped apostrophe in the dashboard).

## Docker

`Dockerfile` is a multi-stage build producing Next.js `standalone` output (`next.config.ts` sets `output: "standalone"`); it runs `prisma generate` at build time and copies `prisma/` into the final image so migrations can run at runtime. `docker-compose.yml` wires the app container to a local `postgres` service — it overrides `DATABASE_URL` to the `db` service host, so that value wins over whatever is in `.env`.

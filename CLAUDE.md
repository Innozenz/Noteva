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

**Read every generated migration before applying it.** Prisma does not know about the hand-written SQL and tries to undo it: the `reminders` migration was generated with a `DROP INDEX "instrument_aliases_idx"` on top, which would have killed alias search (« technique vocale » → chant) with no symptom but growing slowness. Generate with `--create-only`, strip what does not belong, then `migrate deploy`.

Tests cover `lib/availability` only, and that's deliberate: it's the one piece of logic whose bugs are invisible by inspection (see below). Don't feel obliged to backfill tests for CRUD routes.

### Environment

`.env.example` lists every variable — `cp .env.example .env` and fill it in. Non-obvious consumers:

- `DATABASE_URL` — read by `prisma.config.ts`, not by `schema.prisma` (see Prisma 7 note below).
- `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` — read by Better Auth itself; they don't appear anywhere in the source.
- `NEXT_PUBLIC_APP_URL` — Better Auth *client* baseURL (`lib/auth-client.ts`) and the Stripe checkout success/cancel URLs. Separate from `BETTER_AUTH_URL`; keep them in sync.
- `NEXT_PUBLIC_STRIPE_PRICE_ID` — fallback read by `/api/stripe/checkout` when `STRIPE_PRICE_ID` is absent. Same **teacher** subscription price; keep them equal or drop this one. (`components/subscription-button.tsx`, its former consumer, went with the boilerplate dashboard.)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — only consumed by `lib/stripe-client.ts`, which nothing imports, so it's currently unused at runtime.

### Database setup

`DATABASE_URL` must point at a PostgreSQL instance — currently a hosted **Neon** database; `docker-compose.yml` also provides a local `postgres:16-alpine`. After changing `prisma/schema.prisma`, run `npx prisma generate` before TypeScript picks up the new client types, then `npx prisma migrate dev`.

Use **`sslmode=verify-full`**, not `sslmode=require`. With `require`, `pg` prints a security warning on every connection, and Next 16's dev overlay surfaces it as a "Console Error" on whatever page happened to open the connection — alarming and unrelated to the page. The warning is real: `pg` currently treats `require` as `verify-full` but will adopt libpq's weaker semantics in v9. Writing the intended mode pins today's behaviour, which is the strict one.

**Prisma 7 has two traps, both already worked around — don't undo them:**

1. **The datasource URL is not in `schema.prisma`.** `prisma.config.ts` is the CLI entrypoint: it declares the schema path, the migrations path, the datasource URL, and does the `import "dotenv/config"` that loads `.env` (Prisma 7 no longer auto-loads it). `datasource db` deliberately has no `url` field; don't "fix" it by adding one. Any script hitting the DB outside the CLI must load dotenv itself.
2. **The runtime client needs a driver adapter.** Prisma 7 dropped the Rust engine *and* the `datasourceUrl` constructor option, so `new PrismaClient()` with no argument throws at instantiation — the app cannot reach the database at all. `lib/prisma.ts` passes `new PrismaPg({ connectionString })` from `@prisma/adapter-pg`. That adapter works against both Neon and the local docker Postgres.

## Architecture

### Auth (Better Auth)

- `lib/auth.ts` — server-side Better Auth instance, wired to Prisma via `prismaAdapter`. Email/password and Google OAuth.
- `lib/auth-client.ts` — browser client (`createAuthClient` from `better-auth/react`); `authClient.useSession()` is how client components read the session.
- `app/api/auth/[...all]/route.ts` — catch-all that mounts Better Auth's handlers; all auth traffic (sign-in, session, OAuth callback) flows through here. **Keep the segment name a valid JS identifier.** It used to be `[...better-auth]`, and the hyphen made Next 16 crash its dev render worker on *every* `/api/auth/*` request ("Jest worker encountered 2 child process exceptions") — a total auth outage that looked like a Better Auth bug rather than a routing one. Renaming a route directory also requires a dev-server restart; hot reload keeps serving 404s.
- Server-side session reads (API routes, server components) go through `auth.api.getSession({ headers: await headers() })` — see `app/api/stripe/checkout/route.ts` and `app/api/user/subscription/route.ts`.

Sign-in lives at **`/connexion`** (`AuthButtons`: Zod-validated email/password plus a Google button). It redirects an already-signed-in user to their own area, which needs the role — so that check is in the page, not the middleware. `authRoutes` in `middleware.ts` is consequently empty; unauthenticated hits on protected routes redirect to `/connexion?callbackUrl=…` (nothing consumes `callbackUrl` yet).

`AuthButtons` is a client component reading the session via `authClient.useSession()`, so `/connexion` server-renders a spinner and fills in after hydration. Fine for a `noindex` page, but don't copy the pattern onto anything public. (Consequence: the "mot de passe oublié" link only exists in the client bundle, not the server HTML.)

**Password reset** is Better Auth's built-in flow, configured in `lib/auth.ts`:

- `POST /api/auth/request-password-reset` → `sendResetPassword` → `/mot-de-passe-oublie`
- the emailed link hits `/api/auth/reset-password/:token`, which validates and redirects to `/reinitialiser-mot-de-passe?token=…` (or `?error=INVALID_TOKEN`)
- `POST /api/auth/reset-password` with `{ newPassword, token }`

Three things to preserve:

- **Better Auth answers `status: true` whether or not the address exists**, and the UI must show the same message either way. Saying "unknown account" would turn the form into a way to learn who has signed up.
- `revokeSessionsOnPasswordReset: true` — a reset often means a compromised account, so sessions open elsewhere must fall. The UI tells the user this, so don't disable it without changing that text. Verified: a session opened before the reset is invalid after.
- `sendResetPassword` is **awaited**, unlike booking notifications. There the email is a side effect; here it *is* the feature — a user who never gets the link is stuck with no way to know.

Tokens are single-use and expire after an hour (`resetPasswordTokenExpiresIn`). Verified: replaying a token, inventing one, or posting a password under 8 characters all return 400.

**`User.role` is nullable on purpose.** With Google OAuth the account is created before the user can say whether they're a teacher or a student, so `POST /api/onboarding` fills it in and creates the matching profile in one transaction. Treat `role === null` as "onboarding incomplete"; don't assume a role is present.

**The role gate is in `app/dashboard/layout.tsx`, not the middleware** — and it has to be. The middleware runs on the edge, sees only the session cookie, and has no Prisma access, so it cannot read a role. Any new signed-in area needs its own Server Component layout doing the same check, or it will be reachable with `role === null`.

Choosing a role is **one-way**: `/api/onboarding` answers 409 once `role` is set. A teacher profile carries a public slug, availability and lesson history that a switch to "student" would orphan. Teacher slugs come from `lib/slug.ts` (accent-stripped, reserved words avoided, `-2`/`-3` on collision) and are unit-tested — they end up in indexed public URLs, so they're painful to change later.

**Route gating is two-layer and both layers are shallow:**
1. `middleware.ts` checks only for the *presence* of the `better-auth.session_token` cookie (no signature/expiry check at the edge). Unauthenticated hits on `protectedRoutes` (`/dashboard`) redirect to `/` with a `callbackUrl` search param — note nothing currently consumes `callbackUrl`.
2. `app/dashboard/page.tsx` is a `"use client"` component that re-checks `authClient.useSession()` and `router.push("/")` if absent.

Real validation only happens server-side in API routes via `auth.api.getSession`. When adding a protected page, update `protectedRoutes` **and** the `matcher` in `middleware.ts`, and don't rely on either layer for authorization of data — guard in the route handler.

This matters more now than it did for the boilerplate: the data is multi-tenant. Every handler touching a booking, a calendar or a profile must check *this user owns this resource*, not merely *this user is logged in* — otherwise any student can read another's lessons through `/api/bookings/[id]`.

### Failures (`lib/http/failure.ts`, `app/error.tsx`)

**Every client fetch goes through `postJson`.** The pattern it replaced ended in `catch { setError("Impossible de contacter le serveur") }` — but that `catch` also caught `response.json()` on a **non-JSON** response (a 500 error page, a failing proxy). The server had answered, and the app said the opposite. A false diagnosis sends the user to check their wifi while the fault is elsewhere.

`describeFailure` is pure and unit-tested; `postJson` is the thin wrapper, tested against a closed port so the network branch is exercised for real. Three distinctions carry everything:

- **Retryable** (network, 5xx) versus not (validation, permission). Offering "réessayer" on a typo makes the user loop.
- **401 is the only case needing to leave the page**, so it gets a link — opening in a **new tab**, because redirecting would discard everything typed. The message says the input is still there, which is the first worry of anyone who just filled a long form. Never auto-redirect on 401 during a submit.
- **The server's message wins when it has one** ("Ce créneau vient d'être réservé" beats any generic phrasing) — *except on 5xx*, where the body often carries an internal trace that helps nobody and informs an attacker.

`localFailure()` gives client-side validation the same shape, so there is one render path (`FormFailure`).

**Validation errors name the field and the bound.** `describeIssues` (`lib/http/validation.ts`) turns Zod issues into a French sentence using the **labels shown on screen** — "Départs de cours toutes les (min) : 240 au maximum." A teacher who typed 1000 used to read "Paramètres invalides" and had ten fields to guess between, while the server knew exactly which one. Zod's own wording is never reused: it is English and speaks of types. A field missing from the route's label map falls back to the generic sentence rather than exposing a column name.

**Boundaries**: `app/error.tsx` (a runtime error used to show Next's default page — an unstyled English "Application error" with no way back), `app/not-found.tsx` (only the teacher-profile route had one), and `app/global-error.tsx` for a failure in the root layout — that one imports nothing and styles inline, because if the stylesheet never loaded a `className` would render nothing.

Two silent failures were fixed along the way: deleting a time-off entry did nothing visible when it failed, and a failed slot load rendered "Aucun créneau disponible cette semaine" — a lie that sends a student away from an available teacher.

### Signed-in chrome

`app/dashboard/layout.tsx` renders `AppHeader` — logo, link to the public search, account menu. It replaced an unstyled band reading "Compte prof" that carried no identity, no way back to the site and no sign-out; the teacher area then stacked a second bar under it, so the app looked like two products glued together. `UserNav` is now **the only** place to sign out: the red button on the old demo dashboard went with it, and an app you cannot leave is not an app.

Anything new behind the login wall goes under this layout. Do not add a second header.

`TeacherTabs` is a Client Component for one reason — marking the current tab needs `usePathname`. Its tab list lives **in the client component**, not in the layout: Lucide icons are components, and a component cannot cross the server→client boundary ("Only plain objects can be passed to Client Components"). The layout passes `pendingCount`, a number.

Sticky save bars (`teacher-profile-form`, `student-profile-form`) are full-width bars with a border and an opaque background, not floating buttons. A bare sticky button sits on top of the content it overlaps and hides the last rows of the form.

**Empty states name the cause and offer the next step.** A new teacher gets no requests because their profile is a draft, incomplete, or unsubscribed — "Aucune demande en attente" alone let them conclude that nobody is looking for lessons. `visibilityBlocker()` in `components/teacher-visibility-notice.tsx` returns what is actually blocking, and the notice appears on `/dashboard` and on an **empty** request inbox only: repeating it to a teacher who already has lessons would be noise. Its order — complete, publish, subscribe — follows the teacher's path and is unit-tested; asking someone with a blank profile to subscribe would make them pay for a page nobody can read. An empty weekly grid says so too: it is publishable but never bookable.

### Teacher area (`/dashboard/prof`)

Self-service profile editing and availability, behind a second Server Component gate (`app/dashboard/prof/layout.tsx`) that checks for a `TeacherProfile`. Every `/api/teacher/*` route acts on **"my" profile** via `requireTeacher()` and accepts no profile id — there is no other profile to reach by mistake, so authorization stays trivial.

- **The booking-rule fields are free numbers, not a dropdown, and that is deliberate.** A 33-minute step works — the engine steps by 33 and yields 9:00, 9:33, 10:06 — it is simply unreadable for a student. But 20 (children's lessons) and 45 are legitimate, and a fixed list would exclude them to prevent a mistake nobody makes on purpose. So the fields stay open and are *accompanied*: bounds written under each one and set on the input, and `previewStarts` (`lib/teacher/slot-preview.ts`) renders the resulting departure times live, before saving. Showing the consequence beats closing the input. The preview works in minutes-since-midnight and ignores DST, which only changes slot counts two days a year — it illustrates, it does not enumerate.

The preview also surfaces a silence found while checking: a lesson longer than the opening yields zero slots, and nothing said why.

`checkPublishable()` in `lib/teacher/publishable.ts` is the **single** publish rule, feeding both the form's "what's missing" list and the `POST /api/teacher/profile/publish` guard. Duplicating it guarantees drift. It only covers completeness — visibility adds the subscription on top.
- `PUT /api/teacher/availability` **replaces the whole weekly grid** rather than exposing per-slot CRUD: the editor manipulates a week as a unit, and an atomic replace avoids incoherent intermediate states.
- Overlapping ranges are **merged, not rejected** (`normalizeWeeklyGrid`). "9am–12pm" then "11am–2pm" is a clear intention; a form that refuses it is just annoying. The editor re-renders what the server kept, not what was typed.
- Exceptions take a bare civil date (`AAAA-MM-JJ`), never an instant — `@db.Date` is stored at UTC midnight, so an instant would shift a teacher west of Greenwich onto the wrong day.

`/dashboard/prof/demandes` is the request inbox. `groupBookings()` in `lib/bookings/grouping.ts` decides the ordering, and the ordering *is* the point: a `PENDING` request holds its slot, so leaving one untreated blocks the teacher's own calendar. Hence pending first, soonest first, and a count badge in the tab. A `PENDING` booking whose time has passed drops to history — it is no longer confirmable.

Dates in the teacher area are always rendered with `timeZone: teacher.timezone`, not the browser's — a teacher travelling must still read their own schedule.

### Student area (`/dashboard/cours`)

The mirror of the teacher inbox, sharing `groupBookings()` — the groups are the same, only their meaning differs (`toReview` is a to-do for the teacher, a wait for the student). Both screens reimplement **no** lifecycle rule: every action goes through `PATCH /api/bookings/[id]` and the state machine decides. The student UI simply doesn't offer what the server would refuse — cancel is their only action, and only before the lesson ends.

A cancellation inside the teacher's `cancellationWindowHours` comes back with `lateCancellation: true`. Nothing is charged (no online payment), so it's surfaced as a notice, not a block.

`/dashboard/cours/profil` edits the student profile, and `lib/student/profile.ts` holds the one rule that matters: **a minor must have a guardian contact**. `checkStudentProfile` feeds both the form's "what's missing" list and the API — same implementation, no drift. Details:

- Age is computed with `getUTC*` because `birthDate` is `@db.Date` (UTC midnight); reading it in server-local time would shift the date a day and flip the age for anyone born on their birthday.
- A missing `birthDate` does **not** presume a minor — defaulting to blocked would stop every adult who skipped the field.
- One contact suffices (email *or* phone): demanding both is excessive for a parent who doesn't read email, demanding neither makes the name useless.

The teacher's inbox shows the level **for the requested instrument only** (`StudentInstrument` is per pair — advanced at piano, beginner at singing), plus goals and, for a minor, the guardian contact. Anything else in the profile is not the teacher's business.

`/dashboard` routes each role to its own area from a single banner. Adding a role-specific area means adding it there too, or it stays URL-only.

### Public pages must be Server Components

Search discovery is how a marketplace lives, so the public surface needs Server Components with `generateMetadata`. A page that reads the session via `authClient.useSession()` renders nothing crawlable — that pattern belongs behind the login wall only, and only where interactivity demands it. Public = RSC.

`app/layout.tsx` sets `metadataBase` (from `NEXT_PUBLIC_APP_URL`) and a title template — without `metadataBase` every canonical and OG image stays relative and unusable to crawlers.

`app/page.tsx` is the landing page and is server-rendered. It lists **only instruments and cities that actually have visible teachers**, queried live, each linking to `/profs?instrument=…` / `?ville=…`. That's what makes those searches crawlable at all, and it's why they're the combinations `isIndexableSearch` allows; linking to empty searches would waste crawl budget and disappoint visitors. `SiteHeader` (a Server Component, so no session flicker) carries navigation on all three public pages.

`/profs/[slug]` is the reference implementation: server-rendered profile with `generateMetadata`, canonical, OpenGraph and `Service` JSON-LD, plus one client island (`BookingWidget`) for slot selection. Slots can't be prerendered — they change on every booking — so the island fetches them on mount while the rest stays crawlable.

**It is rendered on demand, with no cache, deliberately.** Visibility depends on subscription expiry, so a cached page would stay online after it lapses; recomputing per request is the only way a profile disappears exactly when it should. Note that `export const revalidate` alone does **not** make a dynamic route ISR — without `generateStaticParams` it stays `ƒ` (server-rendered on demand), which the build output will tell you. Moving to ISR would mean accepting a staleness window on visibility and driving invalidation from the publish and subscription routes; the `revalidatePath` calls already sitting in `/api/teacher/profile*` are there for that day and are inert until then.

`getPublicTeacher` is wrapped in React `cache()` because `generateMetadata` and the page component both need the profile — without it the query runs twice per render.

### Search (`/profs`)

Server-rendered results with a client island (`SearchFilters`) that holds **no results** — it only rewrites the URL. Filters therefore live in `searchParams`, which makes every search a shareable, crawlable, back-button-correct address. Keep it that way; moving filter state into React would silently kill the SEO rationale for the whole page.

- `visibleTeacherWhere()` sits next to `isTeacherVisible()` in `lib/teacher/visibility.ts` on purpose: search filters in SQL, the profile page checks in JS, and a search returning profiles that then 404 would be worse than no search. Change one, change the other. Verified: expiring a subscription or unpublishing removes the teacher from both at once.
- `buildQueryString` omits defaults so one search has exactly one URL.
- `isIndexableSearch` decides `robots`: instrument and city are indexed (`cours de chant à Lyon` is a real query and there are few such pages), while mode/price/trial/pagination are `noindex` — they multiply near-identical pages.
- An unrecognised instrument term returns **no results** rather than silently dropping the filter, which would bury the student in irrelevant teachers. The page says so explicitly — the term wasn't understood — instead of implying the offer is missing.

**Zero results is three different situations, and they get three different answers** (`hasActiveFilters`, unit-tested): filters applied and nothing matched → suggest widening, with a "voir tous les profs" escape; **no filters at all** → the platform is empty, so telling the student to widen a search they never narrowed blames them for a supply problem, and the call to action addresses teachers instead; term not recognised → name the term. Pagination doesn't count as a filter: page 2 of an unfiltered search is still unfiltered.

The instrument chips only list instruments that are actually taught, so the block is **not rendered at all** when empty — it used to leave an "Instrument" heading followed by nothing.

**Known limitation:** instruments are flat. Searching `guitare` matches the `guitare` instrument only — a teacher listed under `guitare-electrique` will not appear. Defensible (they are distinct instruments) but probably not what a student expects; fixing it means a parent/family relation in the schema, not fuzzier matching, which would wreck precision elsewhere.

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
- **The grid is anchored on the teacher's *openings*, and stepped by `TeacherProfile.slotGranularityMin`** — never on the free intervals, and never on the lesson duration. Bookings, buffer, minimum notice and horizon *remove* candidates; they never move the grid. This is the load-bearing property, and it was learned from a real report: anchored on the free interval, Monday 9–13 with 60-min lessons, a 30-min buffer and one booking at 9:00 offered 10:30 and 11:30 — the whole day shifted, and 11:00 was free but never offered. Worse, the anchor depended on `now` through the minimum-notice clamp, so two calls seconds apart could return different start times and a slot could go stale between the student's click and their request landing.
  Because the grid no longer moves, it is reproducible — which is what lets the **booking route enforce it**. `/api/bookings` re-derives with the same `granularityMin`, so a hand-crafted `POST` at 10:47 is refused with 409 even though that minute is free. Before, the re-derivation clamped the window to the requested slot exactly, so any free instant produced a slot and passed. Verified end to end: 10:47 and 9:30 refused, 10:00 accepted, 14:00 (outside the opening) refused.
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

### Reviews (`lib/reviews`)

**A review hangs off a booking, never off a teacher.** `Review.bookingId` is unique, so a review can only exist where a lesson was booked, confirmed, and closed by the teacher. A free-form rating on a profile could be bought or fabricated; this one cannot. That single foreign key is the whole trust model — don't add a path that creates a review without one.

`checkReviewable` in `lib/reviews/eligibility.ts` is the **single** rule, feeding the student's screen and `POST /api/reviews` alike. Pure, `now` injected. Order matters and is asserted by a test: **ownership is checked first**, because answering "that lesson isn't finished" to a stranger already confirms the id exists. The route turns `not_participant` into 404, everything else into 409.

- `COMPLETED` only. `NO_SHOW` is excluded on purpose — rating a lesson nobody attended measures nothing.
- **Reviews close 60 days after the lesson** (`REVIEW_WINDOW_DAYS`). Not a technical limit: a year-old review says little about today's teacher, and a window that never shuts turns history into permanent leverage.
- The unique constraint on `bookingId` is what actually arbitrates two simultaneous submissions; the application check has a race window, exactly like the booking overlap constraint. `isUniqueViolation()` matches on the message for the same reason `overlapConflict()` does — the driver adapter exposes no usable error code.

**Averages are derived, never stored**, by the same reasoning as teacher visibility: a denormalised column must be resynchronised on every write, and the day one resync is missed a profile shows a wrong rating with nothing to signal it. `lib/reviews/queries.ts` filters on `publishedAt: { not: null }` everywhere — a pending review that still counted toward the average would make moderation look active while being inert. `getRatingSummaries` takes a page of teacher ids in **one** `groupBy`; per-teacher aggregates in search would be twenty queries.

**The teacher can reply, never edit or delete.** `PATCH /api/reviews/[id]` writes `teacherRepl` only, through a `updateMany` conditioned on ownership so that "not yours" and "doesn't exist" are the same 404. A platform where the rated party can erase the rating is worthless to the student reading it; the public reply is the honest counterweight, and the `review_received` email is what makes it usable — without it a teacher would discover the review by chance.

`aggregateRating` is emitted in the profile's JSON-LD **only when reviews exist**. An `aggregateRating` with no reviews is a manual-action risk with search engines, not a cosmetic detail.

### Notifications (`lib/notifications`)

All the logic — who gets told, of what, in what words — lives in `templates.ts` as pure functions, so it's tested without a provider. `send.ts` is a thin adapter: one hand-rolled `fetch` to Resend, no SDK for a single call.

- **Never notify the actor.** `buildNotification` takes who performed the action and returns `null` when the only candidate recipient is that same person. A test asserts this across every event × actor combination.
- **Times are always the teacher's timezone**, for both recipients. A lesson happens at one hour; showing each party a different one produces missed lessons.
- `notifyInBackground` is deliberately **not awaited** and never throws: a booking is valid whether or not the email goes out, and an HTTP response shouldn't wait on a third party. Failures are logged, not propagated.
- `complete`/`no_show` send nothing — both parties were at the lesson.
- `review_received` goes to the teacher. It is the one notification whose absence would break a feature rather than merely inconvenience: the right of reply is worthless if the teacher never learns a review exists.
- Without `RESEND_API_KEY` + `NOTIFICATIONS_FROM`, messages go to the console. Dev works with no provider account, and you see exactly what would have been sent.
- Links are built from `NEXT_PUBLIC_APP_URL`; in production it must be the real public URL or every email links to localhost.

Reminders live apart, in `lib/notifications/reminders.ts`, and that separation is deliberate. Everywhere else a notification follows an action and the invariant is *never notify the actor*. A reminder has **no actor** — the clock fires it, and both parties must be told. Folding it into `buildNotification` would mean inventing a fake actor and weakening an invariant a test asserts across every other event. Hence a different signature: `buildReminders` returns **two** notifications, not one.

### Lesson reminders (`lib/reminders`, `/api/cron/reminders`)

Nothing in a Next app survives between requests, so there is no in-process scheduler: `/api/cron/reminders` is an HTTP entry point that any scheduler can hit (Vercel Cron, a GitHub Action, `curl` in a crontab). Accepts `GET` as well as `POST` — several schedulers only emit the former.

**Authentication is `CRON_SECRET`, and the route refuses to run without it** (503, logged). A quietly-open cron route is worse than a broken one, because nothing about it looks wrong. Both `Authorization: Bearer` (Vercel's format) and `x-cron-secret` are accepted.

**The window is open at the bottom** — every `CONFIRMED` lesson starting in `(now, now + 24h]` that has no reminder yet, not "lessons starting in 24h ± a few minutes". Targeting the instant assumes the job always runs on time; one twenty-minute outage and the lessons that fell in the gap are never reminded, with nothing having failed. With an open window a job that missed six hours catches up on its next pass, so **the frequency only affects freshness** — fifteen minutes or one hour give the same result.

**Claim first, send second.** `BookingReminder` has `@@unique([bookingId, kind])`, and inserting the row *is* the claim — the database arbitrates the race between overlapping passes, not an application check with a window (same reasoning as `booking_teacher_no_overlap` and `Review.bookingId`). If both sends then fail, the claim is **deleted** so the next pass retries. A partial failure keeps the claim: re-sending to the party who did receive it is worse than leaving the other without. The residual risk is a duplicate if the process dies between a successful send and returning — accepted, and the cheaper of the two failure modes. Verified: five simultaneous passes over one lesson produce one claim and two emails, not ten.

Unlike booking notifications, sends here are **awaited** — the job's return value (`sent`/`failed`/`skipped`) is how an operator knows it works, and `notifyInBackground` would discard it.

Reminders never say "demain": a lesson confirmed three hours ahead also falls inside the window, and the word would be false. The date and time always are true.

`ReminderKind` is an enum with a single value (`H24`) so a second deadline needs no migration.

### Two guards on writes

Writing a booking needs **two** guards, and neither replaces the other: re-derive availability server-side (a client can POST any timestamp — the constraint stops overlaps, not 3am on a Sunday, and not 10:47 on a teacher who only teaches on the hour), then let the constraint arbitrate the race that re-derivation cannot see. Verified: six concurrent requests for one slot produce exactly one booking, one constraint-driven 409, and four re-validation 409s.

The re-derivation only checks the grid because the grid is stable — see the slot engine above. Pass the teacher's `slotGranularityMin` here and in the public availability route, or the two disagree and the UI offers slots the API then refuses.

### Payments (Stripe) — teachers only

The Stripe integration bills **teachers** for platform access. All four `stripe*` fields live on `TeacherProfile`, not `User`. Students never touch Stripe.

Teacher visibility is **derived at read time**, never stored: `lib/teacher/visibility.ts` (`isTeacherVisible`) is the single implementation, used by the public availability route, booking creation and the teacher area. A lapsed subscription hides the profile with no webhook writing a `SUSPENDED` state — nothing to resynchronize. Don't reinline the check; it drifts.

Publishing and being visible are **separate**: a teacher without a subscription can complete and publish a profile, and it appears the moment they subscribe.

- `app/api/stripe/checkout/route.ts` — subscription Checkout for the signed-in teacher. **The price comes from `STRIPE_PRICE_ID` server-side.** It used to be read from the request body, which let anyone subscribe at a price of their choosing; don't reintroduce a client-supplied price. Reuses `stripeCustomerId` when present — passing `customer_email` every time creates a fresh Stripe customer per attempt and scatters the billing history. 409s if a subscription is already active.
- `app/api/stripe/portal/route.ts` — Billing Portal session. Cancellation, card changes and invoices are delegated to Stripe rather than rebuilt; the portal never writes to the DB, the resulting webhook does.
- `app/api/webhooks/stripe/route.ts` — state is tracked from `customer.subscription.created/updated/deleted`, which carry the whole subscription in the payload. No `subscriptions.retrieve()` round-trip, so one less failure mode, and the handler is testable with locally signed events. `checkout.session.completed` does one job only: attach `stripeCustomerId` to the profile via `metadata.userId`. It deliberately does *not* write subscription state — `subscription.created` can arrive first, and writing in both places risks an out-of-order overwrite. Unhandled events return 200; a 4xx/5xx would make Stripe retry forever.
- `lib/stripe/subscription.ts` — pure mapping from a `Stripe.Subscription` to the profile columns, unit-tested. Two traps it encodes: the period end lives on `items.data[0]` in API v20, not on the subscription; and a `canceled`/`unpaid` subscription must **null out** `stripeCurrentPeriodEnd`, or the profile stays visible until an already-paid period expires. `past_due` deliberately keeps access — Stripe retries for days and cutting a teacher off on the first card failure would be brutal.
- `app/api/user/subscription/route.ts` — read-only endpoint deriving `isActive`. Returns `isActive: false` rather than 404 for a user with no teacher profile (i.e. every student).
- `lib/stripe.ts` — the client, keyed on **`STRIPE_SECRET_KEY`**. The boilerplate read `STRIPE_API_KEY`, a name present in no `.env`; the `new Stripe(undefined!)` then threw *at module evaluation*, i.e. before the `try` in every route, so `/api/stripe/*` answered a 500 HTML error page instead of their JSON. Nothing caught it because no Stripe call had ever run. The module now fails fast with a message naming the variable.
- `lib/stripe-client.ts` (`loadStripe`) and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are **unused** boilerplate leftovers — checkout is a plain redirect to the URL the server returns.

**Verified against real Stripe in test mode**, with `stripe listen` relaying genuine events — not hand-written payloads, which is what makes it worth something: a payload I shape myself has the shape I expect by construction, so it cannot catch a mapping error. A real subscription on a real customer produced `stripeCurrentPeriodEnd` exactly one month out, confirming the `items.data[0].current_period_end` reading against an actual API v20 response. Also verified: `checkout.sessions.create` returns a real `cs_test_…` session, `billingPortal.sessions.create` a real portal URL, `/api/stripe/portal` 409s while no customer exists, a published+subscribed profile answers 200 and **the same profile answers 404 within seconds of the subscription being cancelled** — the derived-visibility rule closing the loop. Fifteen live webhook deliveries, all 200, none unmatched. A forged signature is rejected with 400.

**Still unexercised: the hosted Checkout page itself** — completing it requires entering a card, so the only simulated step is `checkout.session.completed` attaching `stripeCustomerId` (locally-signed events cover that handler). Local webhooks need `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, whose `whsec_` differs from a Dashboard endpoint's; `STRIPE_WEBHOOK_SECRET` must match whichever one is actually delivering, and the dev server must be restarted after changing it.

### State management convention

- **Server state** (anything backed by an API/DB — subscription status, user data) → TanStack Query. `components/providers.tsx` creates one `QueryClient` (1 min `staleTime`, no refetch-on-focus) wrapping the app in `app/layout.tsx`.
- **UI-only state** (not persisted, not fetched) → Zustand. `lib/store.ts` holds only sidebar-open state; keep it scoped to ephemeral UI concerns rather than mirroring server data.

### Design system

`app/globals.css` holds every colour, radius and shadow as a **semantic token** (`--surface`, `--primary`, `--muted`…), exposed to Tailwind through `@theme inline`. Components say `bg-surface`, never `bg-zinc-50` — changing the identity means editing the tokens, not the components.

**Light theme only, by decision.** There is no `prefers-color-scheme` block and there are **no `dark:` variants anywhere** — adding one would be dead code. `:root` sets `color-scheme: light`, which is what stops a browser in dark mode from tinting native controls (date pickers, selects, checkboxes) into something that clashes with the page.

Typography: Geist for body, **Bricolage Grotesque for `h1`–`h3` only**, wired through `--font-sans-custom` / `--font-display`. Note the boilerplate had a bug worth not reintroducing — `globals.css` hardcoded `font-family: Arial` on `body`, silently overriding the font `next/font` had loaded.

Two Tailwind 4 traps this codebase already hit:

- **A bare custom property in an arbitrary value is invalid.** `rounded-` followed by `[--radius]` compiles to `border-radius: --radius` and silently yields square corners; wrap it in `var()`.
- **Never put a comma-bearing value in an arbitrary class.** A `bg-` arbitrary value holding a `radial-gradient(...)` with commas makes the scanner split at the commas and invent a bogus utility from the fragment, which then emits unparseable CSS. Use an inline `style` for gradients.
- **Tailwind scans this file too.** Writing one of those broken class names verbatim in any non-ignored file — source, comment, or Markdown — is enough for the scanner to pick it up and regenerate the invalid rule. That is why the examples above are described rather than quoted.
- Native checkbox/radio tint uses the hand-written `.accent-primary` class in `globals.css` for the same reason.

**Don't add a configurable `distDir`.** It looks like an easy way to run a second dev server alongside the first, and it was tried: an alternate build directory is ignored by neither Tailwind's scanner nor eslint, so both start reading compiled artifacts — Tailwind emits invalid CSS from hallucinated class names, eslint reports hundreds of errors in generated chunks. To run a second server, stop the first. `/.next-*/` stays in `.gitignore` as a safety net.

### UI components

`components/ui/*` are shadcn/ui-style primitives (Radix + `class-variance-authority` + `tailwind-merge`, composed via `cn()` in `lib/utils.ts`). Extend these rather than adding another component library. They have been **rewritten onto the tokens** and carry non-stock variants — `success` and `accent` on `Button`, `success`/`warning`/`accent` on `Badge` — so read the `cva` config before assuming upstream shadcn behaviour. Badges are soft-tinted on purpose: they annotate, they don't compete with buttons.

The pink `--accent` is deliberately **rare** — currently the hero underline alone. Spending it everywhere would make it stop meaning anything.

### Path aliases

`@/*` maps to the repo root (`tsconfig.json`), e.g. `@/lib/auth`, `@/components/ui/button`.

## Current state

The schema is migrated and applied, but the app on top of it is still the boilerplate. Concretely:

- `prisma/seed.ts` (run via `tsx`, declared in `prisma.config.ts`) holds 37 instruments across the 8 families, with search aliases. Seeded and idempotent.
**Both loops are closed end to end through the UI**, verified against the database: a teacher onboards → fills the profile → sets a weekly grid → publishes → receives requests → confirms/declines/closes; a student searches → books → follows the status → cancels.

What is missing:

- **Only the hosted Checkout page is untested**, because completing it requires entering a card. Everything around it now runs against real Stripe in test mode — see the Payments section.
- The signed-in area, the empty states and the failure paths were reviewed on screen — the last against a fabricated expired session, with the typed form content verified intact afterwards. Still **not** reviewed on screen: `/onboarding`, `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe`.
- No dedicated instrument/city landing pages, but `/profs?instrument=…` is now linked from the home page and indexable, which covers the need for now.
- `StudentProfile.preferredGenres` and `prefersOnline` are stored but never read; `postalCode` has no UI.
- Email notifications fire on request/confirm/decline/cancel/review and 24h before a lesson. `RESEND_API_KEY` is set, but **the Resend account has no verified domain**, so delivery is restricted to the account owner's own address and every other recipient comes back 403. Verify a domain before this counts as working in production.
- **Nothing schedules `/api/cron/reminders` yet.** The endpoint, the claim table and the retry path are built and verified; wiring an actual scheduler to it is a deployment step, not a code one.
- Reviews are **published without moderation**: `publishedAt` is set at creation. The column stays as the hook for a future queue, but until a moderation screen exists, being born `null` would mean no review ever appears. See the Reviews section.
- **Search is still ranked by `publishedAt`, not by rating.** Now that a quality signal exists it is tempting, but a lone 5★ would outrank forty averaging 4.8 — it needs a Bayesian prior first (pull each teacher toward the site mean in inverse proportion to their review count).
- `npm run lint`, `npx tsc --noEmit`, `npm test` and `npm run build` are all clean. Keep them that way.

## Docker

`Dockerfile` is a multi-stage build producing Next.js `standalone` output (`next.config.ts` sets `output: "standalone"`); it runs `prisma generate` at build time and copies `prisma/` into the final image so migrations can run at runtime. `docker-compose.yml` wires the app container to a local `postgres` service — it overrides `DATABASE_URL` to the `db` service host, so that value wins over whatever is in `.env`.

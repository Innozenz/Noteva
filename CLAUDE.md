# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This is a Next.js 16 (App Router) SaaS boilerplate: Better Auth for authentication, Prisma + PostgreSQL for the database, and Stripe for subscription payments. It's meant to be forked as a starting point, not a finished product — `app/page.tsx` is a marketing/demo page showcasing the included features.

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build (standalone output)
npm run start    # run production build
npm run lint     # eslint (flat config, eslint-config-next)

npx prisma generate   # regenerate Prisma client after schema changes
npx prisma db push    # push schema.prisma to the database (no migration files)
```

There is no test suite configured in this repo.

### Database setup

`DATABASE_URL` must point at a running PostgreSQL instance (see `docker-compose.yml` for a local `postgres:16-alpine` service). After changing `prisma/schema.prisma`, run `npx prisma generate` before TypeScript will pick up the new client types, then `npx prisma db push`.

## Architecture

### Auth (Better Auth)

- `lib/auth.ts` — server-side Better Auth instance, wired to Prisma via `prismaAdapter`. Configures email/password and Google OAuth (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`).
- `lib/auth-client.ts` — browser client (`createAuthClient`) used by client components (e.g. `components/auth-buttons.tsx`).
- `app/api/auth/[...better-auth]/route.ts` — catch-all route that mounts Better Auth's handlers; all auth traffic (sign-in, session, OAuth callback) flows through here.
- Session reads in server code (API routes, server components) go through `auth.api.getSession({ headers: await headers() })` — see `app/api/stripe/checkout/route.ts` and `app/api/user/subscription/route.ts` for the pattern.
- `middleware.ts` gates routes by presence of the `better-auth.session_token` cookie only (no signature/expiry check at the edge — real validation happens server-side via `auth.api.getSession`). `protectedRoutes` currently covers `/dashboard`; `authRoutes` (`/login`, `/register`) redirect an already-authenticated user to `/dashboard`. Update the `matcher` in `middleware.ts` alongside `protectedRoutes`/`authRoutes` when adding new protected pages.

### Database (Prisma)

- Single schema at `prisma/schema.prisma`, PostgreSQL provider. Core models: `User`, `Session`, `Account`, `Verification` (Better Auth's expected shape — do not rename fields/tables without also adjusting the Better Auth adapter config), plus Stripe fields (`stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `stripeCurrentPeriodEnd`) added directly on `User`.
- `lib/prisma.ts` exports a singleton `PrismaClient`, cached on `globalThis` in non-production to survive Next.js dev hot-reload.
- No migration history is checked in yet — schema changes are applied with `prisma db push`, not `prisma migrate`.

### Payments (Stripe)

- `lib/stripe.ts` — server-side Stripe SDK client (`STRIPE_API_KEY`).
- `lib/stripe-client.ts` — lazily-loaded `@stripe/stripe-js` client for redirecting to Checkout (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`).
- `app/api/stripe/checkout/route.ts` — creates a Checkout Session for the authenticated user (subscription mode), stamping `userId` into `metadata` so the webhook can attribute the resulting subscription back to a `User`.
- `app/api/webhooks/stripe/route.ts` — verifies the Stripe signature (`STRIPE_WEBHOOK_SECRET`) and handles `checkout.session.completed` (initial subscription attach) and `invoice.payment_succeeded` (period renewal); both write subscription state onto `User`. When adding new subscription lifecycle behavior (cancellation, plan change, etc.), extend this handler rather than polling Stripe elsewhere.
- `app/api/user/subscription/route.ts` — read-only endpoint deriving `isActive` from `stripeCurrentPeriodEnd > now()`; there's no separate subscription-status cache/store, this is the source of truth for the client.

### State management convention

- **Server state** (anything backed by an API/DB — subscription status, user data) → TanStack Query. `components/providers.tsx` sets up a single `QueryClient` (1 min `staleTime`, no refetch-on-focus) wrapping the app in `app/layout.tsx`.
- **UI-only state** (not persisted, not fetched) → Zustand. `lib/store.ts` currently holds only sidebar-open state; keep it scoped to ephemeral UI concerns rather than mirroring server data.

### UI components

`components/ui/*` are shadcn/ui-style primitives (Radix UI + `class-variance-authority` + `tailwind-merge`, composed via `lib/utils.ts`'s `cn()`). Extend these rather than reaching for a new component library. Styling is Tailwind CSS 4 (see `postcss.config.mjs`); animations use Framer Motion (see `app/page.tsx`).

### Path aliases

`@/*` maps to the repo root (`tsconfig.json`), e.g. `@/lib/auth`, `@/components/ui/button`.

## Docker

`Dockerfile` is a multi-stage build producing a Next.js `standalone` output (`next.config.ts` sets `output: "standalone"`); it runs `prisma generate` at build time and copies `prisma/` into the final image for running migrations at runtime. `docker-compose.yml` wires the app container to a local `postgres` service — note it overrides `DATABASE_URL` to point at the `db` service host rather than using the value from `.env`.

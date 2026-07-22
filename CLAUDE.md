# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Next.js 16 (App Router) SaaS boilerplate: Better Auth for authentication, Prisma 7 + PostgreSQL for the database, Stripe for subscription payments. It's meant to be forked as a starting point, not a finished product — `app/page.tsx` is a marketing/demo page that showcases the included features *and* doubles as the sign-in page.

User-facing copy is in **French** (including `toLocaleDateString("fr-FR", …)` calls); match that when editing existing UI.

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

### Environment

`.env.example` lists every variable — `cp .env.example .env` and fill it in. Non-obvious consumers:

- `DATABASE_URL` — read by `prisma.config.ts`, not by `schema.prisma` (see Prisma 7 note below).
- `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` — read by Better Auth itself; they don't appear anywhere in the source.
- `NEXT_PUBLIC_APP_URL` — Better Auth *client* baseURL (`lib/auth-client.ts`) and the Stripe checkout success/cancel URLs. Separate from `BETTER_AUTH_URL`; keep them in sync.
- `NEXT_PUBLIC_STRIPE_PRICE_ID` — fallback price in `components/subscription-button.tsx` when no `priceId` prop is passed.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — only consumed by `lib/stripe-client.ts`, which nothing imports, so it's currently unused at runtime.

### Database setup

`DATABASE_URL` must point at a running PostgreSQL instance (see `docker-compose.yml` for a local `postgres:16-alpine` service). After changing `prisma/schema.prisma`, run `npx prisma generate` before TypeScript picks up the new client types, then `npx prisma db push`.

**Prisma 7 specifics:** `prisma.config.ts` is the CLI entrypoint — it declares the schema path, the migrations path, and the datasource URL, and it does the `import "dotenv/config"` that loads `.env`. `datasource db` in `schema.prisma` deliberately has no `url` field; don't "fix" it by adding one. Prisma 7 no longer auto-loads `.env`, so any script that touches the database outside the CLI needs dotenv loaded itself.

## Architecture

### Auth (Better Auth)

- `lib/auth.ts` — server-side Better Auth instance, wired to Prisma via `prismaAdapter`. Email/password and Google OAuth.
- `lib/auth-client.ts` — browser client (`createAuthClient` from `better-auth/react`); `authClient.useSession()` is how client components read the session.
- `app/api/auth/[...better-auth]/route.ts` — catch-all that mounts Better Auth's handlers; all auth traffic (sign-in, session, OAuth callback) flows through here.
- Server-side session reads (API routes, server components) go through `auth.api.getSession({ headers: await headers() })` — see `app/api/stripe/checkout/route.ts` and `app/api/user/subscription/route.ts`.

**There are no `/login` or `/register` pages.** Sign-in/sign-up is the `AuthButtons` client component rendered inline on `app/page.tsx`, with Zod-validated email/password fields plus a Google button. `middleware.ts` lists `/login` and `/register` in `authRoutes` and in its `matcher`, but those routes 404 today — the entries are placeholders for when dedicated pages get added.

**Route gating is two-layer and both layers are shallow:**
1. `middleware.ts` checks only for the *presence* of the `better-auth.session_token` cookie (no signature/expiry check at the edge). Unauthenticated hits on `protectedRoutes` (`/dashboard`) redirect to `/` with a `callbackUrl` search param — note nothing currently consumes `callbackUrl`.
2. `app/dashboard/page.tsx` is a `"use client"` component that re-checks `authClient.useSession()` and `router.push("/")` if absent.

Real validation only happens server-side in API routes via `auth.api.getSession`. When adding a protected page, update `protectedRoutes` **and** the `matcher` in `middleware.ts`, and don't rely on either layer for authorization of data — guard in the route handler.

### Database (Prisma)

- Single schema at `prisma/schema.prisma`, PostgreSQL. Core models `User`, `Session`, `Account`, `Verification` match Better Auth's expected shape and are `@@map`ped to lowercase table names — don't rename fields or mappings without adjusting the Better Auth adapter config. Stripe fields (`stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `stripeCurrentPeriodEnd`) hang directly off `User`; `stripeSubscriptionId` is `@unique` because the webhook looks users up by it.
- `lib/prisma.ts` exports a singleton `PrismaClient`, cached on `globalThis` outside production to survive dev hot-reload.
- No migration history is checked in — schema changes are applied with `prisma db push`, not `prisma migrate`.

### Payments (Stripe)

- `lib/stripe.ts` — server-side Stripe SDK client.
- `app/api/stripe/checkout/route.ts` — creates a subscription-mode Checkout Session for the authenticated user, stamping `userId` into `metadata` so the webhook can attribute the subscription back to a `User`. Returns `{ url }`; the client does a plain `window.location.href` redirect (`components/subscription-button.tsx`).
- `lib/stripe-client.ts` (`loadStripe`) exists but is **not imported anywhere** — it's leftover scaffolding for a `redirectToCheckout` flow the app doesn't use.
- `app/api/webhooks/stripe/route.ts` — verifies the Stripe signature and handles `checkout.session.completed` (initial attach, matched by `metadata.userId`) and `invoice.payment_succeeded` (renewal, matched by `stripeSubscriptionId`). Both read the period end off `subscription.items.data[0].current_period_end` — the Stripe v20 API shape, where the field lives on the item rather than the subscription. Extend this handler for new lifecycle behavior (cancellation, plan change) rather than polling Stripe elsewhere.
- `app/api/user/subscription/route.ts` — read-only endpoint deriving `isActive` from a non-null `stripeSubscriptionId` plus `stripeCurrentPeriodEnd > now()`. There's no separate subscription cache; this is the source of truth for the client.

### State management convention

- **Server state** (anything backed by an API/DB — subscription status, user data) → TanStack Query. `components/providers.tsx` creates one `QueryClient` (1 min `staleTime`, no refetch-on-focus) wrapping the app in `app/layout.tsx`.
- **UI-only state** (not persisted, not fetched) → Zustand. `lib/store.ts` holds only sidebar-open state; keep it scoped to ephemeral UI concerns rather than mirroring server data.

### UI components

`components/ui/*` are shadcn/ui-style primitives (Radix + `class-variance-authority` + `tailwind-merge`, composed via `cn()` in `lib/utils.ts`). Extend these rather than adding another component library. Note some carry **non-stock variants** added for this project — e.g. `variant="success"` on both `Button` and `Badge` — so check the `cva` config before assuming upstream shadcn defaults. Styling is Tailwind CSS 4 (`postcss.config.mjs`); animations use Framer Motion (`app/page.tsx`, `app/dashboard/page.tsx`).

### Path aliases

`@/*` maps to the repo root (`tsconfig.json`), e.g. `@/lib/auth`, `@/components/ui/button`.

## Docker

`Dockerfile` is a multi-stage build producing Next.js `standalone` output (`next.config.ts` sets `output: "standalone"`); it runs `prisma generate` at build time and copies `prisma/` into the final image so migrations can run at runtime. `docker-compose.yml` wires the app container to a local `postgres` service — it overrides `DATABASE_URL` to the `db` service host, so that value wins over whatever is in `.env`.

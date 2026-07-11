# TradeShield

A B2B escrow marketplace for Ghana connecting buyers (retailers/traders) and suppliers (wholesalers) — orders move through an explicit escrow state machine from order placement to payment, shipping, delivery confirmation, and fund release.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/` — DB schema, one file per table: `users`, `otpCodes`, `products`, `orders`, `transactions`, `ratings`, `disputes`.
- `artifacts/api-server/src/lib/orderStateMachine.ts` — pure module defining every legal order-status transition. All route/webhook code must go through `canTransition`/`applyTransition` here instead of writing `status` directly.
- `artifacts/api-server/src/lib/paymentOrchestration.ts` — initiates collection/disbursement with reference-first idempotency.
- `artifacts/api-server/src/lib/webhookHandlers.ts` — idempotent webhook/polling outcome application.
- `artifacts/api-server/src/lib/paymentReconciliation.ts` — polling fallback for stuck `payment_processing` / `payout_processing` orders.
- `lib/api-spec/openapi.yaml` — API contract (to be filled in as endpoints are built).

## Architecture decisions

- Originally specced as Next.js + Supabase; built instead on this workspace's native stack (React + Vite frontend, Express 5 API, Postgres + Drizzle) to match the platform's tooling — same data model and product behavior, different framework plumbing.
- Order status lives only in `orders.status` (a Postgres enum) and is only ever changed via the state-machine module — never inferred from timestamps or other columns.
- Payment integration (Moolre Collections/Disbursement) is fully behind the `PaymentProvider` interface; set `MOOLRE_API_KEY` + `MOOLRE_API_SECRET` to swap in `MoolrePaymentProvider`, otherwise `MockPaymentProvider` is used.
- Collections and disbursements never finalize on the synchronous API response — only webhooks (`/api/webhooks/payments`, `/api/webhooks/disbursements`, plus `/api/webhooks/moolre/*` aliases) or the polling reconciliation job may move an order to `in_escrow` or `completed`.
- Disbursement uses a `payout_processing` sub-state (parallel to `payment_processing`) between `shipped` and `completed`.
- Platform references (`ORDER-{id}-PAY-{n}`, `ORDER-{id}-PAYOUT-{n}`) are written to `transactions` before the provider call.
- OTP-based auth is mocked for the MVP via an `otp_codes` table (phone + code + expiry) rather than a real SMS provider — swappable later without changing the auth flow shape.
- 72-hour delivery auto-confirmation must be enforced by a server-side scheduled job reading `orders.auto_release_at`, not a client-side timer.

## Product

- **Core loop:** buyer browses supplier catalog → creates order → supplier accepts/rejects → buyer pays (escrow) → supplier ships → buyer confirms receipt (or 72h auto-release) → funds release to supplier → both parties rate the transaction.
- **Roles:** buyer, supplier, or both (per user record).
- **Admin:** views all orders by status, can manually force a dispute resolution (status transition) — the only actor allowed to move an order out of `disputed`.
- Out of scope for this build: AI fraud detection, cross-border support, USSD, supplier financing.

## User preferences

- July 13, 2026 competition deadline — prioritize a fully working core loop over feature breadth.

## Gotchas

- Always route order-status changes through `orderStateMachine.ts` — direct `db.update(ordersTable).set({ status: ... })` calls bypass the only validation that prevents illegal transitions.
- Payment-related transitions must be idempotent — webhooks (mock and real) can be delivered more than once for the same reference.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

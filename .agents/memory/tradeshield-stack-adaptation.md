---
name: TradeShield stack adaptation
description: Why TradeShield runs on the workspace-native stack instead of the originally-requested Next.js + Supabase stack.
---

The initial product brief for TradeShield (B2B escrow marketplace) specified Next.js (App Router) + Supabase (auth/Postgres/storage) + TanStack Query + Zustand. The project was built instead on this workspace's native stack: React + Vite frontend, Express 5 API server, Postgres + Drizzle ORM, Zod validation, Orval-generated API hooks.

**Why:** the Replit pnpm-workspace template is pre-wired for React+Vite/Express/Drizzle (dev server, codegen, DB push, artifact routing all assume this shape). Introducing Next.js + Supabase would fight the platform's tooling rather than use it, with no product benefit for an MVP — the data model, order state machine, and payment-adapter pattern are framework-agnostic and translate directly.

**How to apply:** if resuming or extending TradeShield, keep using the native stack (do not reintroduce Next.js or Supabase) unless the user explicitly asks to migrate. Auth uses a mocked phone/OTP flow via an `otp_codes` table + server sessions, not Supabase Auth.

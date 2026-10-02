# Smart Grocery AI Implementation Plan

**Goal:** Incrementally upgrade the existing MERN grocery platform with verified checkout, inventory intelligence, grounded AI shopping, recommendations, delivery decision support, and a polished demo.

**Architecture:** Preserve the `client/` React app and `server/` Express/Mongoose monolith. MongoDB remains authoritative; Redis and BullMQ are optional infrastructure with graceful degradation; all AI outputs pass through strict schemas and application services before database access or UI use.

**Tech Stack:** Existing React/Vite/Tailwind, Express 5, Mongoose 8, Socket.IO, MongoDB, Redis, BullMQ; Node built-in tests; OpenAI-compatible HTTP API behind a provider interface. Avoid new services unless a requirement cannot be met in the monolith.

**Spec:** User-provided Smart Grocery AI brief (attachment 654de63c-1564-4058-a60d-fc2ec1576d3d) and expanded continuation brief (attachments 6f59af5e-edce-4ebe-9ba8-07278cd219e0 and 76b88080-47a6-40ab-a546-cc00f4312358).

## Global Constraints

- Preserve the existing `client/` and `server/` organization and customer/admin/delivery workflows.
- Keep checkout transactional and authoritative to MongoDB; validate stock and prices server-side.
- Never trust model-generated products, prices, stock, order details, permissions, or database queries.
- Keep AI optional; basic catalog, cart, checkout, and delivery continue without provider availability.
- Keep new DB fields optional/backward-compatible and add indexes only for actual query shapes.
- Treat historical forecasts as insufficient when order history does not meet the documented minimum.
- Do not log secrets, addresses, tokens, or unnecessary personal data.
- Do not start Redis or a worker as a prerequisite for basic HTTP shopping.

## Review Focus

- MongoDB transaction retries and concurrent writes: every retry must recompute stock and only emit events after commit.
- LLM malformed, unsafe, or provider-timeout output: reject schema errors and fall back without broadening database access.
- Cold-start customers and sparse order history: recommendations/forecasts must return explicit no-history states.
- Redis or worker outage: synchronous core flows and direct database reads must still operate.
- Multiple users and role changes over sockets: only public stock may broadcast globally; order/delivery events must use scoped authenticated rooms.

## File Map

- `server/src/ai/**`: provider adapter, structured intent schemas, grounded assistant and admin tools.
- `server/src/analytics/**`: recommendation, substitution, forecast, and delivery scoring functions.
- `server/src/jobs/**` and `server/src/workers/**`: optional queue wiring and idempotent background handlers.
- `server/src/services/**`, `controllers/**`, `routes/**`, `models/**`: existing API/business boundaries and optional fields.
- `server/src/config/**`, `middleware/**`, `socket/**`: environment, cache/queue readiness, auth, logging, and event isolation.
- `client/src/pages/**`, `components/**`, `context/**`: customer assistant/recommendation flow, admin inventory views, delivery views, and shared UI.
- `server/test/**`, `client/src/**/__tests__/**`: regression coverage.
- `docker-compose.yml`, `.env.example`, `README.md`, `ARCHITECTURE.md`, `AI_ARCHITECTURE.md`, `API.md`, `FINAL_DEMO_GUIDE.md`, `UPGRADE_PLAN.md`: runnable demo and operations docs.

## Execution Tasks

### Task 0 — Phase 1 verification

- Correct Mongoose query mocks, checkout idempotency/race fixtures, and CartContext hook dependency.
- Run server check/tests and client lint/build.
- Add a Docker Compose test-only MongoDB replica set and integration cases for commit, abort, stock race, cart lifecycle, idempotency, and post-commit stock events. Run them if the daemon socket is reachable; if sandbox policy blocks it, retain the runnable harness and state the verification limit.

### Task 1 — Runtime infrastructure

- Add optional Redis client/cache with availability health, TTL, allowlisted product cache, and write invalidation.
- Add BullMQ queues only for non-critical inventory alerts, recommendation refresh, forecast refresh, and analytics aggregation; retry with bounded backoff and idempotency keys.
- Test cache outage fallback, invalidation, queue deduplication, and worker failure behavior.

### Task 2 — Grocery domain and deterministic intelligence

- Add optional product category/brand/unit/attributes fields and safe admin forms/seed data.
- Implement natural-language filter schema validation, database-backed catalog retrieval, buy-again/popular/co-purchase recommendation rules, and explainable stock-aware substitutions.
- Record transactional inventory events and add a demand baseline that reports insufficient history until its documented sample threshold is met.
- Test all ranking, filtering, inventory and forecast rules with fixed fixtures.

### Task 3 — AI provider and grounded tools

- Implement an OpenAI-compatible provider adapter configured by server-only environment variables, with timeouts, structured JSON validation, request limits, redacted metrics, and provider-disabled fallback.
- Add customer grocery assistant and admin copilot services that call only allowlisted application tools; the LLM never emits MongoDB operators or trusted product facts.
- Test malformed/provider-error/fallback behavior and verify every returned product comes from database results.

### Task 4 — Operations and realtime

- Add aggregate-only admin metrics and forecast/stock-risk APIs; label rules-based estimates and show no-data states.
- Add partner workload/zone scoring and manual override; provide route sequencing only from available structured location/zone data and avoid GPS claims.
- Add authenticated order/customer rooms for delivery assignment/status and inventory alerts while retaining public authenticated `stockUpdated` behavior.
- Test RBAC, room isolation, event ordering, atomic assignment, and delivery transition constraints.

### Task 5 — Product experience, demo data, and delivery

- Refine customer/admin/delivery layouts with shared accessible controls, responsive forms, loading/empty/error states, charts, and INR formatting after confirming seed values.
- Seed synthetic customers, products, historical orders, and inventory events idempotently without overwriting existing stock.
- Add Docker Compose for app, Mongo replica set, Redis, and worker; AI provider remains optional.
- Write deployment/API/architecture/AI/demo docs and a 5–10 minute interview demo guide.
- Run backend tests/check, frontend tests/lint/build, Docker validation where permitted, and feature-level regression checks.

## Completion Contract

For every task, add/adjust tests before behavior changes, run the relevant suite, update this plan and `UPGRADE_PLAN.md`, and continue to the next task. Final completion requires recorded results; unavailable Docker/network/provider capabilities are reported as limitations and must not be described as verified.

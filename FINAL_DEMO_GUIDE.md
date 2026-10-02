# Smart Grocery AI — Demo Guide

## Start the complete local stack

1. Copy `.env.example` to `.env` and set unique values for `JWT_SECRET`, `SEED_ADMIN_PASSWORD`, `SEED_DELIVERY_PARTNER_PASSWORD`, and `SEED_CUSTOMER_PASSWORD`.
2. Keep `SEED_ON_START=true` and `SEED_DEMO_DATA=true` for a fresh demo volume. Add an `LLM_API_KEY` to demonstrate live intent extraction and AI summaries; leave it blank to show the explicit rules/database fallbacks.
3. Run:

   ```bash
   docker compose up --build
   ```

4. Visit [http://localhost:8080](http://localhost:8080). Wait for `/ready` to report MongoDB and Redis as ready. Create users in separate browser profiles if demonstrating the three roles at the same time.

Compose uses named MongoDB and Redis volumes. To restart while keeping state, run `docker compose down` and then `docker compose up`. `docker compose down -v` erases the local demo database and Redis queue.

## Seeded roles

The `.env` values are the demo logins:

- Admin: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
- Delivery partner: first email in `SEED_DELIVERY_PARTNERS` / `SEED_DELIVERY_PARTNER_PASSWORD`
- Customer: first email in `SEED_CUSTOMER_EMAILS` / `SEED_CUSTOMER_PASSWORD`

All accounts are created only when explicitly enabled and credentials are supplied. The seed corpus adds 24 grocery products and deterministic delivered orders across 58 days. Synthetic history is fictional, repeatable, and clearly identified by seed keys; it does not decrement current stock.

## Interview walkthrough (8–10 minutes)

### 1. Customer shopping and grounded assistant

Sign in as a customer. Search “breakfast under ₹300”. With an LLM key, the provider returns only a bounded search intent; product cards, stock, and prices are fetched from MongoDB. Without a key, explain that the app runs a catalogue search fallback. Add products and show category-aware alternatives and Buy Again recommendations.

### 2. Checkout consistency and realtime

Open a second authenticated browser and show the same catalogue. Place an order in the customer session. The persisted cart is the checkout input; current stock is conditionally decremented and the order and cart deletion commit in one MongoDB transaction. Show the idempotency key on the request or retry checkout with the same key. The second session receives the new public stock count after commit, while order state updates go only to the customer, assigned partner, and admins.

### 3. Admin operations

Sign in as the admin. Review the overview and aggregate-only copilot summary. Inspect a product demand forecast: it shows delivered-order history coverage, method, horizon, and reorder signal. The seeded history provides a demo dataset, while sparse history is explicitly marked insufficient. Assign an order to the least-loaded partner and compare that choice with manual assignment.

Select “Queue forecast refresh”. Redis/BullMQ accepts one job per active product; the worker computes forecasts from MongoDB and caches each result with a one-hour TTL. If Redis is down, the synchronous forecast endpoint remains available and the UI reports queue unavailability.

### 4. Delivery and route ordering

Sign in as the delivery partner. Move an assigned order through `assigned → picked → delivered`. If customer location permission was granted at checkout, use “Plan my route” to order available stops from the delivery partner’s current location. The displayed distance is a great-circle estimate, not a road route; orders without coordinates are called out.

### 5. Verification for reviewers

Run the following from the repository root:

```bash
cd server && npm run check && npm test
cd ../client && npm test && npm run lint && npm run build
cd .. && docker compose -f docker-compose.mongo-test.yml run --rm checkout-tests npm test -- --test-reporter=spec
```

The disposable integration stack uses a real MongoDB replica set and Redis. It verifies commit/rollback, stock concurrency, idempotency, cart effects, socket authorization, and the BullMQ forecast worker/cache. It does not connect to or mutate the persistent demo database.

## AI trust boundary

The grocery assistant sends only the user’s short search string to the configured OpenAI-compatible endpoint. The provider is asked to return `{ terms, category, maxPrice }`; output is validated and then translated into a fixed, allowlisted product query. The actual product, price, stock, and image records come from MongoDB. The admin copilot sends aggregate counts/revenue only and has no model-driven database tools. No conversation history is stored.

## Current constraints to disclose in a demo

- Forecasts are a simple mean of daily quantities from delivered orders in the last 90 days, not a statistical seasonality model. Sparse history is labeled insufficient.
- Recommendations and substitutions are deterministic and explainable; the LLM does not choose them.
- Delivery partner ranking uses active-order count. Route ordering uses straight-line coordinates without road graph, live traffic, or geocoding.
- Redis-backed rates and BullMQ jobs are shared within the Compose network. Multi-region Redis, queue dashboards, dead-letter recovery, and production Redis authentication/TLS need deployment-specific configuration.
- Browser JWT storage retains the app’s current XSS exposure; use a server-managed secure cookie session before production with untrusted script origins.

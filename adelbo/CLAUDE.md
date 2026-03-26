# Adelbo — Developer Guide

AI-assisted hotel booking platform: LiteAPI supply, Claude AI decision surfaces, Travel Credit (1.25%), Community Pool (2%), World Chain smart contracts, World ID auth, Stripe payments.

## Quick start

```bash
# 1. Start infrastructure
docker compose up postgres redis -d

# 2. Install deps
npm install   # installs all workspaces

# 3. Copy and fill env vars
cp packages/api/.env.example packages/api/.env
cp packages/web/.env.example packages/web/.env.local
cp packages/mini-app/.env.example packages/mini-app/.env.local

# 4. Run migrations
cd packages/api && npm run db:push

# 5. Start all dev servers
npm run dev   # via turborepo
```

## Architecture

```
packages/
  api/        — Express API (Node 20, Drizzle ORM, PostgreSQL, Redis)
  web/        — Next.js 14 web app (standalone)
  mini-app/   — Next.js 14 World App mini app
  contracts/  — Solidity smart contracts (Hardhat, World Chain)
```

## Key URLs (dev)

| Service    | URL                      |
|------------|--------------------------|
| API        | http://localhost:3001    |
| Web        | http://localhost:3000    |
| Mini app   | http://localhost:3002    |
| API health | http://localhost:3001/health |

## Env vars to fill

### packages/api/.env
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `LITEAPI_KEY` — LiteAPI key (get at app.liteapi.travel)
- `ANTHROPIC_API_KEY` — Claude API key
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — Stripe dashboard
- `SENDGRID_API_KEY` — SendGrid for OTP emails
- `JWT_SECRET` — random 64-char string
- `WORLD_CHAIN_RPC` — https://worldchain-mainnet.g.alchemy.com/public
- `TREASURY_PRIVATE_KEY` — wallet that holds USDC for fiat bookings
- `MARGIN_SPLITTER_ADDRESS` etc — from contract deployment output

### packages/web/.env.local
- `NEXT_PUBLIC_API_URL=http://localhost:3001`
- `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` — Stripe pk_...
- `NEXT_PUBLIC_WORLD_APP_ID` — World App developer portal

## Smart contracts

```bash
cd packages/contracts
npm test                          # run all tests
npm run deploy:testnet            # deploy to World Chain testnet (4801)
npm run deploy:mainnet            # deploy to World Chain mainnet (480)
```

Chain IDs: mainnet=480, testnet=4801. USDC on World Chain uses **6 decimals**.

## Margin split (on every booking)

| Recipient       | BPS  | %      |
|-----------------|------|--------|
| Company         | 175  | 1.75%  |
| Travel Credit   | 125  | 1.25%  |
| Community Pool  | 200  | 2.00%  |

## AI surfaces (Claude `claude-sonnet-4-6`)

1. **Intent Search Copilot** — NL query → structured filters
2. **Hotel Truth Layer** — AI analysis of real hotel data
3. **Rate/Flexibility Advisor** — rate comparison + refund advice
4. **Price Timing Assistant** — buy-now vs wait recommendation
5. **Rescue Agent** — booking issue resolution

## Booking state machine

`pending_payment` → `confirmed` → `active` → `completed` → `cancelled/refunded`

Travel Credit is issued when booking transitions to `completed` (verified by cron job / Chainlink CRE).

## Background jobs

Both jobs start automatically with the API server (skipped in `NODE_ENV=test`):

- **bookingVerification** — runs every 10 min, auto-completes stays past checkout date
- **poolDistribution** — runs daily at 00:05, closes 30-day cycles and distributes pool

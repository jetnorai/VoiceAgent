# Adelbo — Implementation Guide

## Overview

Adelbo is an AI-assisted hotel booking platform with Travel Credit and Community Pool rewards. This monorepo contains:

```
adelbo/
├── packages/
│   ├── api/          Node.js/TypeScript backend
│   ├── web/          Next.js web app (adelbo.com)
│   ├── contracts/    Solidity smart contracts (World Chain)
│   └── mini-app/     React World mini app (MiniKit)
├── .env.example      Environment variables template
└── turbo.json        Turborepo config
```

## Quick start

```bash
cp .env.example .env
# Fill in your API keys

# Install dependencies
npm install

# Start development
npm run dev
```

## Key services

| Service | Port | Description |
|---------|------|-------------|
| API | 3001 | Express backend |
| Web | 3000 | Next.js web app |
| Mini App | 3002 | World mini app |

## Environment variables

See `.env.example` for all required variables.

Critical:
- `LITEAPI_KEY` — Get from liteapi.travel (sandbox key starts with `sand_`)
- `ANTHROPIC_API_KEY` — From console.anthropic.com
- `STRIPE_SECRET_KEY` — From dashboard.stripe.com
- `WORLD_APP_ID` — From developer.worldcoin.org
- `DATABASE_URL` — PostgreSQL connection string

## Database setup

```bash
psql $DATABASE_URL -f packages/api/src/db/migrations/001_initial.sql
```

## Smart contract deployment

```bash
cd packages/contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy.ts --network worldchain_testnet
```

After deployment, update `.env` with the contract addresses, then authorize the CRE worker:

```bash
# In deploy output, note the addresses
# Set MARGIN_SPLITTER_ADDRESS, TRAVEL_VAULT_ADDRESS, etc.
```

## Architecture decisions

### Margin split (5%)
- 1.75% → Company treasury
- 1.25% → User's Travel Credit (TravelVault contract)
- 2.00% → Community Pool (RewardPool contract)

All splits happen atomically on World Chain via `MarginSplitter.sol`.

### Fiat payments
Stripe processes fiat → webhook confirms → backend calls `processBookingFiat()` on MarginSplitter using USDC from treasury.

### USDC decimals
World Chain USDC uses **6 decimals** (not 18). All `parseUnits`/`formatUnits` must use 6.

### Stripe webhook
Must use `express.raw()` before the JSON parser for the `/webhooks/stripe` route.

### AI surfaces
Five decision surfaces in `packages/api/src/services/claude.ts`:
1. `intentSearchCopilot` — Natural language → structured search
2. `hotelTruthLayer` — Honest hotel fit assessment
3. `rateAdvisor` — Which rate/room to choose
4. `priceTiming` — Should I book now?
5. `rescueAgent` — Plans changed recovery

### Pool distribution
Deterministic, loyalty-weighted selection (not random). Full algorithm in `packages/api/src/jobs/poolDistribution.ts`. Chainlink CRE runs the same logic with BFT consensus across DON nodes.

### Booking verification
Chainlink CRE calls LiteAPI booking status after checkout + 24hr buffer. Fallback in `packages/api/src/jobs/bookingVerification.ts`.

## Production checklist

- [ ] Switch LiteAPI sandbox key to production key
- [ ] Configure Stripe webhook endpoint in dashboard
- [ ] Deploy contracts to World Chain mainnet
- [ ] Authorize CRE worker addresses on contracts
- [ ] Set up custodial wallet KMS (AWS KMS or Hashicorp Vault)
- [ ] Configure USDC treasury with sufficient balance
- [ ] Set up Chainlink CRE workflows for booking verification and pool distribution
- [ ] Add monitoring/alerting for treasury balance
- [ ] Enable Stripe Radar fraud rules

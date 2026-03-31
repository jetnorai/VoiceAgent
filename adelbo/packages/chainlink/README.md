# Adelbo — Chainlink CRE Workflows

Three CRE (Chainlink Runtime Environment) workflows that replace centralized cron jobs in production.

| Workflow | File | Trigger | On-chain write |
|----------|------|---------|----------------|
| BookingVerification | `booking-verification.yaml` | Every 10 min + `BookingProcessed` event | `MarginSplitter.completeBooking()` |
| PoolDistribution | `pool-distribution.yaml` | 1st of month, 00:05 UTC | `RewardPool.distributePool()` |
| WldUsdPriceOracle | `price-oracle.yaml` | Every 5 min | `MarginSplitter.updateWldPrice()` |

## How CRE replaces the Node.js cron jobs

The `packages/api/src/jobs/` cron jobs are the **off-chain fallback**. In production:

1. CRE nodes watch on-chain events and a schedule
2. Each node independently runs the workflow steps
3. BFT consensus is required before any `evm_write` step executes
4. The API jobs remain as admin-triggerable fallbacks (`POST /api/admin/jobs/verify-bookings`, `POST /api/admin/pool/distribute`)

## Env vars required on CRE nodes

```
MARGIN_SPLITTER_ADDRESS=0x...
REWARD_POOL_ADDRESS=0x...
ADELBO_API_URL=https://api.adelbo.com
ADMIN_API_KEY=...
LITEAPI_KEY=...
LITEAPI_BASE_URL=https://api.liteapi.travel/v3.0
```

## Deployment

Upload workflow YAML files to the Chainlink CRE node operator dashboard. Each file is independently versioned and can be updated without redeploying contracts.

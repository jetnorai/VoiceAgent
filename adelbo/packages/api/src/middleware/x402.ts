/**
 * x402 Payment Middleware for Adelbo AI endpoints.
 *
 * Uses the Coinbase x402 protocol to charge per-use for premium AI surfaces.
 * Payment is USDC on World Chain (chain ID 480, CAIP-2: eip155:480).
 *
 * Facilitator: https://x402.org/facilitator (Coinbase hosted)
 *
 * Flow:
 * 1. Client calls endpoint without payment → 402 + payment terms returned
 * 2. Client signs USDC transfer (EIP-3009, no on-chain tx)
 * 3. Client resends with X-PAYMENT header
 * 4. Facilitator verifies signature + settles on-chain
 * 5. Endpoint responds with 200 + X-PAYMENT-RESPONSE header
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// USDC on World Chain mainnet
const WORLD_CHAIN_USDC = '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1';
const WORLD_CHAIN_CAIP2 = 'eip155:480';

// Coinbase hosted facilitator
const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator';

// Recipient: the company treasury wallet receives AI fees
const AI_FEE_RECIPIENT = process.env.COMPANY_TREASURY || process.env.BACKEND_ADDRESS || '';

export interface X402PriceConfig {
  /** Amount in USD cents (e.g. 25 = $0.25) */
  usdCents: number;
  description: string;
}

/**
 * Build the 402 payment required response body for a given price.
 */
function buildPaymentRequired(price: X402PriceConfig, requestUrl: string) {
  // Convert cents to USDC amount (6 decimals)
  const usdcAmount = (price.usdCents / 100).toFixed(6);
  // Express as atomic units (multiply by 1e6)
  const atomicAmount = String(Math.round(price.usdCents * 10000)); // cents * 10000 = USDC atomic

  return {
    x402Version: 1,
    accepts: [
      {
        scheme: 'exact',
        network: WORLD_CHAIN_CAIP2,
        maxAmountRequired: atomicAmount,
        resource: requestUrl,
        description: price.description,
        mimeType: 'application/json',
        payTo: AI_FEE_RECIPIENT,
        maxTimeoutSeconds: 60,
        asset: WORLD_CHAIN_USDC,
        extra: {
          name: 'USD Coin',
          version: '2',
        },
      },
    ],
    error: 'Payment required',
  };
}

/**
 * Verify payment with the x402 facilitator.
 */
async function verifyWithFacilitator(
  paymentHeader: string,
  paymentRequired: object,
): Promise<{ isValid: boolean; error?: string }> {
  try {
    const resp = await fetch(`${FACILITATOR_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload: JSON.parse(Buffer.from(paymentHeader, 'base64').toString()),
        paymentRequired,
      }),
    });

    if (resp.ok) {
      return { isValid: true };
    }

    const body = await resp.json().catch(() => ({}));
    return { isValid: false, error: body.error || 'Facilitator rejected payment' };
  } catch (err: any) {
    logger.error('x402 facilitator verification failed', { error: err.message });
    return { isValid: false, error: 'Facilitator unavailable' };
  }
}

/**
 * Settle payment with the x402 facilitator after serving the response.
 */
async function settleWithFacilitator(
  paymentHeader: string,
  paymentRequired: object,
): Promise<void> {
  try {
    await fetch(`${FACILITATOR_URL}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload: JSON.parse(Buffer.from(paymentHeader, 'base64').toString()),
        paymentRequired,
      }),
    });
  } catch (err: any) {
    logger.error('x402 settlement failed', { error: err.message });
    // Non-fatal — payment was already verified
  }
}

/**
 * Express middleware factory for x402 payment-gated endpoints.
 *
 * Usage:
 *   router.post('/intent', requireX402Payment({ usdCents: 5, description: 'AI intent search' }), handler)
 *
 * If X402_ENABLED is not 'true', the middleware is a no-op (free during dev).
 */
export function requireX402Payment(price: X402PriceConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if x402 not enabled (default: off in dev)
    if (process.env.X402_ENABLED !== 'true') {
      return next();
    }

    if (!AI_FEE_RECIPIENT) {
      logger.warn('X402_ENABLED=true but COMPANY_TREASURY not set — skipping payment gate');
      return next();
    }

    const paymentHeader = req.headers['x-payment'] as string | undefined;
    const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const paymentRequired = buildPaymentRequired(price, resourceUrl);

    // No payment header → return 402
    if (!paymentHeader) {
      return res.status(402).json(paymentRequired);
    }

    // Verify payment with facilitator
    const { isValid, error } = await verifyWithFacilitator(paymentHeader, paymentRequired);

    if (!isValid) {
      logger.warn('x402 payment rejected', { error, path: req.path });
      return res.status(402).json({ ...paymentRequired, error });
    }

    // Attach settler to res.locals so the route can trigger settlement after responding
    res.locals.x402Settle = () => settleWithFacilitator(paymentHeader, paymentRequired);
    res.locals.x402PaymentRequired = paymentRequired;

    next();
  };
}

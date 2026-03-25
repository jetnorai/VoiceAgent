import { MiniKit, VerificationLevel, MiniAppVerifyActionSuccessPayload } from '@worldcoin/minikit-js';

export function initMiniKit(): void {
  if (typeof window !== 'undefined') {
    MiniKit.install(process.env.NEXT_PUBLIC_WORLD_APP_ID);
  }
}

export function isMiniKitAvailable(): boolean {
  return typeof window !== 'undefined' && MiniKit.isInstalled();
}

/**
 * Trigger World ID verification for sign-in.
 * Returns the proof payload to send to backend for verification.
 */
export async function verifyWorldId(): Promise<MiniAppVerifyActionSuccessPayload | null> {
  if (!isMiniKitAvailable()) return null;

  try {
    const { finalPayload } = await MiniKit.commandsAsync.verify({
      action: 'adelbo-login',
      verification_level: VerificationLevel.Orb,
    });

    if (finalPayload.status === 'error') {
      console.error('World ID verification failed', finalPayload);
      return null;
    }

    return finalPayload as MiniAppVerifyActionSuccessPayload;
  } catch (err) {
    console.error('verifyWorldId error', err);
    return null;
  }
}

/**
 * Pay with USDC via World Wallet.
 */
export async function payWithUsdc(params: {
  to: string;       // MarginSplitter contract address
  amount: string;   // USDC amount (6 decimals string)
  description: string;
  reference: string; // booking ID
}): Promise<{ txHash: string } | null> {
  if (!isMiniKitAvailable()) return null;

  try {
    const { finalPayload } = await MiniKit.commandsAsync.pay({
      reference: params.reference,
      to: params.to,
      tokens: [
        {
          symbol: 'USDC',
          token_amount: params.amount,
        },
      ],
      description: params.description,
    });

    if (finalPayload.status !== 'success') {
      console.error('USDC payment failed', finalPayload);
      return null;
    }

    return { txHash: (finalPayload as any).transaction_id };
  } catch (err) {
    console.error('payWithUsdc error', err);
    return null;
  }
}

/**
 * Pay with WLD via World Wallet.
 */
export async function payWithWld(params: {
  to: string;
  amount: string;
  description: string;
  reference: string;
}): Promise<{ txHash: string } | null> {
  if (!isMiniKitAvailable()) return null;

  try {
    const { finalPayload } = await MiniKit.commandsAsync.pay({
      reference: params.reference,
      to: params.to,
      tokens: [
        {
          symbol: 'WLD',
          token_amount: params.amount,
        },
      ],
      description: params.description,
    });

    if (finalPayload.status !== 'success') return null;
    return { txHash: (finalPayload as any).transaction_id };
  } catch (err) {
    console.error('payWithWld error', err);
    return null;
  }
}

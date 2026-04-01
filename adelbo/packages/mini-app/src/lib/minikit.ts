import { MiniKit, Tokens, PayCommandInput, MiniKitInstallErrorCodes } from '@worldcoin/minikit-js';

export function initMiniKit(): void {
  if (typeof window === 'undefined') return;
  const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID;
  if (!appId) {
    console.warn('NEXT_PUBLIC_WORLD_APP_ID not set');
    return;
  }
  MiniKit.install(appId);
}

export function isMiniKitAvailable(): boolean {
  return typeof window !== 'undefined' && MiniKit.isInstalled();
}

export interface WorldPayResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

/**
 * Pay with USDC via World Wallet (World App only).
 * Uses the current MiniKit.pay() API — commandsAsync.pay is deprecated.
 *
 * @param to  Recipient address (MarginSplitter contract)
 * @param amount  Amount in USD decimal string e.g. "149.99"
 * @param reference  Unique reference string (booking ID)
 * @param description  Human-readable description shown in World App
 */
export async function payWithUsdc(
  to: string,
  amount: string,
  reference: string,
  description: string,
): Promise<WorldPayResult> {
  if (!isMiniKitAvailable()) {
    return { success: false, error: 'World App not available' };
  }

  try {
    const payload: PayCommandInput = {
      reference,
      to,
      tokens: [
        {
          symbol: Tokens.USDC,
          token_amount: amount, // decimal string in USD e.g. "149.99"
        },
      ],
      description,
    };

    const result = await MiniKit.pay(payload);

    if (result.finalPayload?.status === 'success') {
      return {
        success: true,
        transactionId: result.finalPayload.transaction_id,
      };
    }

    return {
      success: false,
      error: result.finalPayload?.error_code || 'Payment failed',
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Pay with WLD via World Wallet.
 * WLD amount should be pre-computed from USD using the on-chain price oracle.
 *
 * @param to  Recipient address (MarginSplitter contract)
 * @param wldAmount  Amount in WLD decimal string e.g. "42.5"
 * @param reference  Unique reference string (booking ID)
 * @param description  Human-readable description
 */
export async function payWithWld(
  to: string,
  wldAmount: string,
  reference: string,
  description: string,
): Promise<WorldPayResult> {
  if (!isMiniKitAvailable()) {
    return { success: false, error: 'World App not available' };
  }

  try {
    const payload: PayCommandInput = {
      reference,
      to,
      tokens: [
        {
          symbol: Tokens.WLD,
          token_amount: wldAmount,
        },
      ],
      description,
    };

    const result = await MiniKit.pay(payload);

    if (result.finalPayload?.status === 'success') {
      return {
        success: true,
        transactionId: result.finalPayload.transaction_id,
      };
    }

    return {
      success: false,
      error: result.finalPayload?.error_code || 'Payment failed',
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Verify World ID proof using MiniKit.
 * Returns the nullifier hash and proof for backend verification.
 */
export async function verifyWorldId(action: string, signal?: string): Promise<{
  success: boolean;
  proof?: string;
  nullifierHash?: string;
  merkleRoot?: string;
  error?: string;
}> {
  if (!isMiniKitAvailable()) {
    return { success: false, error: 'World App not available' };
  }

  try {
    const { CommandsAsync } = await import('@worldcoin/minikit-js');
    const result = await MiniKit.commandsAsync.verify({
      action,
      signal: signal || '',
      verification_level: 'orb',
    });

    if (result.finalPayload?.status === 'success') {
      return {
        success: true,
        proof: result.finalPayload.proof,
        nullifierHash: result.finalPayload.nullifier_hash,
        merkleRoot: result.finalPayload.merkle_root,
      };
    }

    return {
      success: false,
      error: result.finalPayload?.error_code || 'Verification failed',
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

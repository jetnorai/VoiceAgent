import { createWalletClient, createPublicClient, http, parseUnits, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { logger } from '../utils/logger';

// World Chain (OP Stack L2, chain ID 480)
const worldChain = {
  id: 480,
  name: 'World Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.WORLD_CHAIN_RPC || 'https://worldchain-mainnet.g.alchemy.com/v2/'] },
  },
};

// USDC uses 6 decimals on World Chain
const USDC_DECIMALS = 6;

const MARGIN_SPLITTER_ABI = [
  {
    name: 'processBookingFiat',
    type: 'function',
    inputs: [
      { name: 'bookingId', type: 'bytes32' },
      { name: 'userId', type: 'address' },
      { name: 'totalAmount', type: 'uint256' },
      { name: 'stripePaymentIntentId', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'processBookingUsdc',
    type: 'function',
    inputs: [
      { name: 'bookingId', type: 'bytes32' },
      { name: 'userId', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

function getWalletClient() {
  if (!process.env.BACKEND_WALLET_PRIVATE_KEY) {
    throw new Error('BACKEND_WALLET_PRIVATE_KEY not configured');
  }
  const account = privateKeyToAccount(process.env.BACKEND_WALLET_PRIVATE_KEY as `0x${string}`);
  return createWalletClient({
    account,
    chain: worldChain,
    transport: http(),
  });
}

function getPublicClient() {
  return createPublicClient({
    chain: worldChain,
    transport: http(),
  });
}

export async function processOnChainSplit(params: {
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  stripePaymentIntentId?: string;
}): Promise<{ hash: string }> {
  try {
    const walletClient = getWalletClient();
    const publicClient = getPublicClient();

    const bookingIdBytes = `0x${Buffer.from(params.bookingId.replace(/-/g, '')).slice(0, 32).toString('hex').padEnd(64, '0')}` as `0x${string}`;

    // Convert USD amount to USDC (6 decimals)
    const usdcAmount = parseUnits(params.amount.toFixed(6), USDC_DECIMALS);

    // For fiat payments, backend calls processBookingFiat using treasury USDC
    const hash = await walletClient.writeContract({
      address: process.env.MARGIN_SPLITTER_ADDRESS as `0x${string}`,
      abi: MARGIN_SPLITTER_ABI,
      functionName: 'processBookingFiat',
      args: [
        bookingIdBytes,
        params.userId as `0x${string}`,
        usdcAmount,
        params.stripePaymentIntentId || '',
      ],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    logger.info('On-chain split processed', { bookingId: params.bookingId, hash });
    return { hash };
  } catch (err: any) {
    logger.error('processOnChainSplit failed', { bookingId: params.bookingId, error: err.message });
    throw err;
  }
}

export async function getTravelVaultBalance(userAddress: string): Promise<string> {
  try {
    const publicClient = getPublicClient();
    const balance = await publicClient.readContract({
      address: process.env.TRAVEL_VAULT_ADDRESS as `0x${string}`,
      abi: [
        {
          name: 'balanceOf',
          type: 'function',
          inputs: [{ name: 'user', type: 'address' }],
          outputs: [{ type: 'uint256' }],
          stateMutability: 'view',
        },
      ],
      functionName: 'balanceOf',
      args: [userAddress as `0x${string}`],
    });
    return formatUnits(balance as bigint, USDC_DECIMALS);
  } catch (err: any) {
    logger.warn('Could not fetch vault balance', { userAddress, error: err.message });
    return '0';
  }
}

const REWARD_POOL_ABI = [
  {
    name: 'distributePool',
    type: 'function',
    inputs: [
      { name: 'winners', type: 'address[]' },
      { name: 'scores', type: 'uint256[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export async function distributePoolOnChain(
  winners: Array<{ walletAddress: string; loyaltyScore: number }>
): Promise<{ hash: string }> {
  try {
    const walletClient = getWalletClient();
    const publicClient = getPublicClient();

    const addresses = winners.map((w) => w.walletAddress as `0x${string}`);
    // Scale loyalty scores to uint256 (multiply by 1e6 to preserve 6 decimal places)
    const scores = winners.map((w) => BigInt(Math.round(w.loyaltyScore * 1_000_000)));

    const hash = await walletClient.writeContract({
      address: process.env.REWARD_POOL_ADDRESS as `0x${string}`,
      abi: REWARD_POOL_ABI,
      functionName: 'distributePool',
      args: [addresses, scores],
    });

    await publicClient.waitForTransactionReceipt({ hash });
    logger.info('Pool distributed on-chain', { hash, winnerCount: winners.length });
    return { hash };
  } catch (err: any) {
    logger.error('distributePoolOnChain failed', { error: err.message });
    throw err;
  }
}

const REPUTATION_ABI = [
  {
    name: 'getRateDiscount',
    type: 'function',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: 'discountBps', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

/**
 * Returns BPS discount for a user based on their on-chain reputation tier.
 * Tiers: Explorer=0, Adventurer=50bps (0.5%), Voyager=100bps (1%), Globetrotter=200bps (2%)
 * Falls back to 0 on any error.
 */
export async function getReputationDiscount(userAddress: string): Promise<number> {
  try {
    if (!process.env.REPUTATION_ADDRESS) return 0;
    const publicClient = getPublicClient();
    const bps = await publicClient.readContract({
      address: process.env.REPUTATION_ADDRESS as `0x${string}`,
      abi: REPUTATION_ABI,
      functionName: 'getRateDiscount',
      args: [userAddress as `0x${string}`],
    });
    return Number(bps);
  } catch {
    return 0;
  }
}

/// Read-only helpers around the on-chain `RewardPool`, its companion
/// `BuyerActivity` log, and the Hub V2 trust map relevant to the pool
/// route. The PaySheet and the `/stats` PrizePoolCard call into these to
/// decide whether to include the optional `trust(pool)` step in the
/// bundle and to surface the pool's current draw state respectively.

import { parseAbiItem } from 'viem';

import { CIRCLES_CONFIG } from './circles-config';
import { hubV2Abi } from './abi/hub-v2';
import { buyerActivityAbi } from './abi/buyer-activity';
import { rewardPoolAbi } from './abi/reward-pool';
import { getPublicClient } from './public-client';
import type { Address } from '@/types/kitty';

const WINNER_DRAWN_EVENT = parseAbiItem(
  'event WinnerDrawn(uint256 indexed weekIndex, address indexed winner, uint256 prize)',
);

const WEEK_ENTERED_EVENT = parseAbiItem(
  'event WeekEntered(uint256 indexed weekIndex, address indexed buyer)',
);

const CLAIMED_EVENT = parseAbiItem(
  'event Claimed(uint256 indexed weekIndex, address indexed winner, uint256 prize)',
);

/// What the PaySheet needs before assembling the pool-route bundle.
export interface PoolPayPrep {
  /// True iff the viewer hasn't already `Hub.trust`-ed the pool group.
  /// When true, the bundle prepends `Hub.trust(pool, MAX_EXPIRY)` so
  /// the eventual `claim` transfer (after a draw) doesn't revert on the
  /// recipient-trust gate.
  needsPoolTrust: boolean;
  /// True iff the viewer already has a non-zero `firstPaidAt` row on
  /// `BuyerActivity`. Cheap optimisation only — the bundle always
  /// includes `markPaid()` because the call is idempotent and cheap,
  /// but knowing this lets the UI display the "pool eligible" badge
  /// without waiting for the next tx.
  hasPaidEver: boolean;
  /// `uint256(uint160(rewardPool))` — the pool token id. Constant for a
  /// given deploy; returned so callers don't have to duplicate the cast.
  poolTokenId: bigint;
}

/// Read everything the PaySheet needs to decide pool-route step inclusion.
/// Two parallel `eth_call`s — Hub.isTrusted + BuyerActivity.hasPaid. If
/// either of the relevant contracts is missing from the config (e.g. dev
/// env), returns defaults that disable the pool route gracefully.
export async function readPoolPayPrep(viewer: Address): Promise<PoolPayPrep | null> {
  const pool = CIRCLES_CONFIG.rewardPoolAddress;
  const activity = CIRCLES_CONFIG.buyerActivityAddress;
  if (!pool || !activity) return null;

  const client = getPublicClient();
  const [needsPoolTrustNot, hasPaidEver] = await Promise.all([
    client.readContract({
      address: CIRCLES_CONFIG.v2HubAddress,
      abi: hubV2Abi,
      functionName: 'isTrusted',
      args: [viewer, pool],
    }) as Promise<boolean>,
    client.readContract({
      address: activity,
      abi: buyerActivityAbi,
      functionName: 'hasPaid',
      args: [viewer],
    }) as Promise<boolean>,
  ]);

  return {
    needsPoolTrust: !needsPoolTrustNot,
    hasPaidEver,
    poolTokenId: BigInt(pool),
  };
}

/// Snapshot of the pool's public state at call time. Used by the
/// PrizePoolCard on `/stats`: pool balance, the week boundaries, and the
/// current week's entry count.
export interface PoolState {
  poolAddress: Address;
  poolTokenId: bigint;
  balance: bigint;
  currentWeekIndex: bigint;
  currentWeekEntries: bigint;
  previousWeekIndex: bigint;
  previousWeekEntries: bigint;
  previousWeekWinner: Address | null;
  previousWeekPrize: bigint;
  previousWeekClaimed: boolean;
}

export async function readPoolState(): Promise<PoolState | null> {
  const pool = CIRCLES_CONFIG.rewardPoolAddress;
  if (!pool) return null;

  const client = getPublicClient();
  const balance = (await client.readContract({
    address: pool,
    abi: rewardPoolAbi,
    functionName: 'poolBalance',
  })) as bigint;
  const currentWeek = (await client.readContract({
    address: pool,
    abi: rewardPoolAbi,
    functionName: 'currentWeek',
  })) as bigint;
  const prevWeek = currentWeek > 0n ? currentWeek - 1n : 0n;

  const [currentEntries, prevEntries, prevWinner, prevPrize, prevClaimed] = await Promise.all([
    client.readContract({
      address: pool,
      abi: rewardPoolAbi,
      functionName: 'entriesCount',
      args: [currentWeek],
    }) as Promise<bigint>,
    client.readContract({
      address: pool,
      abi: rewardPoolAbi,
      functionName: 'entriesCount',
      args: [prevWeek],
    }) as Promise<bigint>,
    client.readContract({
      address: pool,
      abi: rewardPoolAbi,
      functionName: 'winners',
      args: [prevWeek],
    }) as Promise<Address>,
    client.readContract({
      address: pool,
      abi: rewardPoolAbi,
      functionName: 'weeklyPrize',
      args: [prevWeek],
    }) as Promise<bigint>,
    client.readContract({
      address: pool,
      abi: rewardPoolAbi,
      functionName: 'claimed',
      args: [prevWeek],
    }) as Promise<boolean>,
  ]);

  return {
    poolAddress: pool,
    poolTokenId: BigInt(pool),
    balance,
    currentWeekIndex: currentWeek,
    currentWeekEntries: currentEntries,
    previousWeekIndex: prevWeek,
    previousWeekEntries: prevEntries,
    previousWeekWinner:
      prevWinner && prevWinner !== '0x0000000000000000000000000000000000000000'
        ? (prevWinner as Address)
        : null,
    previousWeekPrize: prevPrize,
    previousWeekClaimed: prevClaimed,
  };
}

/// A past draw the viewer won. The UI lists these with a per-week
/// claim button (skipped automatically when `claimed` is true).
export interface ViewerWin {
  weekIndex: bigint;
  prize: bigint;
  claimed: boolean;
}

/// Walk `WinnerDrawn` events filtered by the viewer's address. Returns
/// the (small) list of weeks where the viewer was selected, with their
/// claimed state for the action button. Cheap: indexed event, one
/// `getLogs` call, deploy block as lower bound.
export async function readViewerWins(viewer: Address): Promise<ViewerWin[]> {
  const pool = CIRCLES_CONFIG.rewardPoolAddress;
  if (!pool) return [];
  const client = getPublicClient();

  const logs = await client.getLogs({
    address: pool,
    event: WINNER_DRAWN_EVENT,
    args: { winner: viewer },
    fromBlock: 'earliest',
    toBlock: 'latest',
  });

  if (logs.length === 0) return [];

  const claims = await Promise.all(
    logs.map((log) =>
      client.readContract({
        address: pool,
        abi: rewardPoolAbi,
        functionName: 'claimed',
        args: [log.args.weekIndex as bigint],
      }) as Promise<boolean>,
    ),
  );

  return logs.map((log, i) => ({
    weekIndex: log.args.weekIndex as bigint,
    prize: log.args.prize as bigint,
    claimed: claims[i] ?? false,
  }));
}

/// Whether the viewer is in the current week's entries already. Used by
/// the PaySheet UI to show "🎟 Entered this week's draw" once the pool
/// route has run, and to avoid re-running `enterWeek()` if the viewer is
/// paying a second service in the same week (it's a no-op on-chain but
/// the host bundle UX is cleaner without it).
export async function readViewerInThisWeek(viewer: Address): Promise<boolean> {
  const pool = CIRCLES_CONFIG.rewardPoolAddress;
  if (!pool) return false;
  const client = getPublicClient();
  const week = (await client.readContract({
    address: pool,
    abi: rewardPoolAbi,
    functionName: 'currentWeek',
  })) as bigint;
  return (await client.readContract({
    address: pool,
    abi: rewardPoolAbi,
    functionName: 'enteredWeek',
    args: [week, viewer],
  })) as boolean;
}

// Silence unused warnings for events we registered as ABI items but don't
// directly subscribe to in this module yet. Other modules import them via
// the public ABI; declaring them here keeps a single source for the
// indexed-arg shapes consumers rely on.
void WEEK_ENTERED_EVENT;
void CLAIMED_EVENT;

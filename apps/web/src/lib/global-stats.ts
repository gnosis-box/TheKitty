import { parseAbiItem } from 'viem';

import { CIRCLES_CONFIG } from './circles-config';
import { getPublicClient } from './public-client';
import type { Address } from '@/types/kitty';

const KITTY_CREATED_EVENT = parseAbiItem(
  'event KittyCreated(address indexed creator, address indexed baseGroup, address indexed governance, address[] members, uint8 quorumPercent, uint128 smallTxThreshold, uint32 votingPeriod)',
);

const ROUND_CLAIMED_EVENT = parseAbiItem(
  'event RoundClaimed(uint32 indexed round, address indexed claimer, uint128 amount, uint32 nextClaimAt)',
);

export interface GlobalStats {
  /// Total kitties ever created through this factory.
  kittiesCreated: number;
  /// Total rounds paid out across every tontine kitty.
  roundsPaid: number;
  /// Total CRC paid out (raw uint128 sum). Add up across rounds.
  totalPaidOut: bigint;
}

/// Aggregate cross-kitty activity by scanning the factory + every deployed
/// governance contract for events. This is unindexed — for low-traffic
/// hackathon scale (tens of kitties, hundreds of events) it's fine. Above
/// that we'd need a subgraph or a backend cache.
///
/// Returns zeros if the factory address isn't configured or no kitties exist.
export async function readGlobalStats(): Promise<GlobalStats> {
  const factory = CIRCLES_CONFIG.kittyFactoryAddress;
  if (!factory) {
    return { kittiesCreated: 0, roundsPaid: 0, totalPaidOut: 0n };
  }
  const client = getPublicClient();

  const created = await client.getLogs({
    address: factory,
    event: KITTY_CREATED_EVENT,
    fromBlock: 'earliest',
  });

  if (created.length === 0) {
    return { kittiesCreated: 0, roundsPaid: 0, totalPaidOut: 0n };
  }

  const governances = created
    .map((l) => l.args.governance as Address | undefined)
    .filter((g): g is Address => Boolean(g));

  const roundsPerKitty = await Promise.all(
    governances.map((gov) =>
      client.getLogs({
        address: gov,
        event: ROUND_CLAIMED_EVENT,
        fromBlock: 'earliest',
      }),
    ),
  );

  let roundsPaid = 0;
  let totalPaidOut = 0n;
  for (const rounds of roundsPerKitty) {
    for (const r of rounds) {
      if (r.args.amount === undefined) continue;
      roundsPaid += 1;
      totalPaidOut += r.args.amount as bigint;
    }
  }

  return {
    kittiesCreated: governances.length,
    roundsPaid,
    totalPaidOut,
  };
}

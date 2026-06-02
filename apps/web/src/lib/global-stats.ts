import { parseAbiItem } from 'viem';

import { CIRCLES_CONFIG } from './circles-config';
import { getPublicClient } from './public-client';
import { serviceRegistryAbi } from './abi/service-registry';
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

export interface ServiceStats {
  /// Total services ever published (active + deactivated).
  servicesPublished: number;
  /// Services currently active on the board.
  activeServices: number;
  /// Distinct providers with at least one active service.
  activeProviders: number;
  /// Total payment events logged across every service.
  paymentsLogged: number;
  /// Sum of CRC paid through `logPayment` calls (raw uint128 sum).
  totalCrcPaid: bigint;
}

/// Aggregate every service on the registry to produce the cycle-3 stats
/// (services board health). Cheap at hackathon scale: 1 count read + 3
/// multicalls. If the registry grows past a few hundred services we'd
/// move this to a subgraph.
export async function readServiceStats(): Promise<ServiceStats> {
  const empty: ServiceStats = {
    servicesPublished: 0,
    activeServices: 0,
    activeProviders: 0,
    paymentsLogged: 0,
    totalCrcPaid: 0n,
  };
  const registry = CIRCLES_CONFIG.serviceRegistryAddress;
  if (!registry) return empty;
  const client = getPublicClient();
  const base = { abi: serviceRegistryAbi, address: registry } as const;

  const countRaw = (await client.readContract({
    ...base,
    functionName: 'serviceCount',
  })) as bigint;
  const count = Number(countRaw);
  if (count === 0) return empty;

  const ids = Array.from({ length: count }, (_, i) => BigInt(i));

  const [servicesRaw, timesPaidRaw, totalPaidRaw] = await Promise.all([
    client.multicall({
      contracts: ids.map((id) => ({
        ...base,
        functionName: 'getService' as const,
        args: [id] as const,
      })),
      allowFailure: false,
    }),
    client.multicall({
      contracts: ids.map((id) => ({
        ...base,
        functionName: 'timesPaid' as const,
        args: [id] as const,
      })),
      allowFailure: false,
    }),
    client.multicall({
      contracts: ids.map((id) => ({
        ...base,
        functionName: 'totalPaid' as const,
        args: [id] as const,
      })),
      allowFailure: false,
    }),
  ]);

  let activeServices = 0;
  let paymentsLogged = 0;
  let totalCrcPaid = 0n;
  const activeProviders = new Set<string>();

  (servicesRaw as Array<{ provider: Address; active: boolean }>).forEach(
    (s, i) => {
      paymentsLogged += Number(timesPaidRaw[i] as bigint);
      totalCrcPaid += totalPaidRaw[i] as bigint;
      if (s.active) {
        activeServices += 1;
        activeProviders.add(s.provider.toLowerCase());
      }
    },
  );

  return {
    servicesPublished: count,
    activeServices,
    activeProviders: activeProviders.size,
    paymentsLogged,
    totalCrcPaid,
  };
}

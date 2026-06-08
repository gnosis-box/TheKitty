import { parseAbiItem } from 'viem';

import { CIRCLES_CONFIG } from './circles-config';
import { hubV2Abi } from './abi/hub-v2';
import { serviceRegistryAbi } from './abi/service-registry';
import { getPublicClient } from './public-client';
import type { Address } from '@/types/kitty';

const SERVICE_PAID_EVENT = parseAbiItem(
  'event ServicePaid(uint64 indexed id, address indexed provider, address indexed buyer, uint128 amount, string memo)',
);

const SERVICE_RATED_EVENT = parseAbiItem(
  'event ServiceRated(uint64 indexed id, address indexed rater, uint8 stars, uint64 ratingsCount, uint128 ratingsSum)',
);

/// Bucketed star counts for a service, taking the latest rating per rater
/// so re-rates don't double-count. `1..5` keys are the star levels.
export type RatingBreakdown = Record<1 | 2 | 3 | 4 | 5, number>;

/// A single ServicePaid event flattened for the UI. `blockNumber` lets the
/// caller display "X mins ago" once they translate it to a timestamp.
export interface RecentPayment {
  serviceId: bigint;
  buyer: Address;
  amount: bigint;
  memo: string;
  blockNumber: bigint;
  txHash: `0x${string}`;
}

/// Read every `ServicePaid` event where `payer` is the buyer and
/// `provider` is the seller, returning the set of service ids the payer
/// has paid for at least once. Used by the profile page to decide
/// whether to expose the inline rate UI on each of the provider's cards
/// — only paying customers can rate, Airbnb-style.
export async function readPaidServiceIdsByPayer(
  payer: Address,
  provider: Address,
): Promise<Set<string>> {
  const registry = CIRCLES_CONFIG.serviceRegistryAddress;
  if (!registry) return new Set();
  const client = getPublicClient();
  const logs = await client.getLogs({
    address: registry,
    event: SERVICE_PAID_EVENT,
    args: { provider, buyer: payer },
    fromBlock: 'earliest',
  });
  const out = new Set<string>();
  for (const l of logs) {
    if (l.args.id != null) out.add(String(l.args.id));
  }
  return out;
}

/// Compact per-provider activity summary for the leaderboard on
/// `/stats`. We aggregate ServicePaid events network-wide, group by
/// `provider`, and rank by total CRC received. Cheap at hackathon scale
/// (one eth_getLogs + client-side reduce); scales to a few hundred
/// payments before we'd need a subgraph.
export interface ProviderActivity {
  provider: Address;
  totalCrcReceived: bigint;
  paymentCount: number;
  /// Number of distinct buyer addresses.
  uniqueBuyers: number;
}

export async function readTopProvidersByActivity(
  limit = 10,
): Promise<ProviderActivity[]> {
  const registry = CIRCLES_CONFIG.serviceRegistryAddress;
  if (!registry) return [];
  const client = getPublicClient();
  const logs = await client.getLogs({
    address: registry,
    event: SERVICE_PAID_EVENT,
    fromBlock: 'earliest',
  });

  const byProvider = new Map<
    string,
    { provider: Address; total: bigint; count: number; buyers: Set<string> }
  >();
  for (const l of logs) {
    const provider = l.args.provider as Address | undefined;
    const amount = l.args.amount as bigint | undefined;
    const buyer = l.args.buyer as Address | undefined;
    if (!provider || amount == null || !buyer) continue;
    const key = provider.toLowerCase();
    const slot = byProvider.get(key) ?? {
      provider,
      total: 0n,
      count: 0,
      buyers: new Set<string>(),
    };
    slot.total += amount;
    slot.count += 1;
    slot.buyers.add(buyer.toLowerCase());
    byProvider.set(key, slot);
  }

  const out: ProviderActivity[] = [];
  for (const slot of byProvider.values()) {
    out.push({
      provider: slot.provider,
      totalCrcReceived: slot.total,
      paymentCount: slot.count,
      uniqueBuyers: slot.buyers.size,
    });
  }
  out.sort((a, b) => {
    if (a.totalCrcReceived === b.totalCrcReceived) {
      return b.paymentCount - a.paymentCount;
    }
    return a.totalCrcReceived < b.totalCrcReceived ? 1 : -1;
  });
  return out.slice(0, limit);
}

/// Network-wide stream of recent `ServicePaid` events, newest first.
/// Powers the "Recently paid in your network" feed on `/services` — the
/// daily-fresh content that gives users a reason to keep opening the
/// app. No indexed filter (we want every payment), so we cap the
/// fromBlock window if it ever gets too heavy; today the registry is
/// small enough that fromBlock='earliest' is fine.
export async function readNetworkRecentPayments(
  limit = 5,
): Promise<RecentPayment[]> {
  const registry = CIRCLES_CONFIG.serviceRegistryAddress;
  if (!registry) return [];
  const client = getPublicClient();
  const logs = await client.getLogs({
    address: registry,
    event: SERVICE_PAID_EVENT,
    fromBlock: 'earliest',
  });
  const out: RecentPayment[] = [];
  for (const l of logs) {
    if (l.args.id == null || l.args.amount == null || l.args.buyer == null)
      continue;
    out.push({
      serviceId: l.args.id as bigint,
      buyer: l.args.buyer as Address,
      amount: l.args.amount as bigint,
      memo: (l.args.memo as string) ?? '',
      blockNumber: l.blockNumber!,
      txHash: l.transactionHash!,
    });
  }
  out.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : -1));
  return out.slice(0, limit);
}

/// Resolve a service title for an id. Cheap single read per id; the
/// caller should cache or batch via multicall if scaled up.
export async function readServiceTitle(id: bigint): Promise<string | null> {
  const registry = CIRCLES_CONFIG.serviceRegistryAddress;
  if (!registry) return null;
  const client = getPublicClient();
  try {
    const s = (await client.readContract({
      abi: serviceRegistryAbi,
      address: registry,
      functionName: 'getService',
      args: [id],
    })) as RawService;
    return s.title;
  } catch {
    return null;
  }
}

/// Pull every payment the provider has received via `logPayment`, newest
/// first. Used by `/services/mine` to show a "Last:" line under each
/// service. One eth_getLogs call thanks to the `provider` indexed filter.
export async function readRecentPaymentsForProvider(
  provider: Address,
): Promise<RecentPayment[]> {
  const registry = CIRCLES_CONFIG.serviceRegistryAddress;
  if (!registry) return [];
  const client = getPublicClient();
  const logs = await client.getLogs({
    address: registry,
    event: SERVICE_PAID_EVENT,
    args: { provider },
    fromBlock: 'earliest',
  });
  const out: RecentPayment[] = [];
  for (const l of logs) {
    if (l.args.id == null || l.args.amount == null || l.args.buyer == null) continue;
    out.push({
      serviceId: l.args.id as bigint,
      buyer: l.args.buyer as Address,
      amount: l.args.amount as bigint,
      memo: (l.args.memo as string) ?? '',
      blockNumber: l.blockNumber!,
      txHash: l.transactionHash!,
    });
  }
  out.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : -1));
  return out;
}

/// A service as the front-end consumes it. Mirrors the on-chain Service
/// struct plus the per-service aggregates (ratings + payment count + total
/// CRC paid) so the card can render everything from one payload.
export interface ServiceView {
  id: bigint;
  provider: Address;
  title: string;
  description: string;
  priceCrc: bigint;
  durationMins: number;
  active: boolean;
  createdAt: number;
  /// Provider's opt-in cut of every payment routed to the community
  /// pool, in basis points (0–2000 = 0–20%). 0 = keeps everything,
  /// 100 = 1% to the pool, etc. The split is computed and bundled by
  /// the PaySheet; the contract just records the declared share.
  poolShareBps: number;
  // aggregates
  timesPaid: bigint;
  totalPaid: bigint;
  ratingsSum: bigint;
  ratingsCount: bigint;
  /// True if the viewer's address has the provider in their Hub trust set.
  /// Undefined when no viewer address is available (standalone visit).
  trustedByViewer?: boolean;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

interface RawService {
  id: bigint;
  provider: Address;
  title: string;
  description: string;
  priceCrc: bigint;
  durationMins: number;
  active: boolean;
  createdAt: bigint;
  poolShareBps: number;
}

/// Read every active service from the registry, with aggregates and the
/// viewer's trust state for each provider. For the V1 scale (tens to low
/// hundreds of services) a per-service multicall is fine; if the registry
/// grows past that we'll introduce pagination or a subgraph.
export async function readAllActiveServices(viewer?: Address): Promise<ServiceView[]> {
  const registry = CIRCLES_CONFIG.serviceRegistryAddress;
  if (!registry) return [];
  const client = getPublicClient();
  const base = { abi: serviceRegistryAbi, address: registry } as const;

  const countRaw = (await client.readContract({
    ...base,
    functionName: 'serviceCount',
  })) as bigint;
  const count = Number(countRaw);
  if (count === 0) return [];

  const ids = Array.from({ length: count }, (_, i) => BigInt(i));

  // Fetch services + aggregates in parallel. Three multicalls keep the
  // viem type inference manageable (single function per call).
  const [servicesRaw, timesPaidRaw, totalPaidRaw, ratingsSumRaw, ratingsCountRaw] =
    await Promise.all([
      client.multicall({
        contracts: ids.map((id) => ({ ...base, functionName: 'getService' as const, args: [id] as const })),
        allowFailure: false,
      }),
      client.multicall({
        contracts: ids.map((id) => ({ ...base, functionName: 'timesPaid' as const, args: [id] as const })),
        allowFailure: false,
      }),
      client.multicall({
        contracts: ids.map((id) => ({ ...base, functionName: 'totalPaid' as const, args: [id] as const })),
        allowFailure: false,
      }),
      client.multicall({
        contracts: ids.map((id) => ({ ...base, functionName: 'ratingsSum' as const, args: [id] as const })),
        allowFailure: false,
      }),
      client.multicall({
        contracts: ids.map((id) => ({ ...base, functionName: 'ratingsCount' as const, args: [id] as const })),
        allowFailure: false,
      }),
    ]);

  const services: RawService[] = (servicesRaw as unknown as RawService[]).filter(Boolean);

  // Resolve trust state for each unique provider in one multicall.
  let trustMap: Record<string, boolean> = {};
  if (viewer && viewer !== ZERO_ADDRESS) {
    const uniqueProviders = Array.from(
      new Set(services.map((s) => s.provider.toLowerCase())),
    ) as Address[];
    if (uniqueProviders.length > 0) {
      try {
        const trustResults = await client.multicall({
          contracts: uniqueProviders.map((p) => ({
            abi: hubV2Abi,
            address: CIRCLES_CONFIG.v2HubAddress,
            functionName: 'isTrusted' as const,
            args: [viewer, p] as const,
          })),
          allowFailure: true,
        });
        trustResults.forEach((r, i) => {
          trustMap[uniqueProviders[i]!] =
            r.status === 'success' && r.result === true;
        });
      } catch {
        // ignore — trust badges will all show as "not trusted"
      }
    }
  }

  const out: ServiceView[] = [];
  services.forEach((s, i) => {
    if (!s.active) return;
    out.push({
      id: s.id,
      provider: s.provider,
      title: s.title,
      description: s.description,
      priceCrc: s.priceCrc,
      durationMins: s.durationMins,
      active: s.active,
      createdAt: Number(s.createdAt),
      poolShareBps: Number(s.poolShareBps),
      timesPaid: timesPaidRaw[i] as bigint,
      totalPaid: totalPaidRaw[i] as bigint,
      ratingsSum: ratingsSumRaw[i] as bigint,
      ratingsCount: ratingsCountRaw[i] as bigint,
      trustedByViewer: viewer ? trustMap[s.provider.toLowerCase()] ?? false : undefined,
    });
  });

  // Newest first feels right — recently-published services bubble up.
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}

/// Read every service published by `provider` (active + inactive) along
/// with the same aggregates `readAllActiveServices` returns. Used by the
/// "My services" management screen so the owner can edit or deactivate.
export async function readMyServices(provider: Address): Promise<ServiceView[]> {
  const registry = CIRCLES_CONFIG.serviceRegistryAddress;
  if (!registry) return [];
  const client = getPublicClient();
  const base = { abi: serviceRegistryAbi, address: registry } as const;

  const services = (await client.readContract({
    ...base,
    functionName: 'servicesByProvider',
    args: [provider],
  })) as RawService[];
  if (services.length === 0) return [];

  const ids = services.map((s) => s.id);
  const [timesPaidRaw, totalPaidRaw, ratingsSumRaw, ratingsCountRaw] =
    await Promise.all([
      client.multicall({
        contracts: ids.map((id) => ({ ...base, functionName: 'timesPaid' as const, args: [id] as const })),
        allowFailure: false,
      }),
      client.multicall({
        contracts: ids.map((id) => ({ ...base, functionName: 'totalPaid' as const, args: [id] as const })),
        allowFailure: false,
      }),
      client.multicall({
        contracts: ids.map((id) => ({ ...base, functionName: 'ratingsSum' as const, args: [id] as const })),
        allowFailure: false,
      }),
      client.multicall({
        contracts: ids.map((id) => ({ ...base, functionName: 'ratingsCount' as const, args: [id] as const })),
        allowFailure: false,
      }),
    ]);

  const out: ServiceView[] = services.map((s, i) => ({
    id: s.id,
    provider: s.provider,
    title: s.title,
    description: s.description,
    priceCrc: s.priceCrc,
    durationMins: s.durationMins,
    active: s.active,
    createdAt: Number(s.createdAt),
    poolShareBps: Number(s.poolShareBps),
    timesPaid: timesPaidRaw[i] as bigint,
    totalPaid: totalPaidRaw[i] as bigint,
    ratingsSum: ratingsSumRaw[i] as bigint,
    ratingsCount: ratingsCountRaw[i] as bigint,
  }));
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}

/// Read a single service by id (front-end fetch for the edit screen).
export async function readServiceById(id: bigint): Promise<ServiceView | null> {
  const registry = CIRCLES_CONFIG.serviceRegistryAddress;
  if (!registry) return null;
  const client = getPublicClient();
  const base = { abi: serviceRegistryAbi, address: registry } as const;
  try {
    const s = (await client.readContract({
      ...base,
      functionName: 'getService',
      args: [id],
    })) as RawService;
    const [timesPaid, totalPaid, ratingsSum, ratingsCount] = await Promise.all([
      client.readContract({ ...base, functionName: 'timesPaid', args: [id] }) as Promise<bigint>,
      client.readContract({ ...base, functionName: 'totalPaid', args: [id] }) as Promise<bigint>,
      client.readContract({ ...base, functionName: 'ratingsSum', args: [id] }) as Promise<bigint>,
      client.readContract({ ...base, functionName: 'ratingsCount', args: [id] }) as Promise<bigint>,
    ]);
    return {
      id: s.id,
      provider: s.provider,
      title: s.title,
      description: s.description,
      priceCrc: s.priceCrc,
      durationMins: s.durationMins,
      active: s.active,
      createdAt: Number(s.createdAt),
      poolShareBps: Number(s.poolShareBps),
      timesPaid,
      totalPaid,
      ratingsSum,
      ratingsCount,
    };
  } catch {
    return null;
  }
}

/// Read every `ServiceRated` event for one service and bucket the latest
/// rating per rater into 5 star levels. Used by `/services/:id` to show a
/// rating distribution bar instead of just the average — readers form
/// stronger trust when they can see a 5★ x 12 spread vs a single 5★.
export async function readRatingBreakdown(
  serviceId: bigint,
): Promise<RatingBreakdown> {
  const empty: RatingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const registry = CIRCLES_CONFIG.serviceRegistryAddress;
  if (!registry) return empty;
  const client = getPublicClient();
  const logs = await client.getLogs({
    address: registry,
    event: SERVICE_RATED_EVENT,
    args: { id: serviceId },
    fromBlock: 'earliest',
  });
  // Latest rating wins per rater (overwrite semantics in the contract).
  const latest = new Map<string, number>();
  for (const l of logs) {
    if (l.args.rater == null || l.args.stars == null) continue;
    latest.set(String(l.args.rater).toLowerCase(), Number(l.args.stars));
  }
  const out: RatingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const stars of latest.values()) {
    if (stars >= 1 && stars <= 5) {
      out[stars as 1 | 2 | 3 | 4 | 5] += 1;
    }
  }
  return out;
}

/// Average star rating for a service. Returns null when no one has rated.
export function ratingAverage(s: Pick<ServiceView, 'ratingsSum' | 'ratingsCount'>): number | null {
  if (s.ratingsCount === 0n) return null;
  // ratingsSum is in raw uint128, ratings are 1..5; result is small enough
  // for safe Number conversion.
  return Number(s.ratingsSum) / Number(s.ratingsCount);
}

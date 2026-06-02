import { CIRCLES_CONFIG } from './circles-config';
import { hubV2Abi } from './abi/hub-v2';
import { serviceRegistryAbi } from './abi/service-registry';
import { getPublicClient } from './public-client';
import type { Address } from '@/types/kitty';

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

/// Average star rating for a service. Returns null when no one has rated.
export function ratingAverage(s: Pick<ServiceView, 'ratingsSum' | 'ratingsCount'>): number | null {
  if (s.ratingsCount === 0n) return null;
  // ratingsSum is in raw uint128, ratings are 1..5; result is small enough
  // for safe Number conversion.
  return Number(s.ratingsSum) / Number(s.ratingsCount);
}

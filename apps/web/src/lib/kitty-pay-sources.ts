import { CIRCLES_CONFIG } from './circles-config';
import { hubV2Abi } from './abi/hub-v2';
import { getPublicClient } from './public-client';
import { loadKitties } from './storage';
import type { Address, KittyRef } from '@/types/kitty';

/// A group-pot kitty the viewer can spend from to pay a specific service,
/// already filtered against every precondition: membership, the kitty's
/// small-spend cap, and provider trust toward the kitty's BaseGroup.
/// Tontine kitties are deliberately excluded — they're a savings tool, the
/// claimer takes the payout into their personal wallet and spends from
/// there.
export interface GroupPotPaySource {
  kitty: KittyRef;
  /// `true` if every on-chain precondition is satisfied — the source can
/// be selected and the bundle will not revert.
  eligible: boolean;
  /// Why the source is disabled, when `eligible === false`. Surfaced
  /// gently in the UI so the user knows what's missing.
  reason?: 'overThreshold' | 'providerNotTrusting';
}

/// Enumerate every group-pot source the `viewer` could use to pay
/// `priceCrc` to `provider`. Reads localStorage for the viewer's kitty
/// cache, filters down to free-pot kitties where the viewer is a member
/// + the price fits the small-spend cap, then asks Hub V2 (one
/// multicall) whether the provider already trusts each kitty's
/// BaseGroup.
export async function readGroupPotPaySources(
  viewer: Address,
  provider: Address,
  priceCrc: bigint,
): Promise<GroupPotPaySource[]> {
  const cached = loadKitties(viewer);
  // Tontines aren't a pay surface — they're an accumulator. Drop them.
  const freePots = cached.filter((k) => (k.mode ?? 'free') === 'free');
  // Membership + threshold checks are local. Threshold mismatches are
  // worth showing in the UI as "over threshold" so the user knows why,
  // membership mismatches we just drop (the kitty isn't theirs to spend).
  const candidates = freePots.filter((k) =>
    k.members.some((m) => m.toLowerCase() === viewer.toLowerCase()),
  );
  if (candidates.length === 0) return [];

  // One multicall to Hub V2 to learn whether the provider trusts each
  // kitty's BaseGroup. The kitty bundle can't include a Hub.trust call
  // from the buyer that would help — trust must come from the
  // provider's wallet, by protocol.
  const client = getPublicClient();
  const results = await client.multicall({
    contracts: candidates.map((k) => ({
      abi: hubV2Abi,
      address: CIRCLES_CONFIG.v2HubAddress,
      functionName: 'isTrusted' as const,
      args: [provider, k.groupAvatar] as const,
    })),
    allowFailure: true,
  });

  const out: GroupPotPaySource[] = [];
  candidates.forEach((kitty, i) => {
    const threshold = safeBigInt(kitty.smallTxThreshold);
    const overThreshold = threshold === null ? false : priceCrc > threshold;
    if (overThreshold) {
      out.push({ kitty, eligible: false, reason: 'overThreshold' });
      return;
    }
    const r = results[i];
    const trusts = r && r.status === 'success' && r.result === true;
    out.push(
      trusts
        ? { kitty, eligible: true }
        : { kitty, eligible: false, reason: 'providerNotTrusting' },
    );
  });

  return out;
}

function safeBigInt(decimal: string): bigint | null {
  try {
    return BigInt(decimal);
  } catch {
    return null;
  }
}

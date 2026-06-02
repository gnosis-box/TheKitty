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
  reason?: 'overThreshold' | 'providerNotTrusting' | 'insufficientBalance';
  /// The kitty's current holding of its own pot token (uint256(uint160(
  /// kittyBaseGroup))). What the smallSpend tx can actually move.
  balance: bigint;
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

  // Two batched reads against Hub V2: (a) does the provider already
  // trust each kitty's BaseGroup, and (b) what's each kitty's current
  // pot-token holding. Both are necessary to surface an actionable
  // source — without the balance we can't tell the user whether the
  // smallSpend will revert on insufficient funds.
  const client = getPublicClient();
  const [trustResults, balanceResults] = await Promise.all([
    client.multicall({
      contracts: candidates.map((k) => ({
        abi: hubV2Abi,
        address: CIRCLES_CONFIG.v2HubAddress,
        functionName: 'isTrusted' as const,
        args: [provider, k.groupAvatar] as const,
      })),
      allowFailure: true,
    }),
    client.multicall({
      contracts: candidates.map((k) => ({
        abi: hubV2Abi,
        address: CIRCLES_CONFIG.v2HubAddress,
        functionName: 'balanceOf' as const,
        args: [k.governance, BigInt(k.groupAvatar)] as const,
      })),
      allowFailure: true,
    }),
  ]);

  const out: GroupPotPaySource[] = [];
  candidates.forEach((kitty, i) => {
    const balRes = balanceResults[i];
    const balance =
      balRes && balRes.status === 'success' ? (balRes.result as bigint) : 0n;
    const threshold = safeBigInt(kitty.smallTxThreshold);
    const overThreshold = threshold === null ? false : priceCrc > threshold;
    if (overThreshold) {
      out.push({ kitty, eligible: false, reason: 'overThreshold', balance });
      return;
    }
    if (balance < priceCrc) {
      out.push({
        kitty,
        eligible: false,
        reason: 'insufficientBalance',
        balance,
      });
      return;
    }
    const r = trustResults[i];
    const trusts = r && r.status === 'success' && r.result === true;
    out.push(
      trusts
        ? { kitty, eligible: true, balance }
        : { kitty, eligible: false, reason: 'providerNotTrusting', balance },
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

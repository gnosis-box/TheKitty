import { parseAbiItem } from 'viem';

import { CIRCLES_CONFIG } from './circles-config';
import { kittyGovernanceAbi } from './abi/kitty-governance';
import { getPublicClient } from './public-client';
import { shortAddress } from './utils';
import type { Address, KittyRef } from '@/types/kitty';

const KITTY_CREATED_EVENT = parseAbiItem(
  'event KittyCreated(address indexed creator, address indexed baseGroup, address indexed governance, address[] members, uint8 quorumPercent, uint128 smallTxThreshold, uint32 votingPeriod)',
);

/// Scan the deployed KittyFactory for all `KittyCreated` events whose
/// members[] payload contains `viewer`, then enrich each match with the
/// governance contract's tontine config so the home can render the right
/// badge and detail line.
///
/// The kitty itself is fully on-chain. This is just a discovery query the
/// front-end runs on home mount so a user who didn't *create* the kitty
/// (i.e. they were added as a member by someone else) still sees it on
/// their list, with no out-of-band coordination needed.
export async function discoverKittiesForMember(viewer: Address): Promise<KittyRef[]> {
  const factory = CIRCLES_CONFIG.kittyFactoryAddress;
  if (!factory) return [];
  const client = getPublicClient();

  const events = await client.getLogs({
    address: factory,
    event: KITTY_CREATED_EVENT,
    fromBlock: 'earliest',
  });

  const lc = viewer.toLowerCase();
  const matching = events.filter((e) =>
    (e.args.members ?? []).some((m) => (m as Address).toLowerCase() === lc),
  );
  if (matching.length === 0) return [];

  // Enrich each match by reading tontine config off the governance contract
  // in a single multicall batch. Per-kitty falls back to free-pot mode if
  // any read fails, so an unknown contract doesn't sink the whole list.
  const enrichments = await Promise.all(
    matching.map(async (e) => {
      const gov = e.args.governance as Address;
      try {
        const [tontineMode, roundDuration, roundContribution] = await client.multicall({
          contracts: [
            { abi: kittyGovernanceAbi, address: gov, functionName: 'tontineMode' },
            { abi: kittyGovernanceAbi, address: gov, functionName: 'roundDuration' },
            { abi: kittyGovernanceAbi, address: gov, functionName: 'roundContribution' },
          ],
          allowFailure: false,
        });
        return { gov, tontineMode, roundDuration, roundContribution };
      } catch {
        return { gov, tontineMode: false, roundDuration: 0, roundContribution: 0n };
      }
    }),
  );

  const enrichmentByGov = new Map(enrichments.map((e) => [e.gov.toLowerCase(), e]));

  return matching.map((e) => {
    const gov = e.args.governance as Address;
    const enrichment = enrichmentByGov.get(gov.toLowerCase());
    const isTontine = Boolean(enrichment?.tontineMode);
    return {
      governance: gov,
      groupAvatar: e.args.baseGroup as Address,
      name: `Kitty ${shortAddress(gov)}`,
      symbol: isTontine ? 'TON' : 'POT',
      members: [...((e.args.members ?? []) as Address[])],
      quorumPercent: Number(e.args.quorumPercent ?? 0),
      smallTxThreshold: ((e.args.smallTxThreshold as bigint | undefined) ?? 0n).toString(),
      votingPeriod: Number(e.args.votingPeriod ?? 0),
      createdAt: Math.floor(Date.now() / 1000),
      chainId: CIRCLES_CONFIG.chainId,
      mode: isTontine ? 'tontine' : 'free',
      ...(isTontine
        ? {
            roundContribution: (enrichment?.roundContribution ?? 0n).toString(),
            roundDuration: Number(enrichment?.roundDuration ?? 0),
          }
        : {}),
    };
  });
}

/// Merge a discovered list into the local one without dropping anything the
/// user already had. Discovery is additive — never destructive.
export function mergeDiscoveredKitties(local: KittyRef[], discovered: KittyRef[]): KittyRef[] {
  const known = new Set(local.map((k) => k.governance.toLowerCase()));
  const additions = discovered.filter((k) => !known.has(k.governance.toLowerCase()));
  return [...local, ...additions];
}

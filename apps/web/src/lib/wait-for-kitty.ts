import { decodeEventLog, type Hex } from 'viem';

import { kittyFactoryAbi } from './abi/kitty-factory';
import { CIRCLES_CONFIG } from './circles-config';
import { getPublicClient } from './public-client';
import type { Address } from '@/types/kitty';

export interface KittyCreatedResult {
  baseGroup: Address;
  governance: Address;
  creator: Address;
  members: readonly Address[];
  quorumPercent: number;
  smallTxThreshold: bigint;
  votingPeriod: number;
}

/// Wait for the createKitty tx to confirm, then decode the `KittyCreated`
/// event from the receipt and return the new BaseGroup + KittyGovernance
/// addresses.
export async function waitForKittyCreated(
  txHash: Hex,
  opts?: { timeoutMs?: number },
): Promise<KittyCreatedResult> {
  if (!CIRCLES_CONFIG.kittyFactoryAddress) {
    throw new Error('KittyFactory address not configured.');
  }
  const client = getPublicClient();
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    timeout: opts?.timeoutMs ?? 120_000,
  });

  if (receipt.status !== 'success') {
    throw new Error(`createKitty tx reverted (status=${receipt.status})`);
  }

  const factoryLogs = receipt.logs.filter(
    (l) => l.address.toLowerCase() === CIRCLES_CONFIG.kittyFactoryAddress!.toLowerCase(),
  );

  for (const log of factoryLogs) {
    try {
      const parsed = decodeEventLog({
        abi: kittyFactoryAbi,
        eventName: 'KittyCreated',
        topics: log.topics,
        data: log.data,
      });
      const args = parsed.args as Partial<{
        creator: Address;
        baseGroup: Address;
        governance: Address;
        members: readonly Address[];
        quorumPercent: number;
        smallTxThreshold: bigint;
        votingPeriod: number;
      }>;
      if (!args.governance || !args.baseGroup || !args.creator) {
        throw new Error(
          'KittyCreated event decoded but is missing core fields — ABI / contract mismatch?',
        );
      }
      return {
        creator: args.creator,
        baseGroup: args.baseGroup,
        governance: args.governance,
        members: args.members ?? [],
        quorumPercent: args.quorumPercent ?? 0,
        smallTxThreshold: args.smallTxThreshold ?? 0n,
        votingPeriod: args.votingPeriod ?? 0,
      };
    } catch {
      // Not the KittyCreated event — keep scanning.
    }
  }

  throw new Error('createKitty receipt contains no KittyCreated event from the factory.');
}

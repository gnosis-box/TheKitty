import { parseAbiItem } from 'viem';

import { getPublicClient } from './public-client';
import type { Address } from '@/types/kitty';

export type HistoryKind = 'executed' | 'small-spend';

export interface HistoryEntry {
  kind: HistoryKind;
  txHash: `0x${string}`;
  blockNumber: bigint;
  recipient: Address;
  amount: bigint;
  /// Memo for small-spends; empty for executed (lookup via proposalId in state).
  memo: string;
  /// Only set when kind === "executed".
  proposalId?: bigint;
  /// Only set when kind === "small-spend" — the member who paid directly.
  by?: Address;
}

const EXECUTED_EVENT = parseAbiItem(
  'event Executed(uint256 indexed id, address indexed recipient, uint128 amount)',
);

const SMALL_SPEND_EVENT = parseAbiItem(
  'event SmallSpend(address indexed by, address indexed recipient, uint128 amount, string memo)',
);

/// Fetch and merge `Executed` + `SmallSpend` events for a kitty governance
/// contract. Returns newest-first. Block timestamps are not fetched here to
/// keep the round-trip light — callers can resolve them lazily if needed.
export async function readKittyHistory(governance: Address): Promise<HistoryEntry[]> {
  const client = getPublicClient();

  const [executed, smallSpend] = await Promise.all([
    client.getLogs({
      address: governance,
      event: EXECUTED_EVENT,
      fromBlock: 'earliest',
    }),
    client.getLogs({
      address: governance,
      event: SMALL_SPEND_EVENT,
      fromBlock: 'earliest',
    }),
  ]);

  const entries: HistoryEntry[] = [];

  for (const log of executed) {
    if (!log.args.recipient || log.args.amount === undefined) continue;
    entries.push({
      kind: 'executed',
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      recipient: log.args.recipient as Address,
      amount: log.args.amount as bigint,
      memo: '',
      proposalId: log.args.id as bigint,
    });
  }

  for (const log of smallSpend) {
    if (!log.args.recipient || log.args.amount === undefined) continue;
    entries.push({
      kind: 'small-spend',
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      recipient: log.args.recipient as Address,
      amount: log.args.amount as bigint,
      memo: (log.args.memo as string) ?? '',
      by: log.args.by as Address,
    });
  }

  entries.sort((a, b) => Number(b.blockNumber - a.blockNumber));
  return entries;
}

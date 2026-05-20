import { CIRCLES_CONFIG } from './circles-config';
import { hubV2Abi } from './abi/hub-v2';
import { kittyGovernanceAbi } from './abi/kitty-governance';
import { getPublicClient } from './public-client';
import type { Address, ProposalView } from '@/types/kitty';

export interface KittyState {
  governance: Address;
  groupAvatar: Address;
  potTokenId: bigint;
  members: Address[];
  quorumPercent: number;
  smallTxThreshold: bigint;
  votingPeriod: number;
  totalDeposited: bigint;
  /// Live ERC-1155 balance of the kitty for its own pot token (held in the
  /// custodian contract).
  potBalance: bigint;
  /// Per-member contribution tracker (raw uint128 units).
  deposits: Record<string, bigint>;
  proposals: ProposalView[];
}

/// Batched on-chain read of everything the detail page needs.
///
/// Two multicall rounds:
///   1. top-level config + proposal count (so we know how many proposals to fetch)
///   2. per-member deposits + per-proposal data + hub balance
export async function readKittyState(governance: Address): Promise<KittyState> {
  const client = getPublicClient();
  const base = { abi: kittyGovernanceAbi, address: governance } as const;

  const [members, totalDeposited, proposalCount, groupAvatar, potTokenId, smallTxThreshold, quorumPercent, votingPeriod] = (await client.multicall({
    contracts: [
      { ...base, functionName: 'getMembers' },
      { ...base, functionName: 'totalDeposited' },
      { ...base, functionName: 'proposalCount' },
      { ...base, functionName: 'groupAvatar' },
      { ...base, functionName: 'potTokenId' },
      { ...base, functionName: 'smallTxThreshold' },
      { ...base, functionName: 'quorumPercent' },
      { ...base, functionName: 'votingPeriod' },
    ],
    allowFailure: false,
  })) as [Address[], bigint, bigint, Address, bigint, bigint, number, number];

  const proposalIds = Array.from({ length: Number(proposalCount) }, (_, i) => BigInt(i));

  const round2 = await client.multicall({
    contracts: [
      {
        abi: hubV2Abi,
        address: CIRCLES_CONFIG.v2HubAddress,
        functionName: 'balanceOf',
        args: [governance, potTokenId],
      },
      ...members.map((m) => ({ ...base, functionName: 'deposited' as const, args: [m] })),
      ...proposalIds.map((id) => ({
        ...base,
        functionName: 'getProposal' as const,
        args: [id],
      })),
    ],
    allowFailure: false,
  });

  let cursor = 0;
  const potBalance = round2[cursor++] as bigint;
  const depositsArr = round2.slice(cursor, cursor + members.length) as bigint[];
  cursor += members.length;
  const rawProposals = round2.slice(cursor) as ReadonlyArray<{
    proposer: Address;
    recipient: Address;
    amount: bigint;
    deadline: number;
    approvals: number;
    executed: boolean;
    memo: string;
  }>;

  const deposits: Record<string, bigint> = {};
  members.forEach((m, i) => {
    deposits[m.toLowerCase()] = depositsArr[i] ?? 0n;
  });

  const proposals: ProposalView[] = rawProposals.map((p, i) => ({
    id: proposalIds[i],
    proposer: p.proposer,
    recipient: p.recipient,
    amount: p.amount,
    deadline: p.deadline,
    approvals: p.approvals,
    executed: p.executed,
    memo: p.memo,
  }));

  return {
    governance,
    groupAvatar,
    potTokenId,
    members,
    quorumPercent: Number(quorumPercent),
    smallTxThreshold,
    votingPeriod: Number(votingPeriod),
    totalDeposited,
    potBalance,
    deposits,
    proposals,
  };
}

/// Has `member` already approved this proposal?
export async function readHasVoted(args: {
  governance: Address;
  proposalId: bigint;
  member: Address;
}): Promise<boolean> {
  const client = getPublicClient();
  return (await client.readContract({
    abi: kittyGovernanceAbi,
    address: args.governance,
    functionName: 'hasVoted',
    args: [args.proposalId, args.member],
  })) as boolean;
}

/// Read the user's personal CRC balance (id = toTokenId(userAvatar)).
/// Useful for the deposit page to show available funds.
export async function readPersonalCrcBalance(userAvatar: Address): Promise<bigint> {
  const client = getPublicClient();
  const [tokenId] = (await client.multicall({
    contracts: [
      {
        abi: hubV2Abi,
        address: CIRCLES_CONFIG.v2HubAddress,
        functionName: 'toTokenId',
        args: [userAvatar],
      },
    ],
    allowFailure: false,
  })) as [bigint];

  return (await client.readContract({
    abi: hubV2Abi,
    address: CIRCLES_CONFIG.v2HubAddress,
    functionName: 'balanceOf',
    args: [userAvatar, tokenId],
  })) as bigint;
}

/// Decide if the *next* approve will meet quorum.
export function nextApproveMeetsQuorum(
  proposal: Pick<ProposalView, 'approvals'>,
  memberCount: number,
  quorumPercent: number,
): boolean {
  return (proposal.approvals + 1) * 100 >= memberCount * quorumPercent;
}

/// Decide if the proposal already meets quorum (eligible for `execute`).
export function proposalReady(
  proposal: Pick<ProposalView, 'approvals' | 'executed'>,
  memberCount: number,
  quorumPercent: number,
): boolean {
  if (proposal.executed) return false;
  return proposal.approvals * 100 >= memberCount * quorumPercent;
}

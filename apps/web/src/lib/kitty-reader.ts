import { CIRCLES_CONFIG } from './circles-config';
import { hubV2Abi } from './abi/hub-v2';
import { kittyGovernanceAbi } from './abi/kitty-governance';
import { getPublicClient } from './public-client';
import type { Address, ProposalView } from '@/types/kitty';

export interface TontineState {
  /// True if this kitty was created in rotating-savings mode.
  enabled: boolean;
  /// Seconds between rounds. 0 when disabled.
  roundDuration: number;
  /// Raw uint128 amount each member commits per round. 0 when disabled.
  roundContribution: bigint;
  /// 0-indexed round number to be claimed next. 0 when disabled.
  currentRound: number;
  /// Unix timestamp (seconds) at which the current round becomes claimable.
  /// 0 when disabled.
  nextClaimAt: number;
  /// Address whose turn it is. Zero address when disabled.
  currentClaimer: Address;
  /// Computed payout per round = roundContribution * memberCount.
  roundPayout: bigint;
}

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
  tontine: TontineState;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

/// Batched on-chain read of everything the detail page needs.
///
/// Strategy:
///   1. One multicall on the governance ABI for top-level config + proposal count.
///   2. In parallel: per-member deposits multicall, per-proposal multicall,
///      and a single Hub `balanceOf` read. Splitting by ABI keeps viem's
///      multicall typing happy.
export async function readKittyState(governance: Address): Promise<KittyState> {
  const client = getPublicClient();
  const base = { abi: kittyGovernanceAbi, address: governance } as const;

  const [
    membersRaw,
    totalDeposited,
    proposalCount,
    groupAvatar,
    potTokenId,
    smallTxThreshold,
    quorumPercent,
    votingPeriod,
    tontineMode,
    roundDuration,
    roundContribution,
    currentRound,
    nextClaimAt,
  ] = await client.multicall({
    contracts: [
      { ...base, functionName: 'getMembers' },
      { ...base, functionName: 'totalDeposited' },
      { ...base, functionName: 'proposalCount' },
      { ...base, functionName: 'groupAvatar' },
      { ...base, functionName: 'potTokenId' },
      { ...base, functionName: 'smallTxThreshold' },
      { ...base, functionName: 'quorumPercent' },
      { ...base, functionName: 'votingPeriod' },
      { ...base, functionName: 'tontineMode' },
      { ...base, functionName: 'roundDuration' },
      { ...base, functionName: 'roundContribution' },
      { ...base, functionName: 'currentRound' },
      { ...base, functionName: 'nextClaimAt' },
    ],
    allowFailure: false,
  });

  const members = [...membersRaw] as Address[];
  const proposalIds = Array.from({ length: Number(proposalCount) }, (_, i) => BigInt(i));

  const [depositsArr, rawProposalsArr, potBalance] = await Promise.all([
    members.length > 0
      ? client.multicall({
          contracts: members.map((m) => ({
            ...base,
            functionName: 'deposited' as const,
            args: [m] as const,
          })),
          allowFailure: false,
        })
      : Promise.resolve([] as bigint[]),
    proposalIds.length > 0
      ? client.multicall({
          contracts: proposalIds.map((id) => ({
            ...base,
            functionName: 'getProposal' as const,
            args: [id] as const,
          })),
          allowFailure: false,
        })
      : Promise.resolve([] as ReadonlyArray<KittyGovernanceProposalTuple>),
    client.readContract({
      abi: hubV2Abi,
      address: CIRCLES_CONFIG.v2HubAddress,
      functionName: 'balanceOf',
      args: [governance, potTokenId],
    }),
  ]);

  const deposits: Record<string, bigint> = {};
  members.forEach((m, i) => {
    deposits[m.toLowerCase()] = (depositsArr[i] as bigint | undefined) ?? 0n;
  });

  const proposals: ProposalView[] = (rawProposalsArr as ReadonlyArray<KittyGovernanceProposalTuple>).map(
    (p, i) => ({
      id: proposalIds[i],
      proposer: p.proposer,
      recipient: p.recipient,
      amount: p.amount,
      deadline: Number(p.deadline),
      approvals: Number(p.approvals),
      executed: p.executed,
      memo: p.memo,
    }),
  );

  const tontineEnabled = Boolean(tontineMode);
  const contribution = (roundContribution as bigint) ?? 0n;
  const tontine: TontineState = {
    enabled: tontineEnabled,
    roundDuration: Number(roundDuration),
    roundContribution: contribution,
    currentRound: Number(currentRound),
    nextClaimAt: Number(nextClaimAt),
    currentClaimer: tontineEnabled
      ? (members[Number(currentRound) % members.length] ?? ZERO_ADDRESS)
      : ZERO_ADDRESS,
    roundPayout: tontineEnabled ? contribution * BigInt(members.length) : 0n,
  };

  return {
    governance,
    groupAvatar: groupAvatar as Address,
    potTokenId: potTokenId as bigint,
    members,
    quorumPercent: Number(quorumPercent),
    smallTxThreshold: smallTxThreshold as bigint,
    votingPeriod: Number(votingPeriod),
    totalDeposited: totalDeposited as bigint,
    potBalance: potBalance as bigint,
    deposits,
    proposals,
    tontine,
  };
}

interface KittyGovernanceProposalTuple {
  proposer: Address;
  recipient: Address;
  amount: bigint;
  deadline: number | bigint;
  approvals: number | bigint;
  executed: boolean;
  memo: string;
}

/// Has `member` already approved this proposal?
export async function readHasVoted(args: {
  governance: Address;
  proposalId: bigint;
  member: Address;
}): Promise<boolean> {
  const client = getPublicClient();
  return await client.readContract({
    abi: kittyGovernanceAbi,
    address: args.governance,
    functionName: 'hasVoted',
    args: [args.proposalId, args.member],
  });
}

/// Count how many of `members` the viewer's avatar currently trusts via the
/// Hub V2. Used by the home to surface a "X in your trust graph" hint on
/// each kitty card — a small signal that the kitty isn't strangers, it's
/// people the viewer already vouches for.
///
/// Implementation: a single multicall on Hub.isTrusted(viewer, member) for
/// each unique member. Returns 0 on RPC failure rather than blowing up the
/// card render.
export async function readTrustedCount(
  viewer: Address,
  members: readonly Address[],
): Promise<number> {
  if (members.length === 0) return 0;
  const client = getPublicClient();
  const unique = Array.from(new Set(members.map((m) => m.toLowerCase())));
  try {
    const results = await client.multicall({
      contracts: unique.map((m) => ({
        abi: hubV2Abi,
        address: CIRCLES_CONFIG.v2HubAddress,
        functionName: 'isTrusted' as const,
        args: [viewer, m as Address] as const,
      })),
      allowFailure: true,
    });
    let count = 0;
    for (const r of results) {
      if (r.status === 'success' && r.result === true) count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}

/// Read the user's personal CRC balance (id = toTokenId(userAvatar)).
/// Useful for the deposit page to show available funds.
export async function readPersonalCrcBalance(userAvatar: Address): Promise<bigint> {
  const client = getPublicClient();
  const tokenId = await client.readContract({
    abi: hubV2Abi,
    address: CIRCLES_CONFIG.v2HubAddress,
    functionName: 'toTokenId',
    args: [userAvatar],
  });
  return await client.readContract({
    abi: hubV2Abi,
    address: CIRCLES_CONFIG.v2HubAddress,
    functionName: 'balanceOf',
    args: [userAvatar, tokenId],
  });
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

import { CIRCLES_CONFIG } from './circles-config';
import { hubV2Abi } from './abi/hub-v2';
import { kittyGovernanceAbi } from './abi/kitty-governance';
import { getPublicClient } from './public-client';
import type { Address, ProposalView } from '@/types/kitty';

/// Lifecycle phase of a tontine kitty.
///   Setup    — stake-mode kitties wait here for every member to call
///              depositStake; honor-system kitties skip this state.
///   Active   — deposits + claims + proposals allowed.
///   Complete — cycleRounds claims have been settled; members can withdraw
///              their remaining stake.
export type KittyPhase = 'setup' | 'active' | 'complete';

export interface TontineState {
  /// True if this kitty was created in rotating-savings mode.
  enabled: boolean;
  /// Seconds between rounds. 0 when disabled.
  roundDuration: number;
  /// Raw uint128 amount each member commits per round. 0 when disabled.
  roundContribution: bigint;
  /// 0-indexed round number to be claimed next. 0 when disabled.
  currentRound: number;
  /// Total rounds in one cycle. 0 when disabled.
  cycleRounds: number;
  /// Unix timestamp (seconds) at which the current round becomes claimable.
  /// 0 when disabled.
  nextClaimAt: number;
  /// Address whose turn it is. Zero address when disabled.
  currentClaimer: Address;
  /// Computed payout per round = roundContribution * memberCount.
  roundPayout: bigint;
  /// Penalty stake required from each member at join time. 0 = honor system
  /// (no Setup phase, no slashing).
  stakeAmount: bigint;
  /// Lifecycle phase. Derived from `phase()` view.
  phase: KittyPhase;
  /// How many members have called depositStake. Used to render the
  /// "X / N members staked" progress in the Setup banner.
  stakedMemberCount: number;
  /// Per-member current stake balance (decreases on slash). Keyed by
  /// lowercased address.
  staked: Record<string, bigint>;
  /// Per-member hasStaked flag. Keyed by lowercased address. Used to gate
  /// the "Stake N CRC" button on the detail page.
  hasStaked: Record<string, boolean>;
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
    cycleRounds,
    stakeAmount,
    phaseRaw,
    stakedMemberCount,
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
      { ...base, functionName: 'cycleRounds' },
      { ...base, functionName: 'stakeAmount' },
      { ...base, functionName: 'phase' },
      { ...base, functionName: 'stakedMemberCount' },
    ],
    allowFailure: false,
  });

  const members = [...membersRaw] as Address[];
  const proposalIds = Array.from({ length: Number(proposalCount) }, (_, i) => BigInt(i));

  const stakeReadable = Boolean(tontineMode) && (stakeAmount as bigint) > 0n;

  const [
    depositsArr,
    rawProposalsArr,
    potBalance,
    stakedArr,
    hasStakedArr,
  ] = await Promise.all([
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
    stakeReadable && members.length > 0
      ? client.multicall({
          contracts: members.map((m) => ({
            ...base,
            functionName: 'staked' as const,
            args: [m] as const,
          })),
          allowFailure: false,
        })
      : Promise.resolve([] as bigint[]),
    stakeReadable && members.length > 0
      ? client.multicall({
          contracts: members.map((m) => ({
            ...base,
            functionName: 'hasStaked' as const,
            args: [m] as const,
          })),
          allowFailure: false,
        })
      : Promise.resolve([] as boolean[]),
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
  const stake = (stakeAmount as bigint) ?? 0n;

  const staked: Record<string, bigint> = {};
  const hasStaked: Record<string, boolean> = {};
  if (stakeReadable) {
    members.forEach((m, i) => {
      staked[m.toLowerCase()] = (stakedArr[i] as bigint | undefined) ?? 0n;
      hasStaked[m.toLowerCase()] = Boolean(hasStakedArr[i]);
    });
  }

  const phaseNum = Number(phaseRaw);
  const phase: KittyPhase = phaseNum === 0 ? 'setup' : phaseNum === 2 ? 'complete' : 'active';

  const tontine: TontineState = {
    enabled: tontineEnabled,
    roundDuration: Number(roundDuration),
    roundContribution: contribution,
    currentRound: Number(currentRound),
    cycleRounds: Number(cycleRounds),
    nextClaimAt: Number(nextClaimAt),
    currentClaimer: tontineEnabled
      ? (members[Number(currentRound) % members.length] ?? ZERO_ADDRESS)
      : ZERO_ADDRESS,
    roundPayout: tontineEnabled ? contribution * BigInt(members.length) : 0n,
    stakeAmount: stake,
    phase,
    stakedMemberCount: Number(stakedMemberCount),
    staked,
    hasStaked,
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

/// For each member, ask the Hub V2 whether `viewer` already trusts them.
/// Returns a record keyed by lowercased address. Members the viewer hasn't
/// trusted yet (false) or which the RPC failed on (silently false) get the
/// same value — the UI treats both as "show a Trust button". Use this on
/// the detail page to drive inline trust actions next to each member.
export async function readPerMemberTrust(
  viewer: Address,
  members: readonly Address[],
): Promise<Record<string, boolean>> {
  if (members.length === 0) return {};
  const client = getPublicClient();
  const unique = Array.from(new Set(members.map((m) => m.toLowerCase()))) as Address[];
  const out: Record<string, boolean> = {};
  try {
    const results = await client.multicall({
      contracts: unique.map((m) => ({
        abi: hubV2Abi,
        address: CIRCLES_CONFIG.v2HubAddress,
        functionName: 'isTrusted' as const,
        args: [viewer, m] as const,
      })),
      allowFailure: true,
    });
    results.forEach((r, i) => {
      out[unique[i]!] = r.status === 'success' && r.result === true;
    });
  } catch {
    unique.forEach((m) => (out[m] = false));
  }
  return out;
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

import { encodeFunctionData, type Hex } from 'viem';
import { Core } from '@aboutcircles/sdk-core';
import { circlesConfig } from '@aboutcircles/sdk-utils';
import type { TransactionRequest } from '@aboutcircles/sdk-types';

import type { MiniappTransaction } from '@/components/wallet/WalletProvider';
import type { Address } from '@/types/kitty';

import { CIRCLES_CONFIG } from './circles-config';
import { kittyFactoryAbi } from './abi/kitty-factory';
import { kittyGovernanceAbi } from './abi/kitty-governance';
import { serviceRegistryAbi } from './abi/service-registry';
import { buyerActivityAbi } from './abi/buyer-activity';
import { rewardPoolAbi } from './abi/reward-pool';

// uint96 max = 2**96 - 1 → "trust never expires" sentinel used by Circles V2.
export const TRUST_EXPIRY_NEVER: bigint = (1n << 96n) - 1n;

/// Lazy Core singleton — gives us typed Hub V2 / NameRegistry / wrapper
/// wrappers that build `TransactionRequest` objects (no calldata in our
/// repo). Cheap to construct; we keep one instance per module to avoid
/// re-allocating ABIs on every helper call.
let _core: Core | null = null;
function getCore(): Core {
  if (!_core) _core = new Core(circlesConfig[100]);
  return _core;
}

/// Convert an SDK `TransactionRequest` (bigint `value`) to the miniapp
/// host shape (string `value`). The host's `sendTransactions` expects the
/// latter; the SDK encoders produce the former.
function toMiniappTx(req: TransactionRequest): MiniappTransaction {
  return {
    to: req.to,
    data: req.data,
    value: req.value == null ? '0' : req.value.toString(),
  };
}

/// Tontine (ROSCA) configuration. When `enabled` is false, all other fields
/// MUST be zero — the contract reverts with `BadTontineParams` otherwise.
/// When enabled, each member claims in turn (by index) once `firstClaimAt`
/// has been reached, with `roundDuration` seconds between rounds. The payout
/// per round is `roundContribution * memberCount`. `cycleRounds` bounds the
/// total rounds before the kitty enters Phase.Complete (set to memberCount
/// for one full rotation, a multiple for more). `stakeAmount` is the
/// per-member penalty stake — 0 disables the stake mechanism entirely
/// (honor system); when > 0 the kitty starts in Phase.Setup until every
/// member has called depositStake.
export interface TontineInput {
  enabled: boolean;
  roundDurationSeconds: number;
  roundContribution: bigint;
  /// Unix timestamp (seconds) at which round 0 becomes claimable. Must be
  /// >= current block timestamp.
  firstClaimAtSeconds: number;
  cycleRounds: number;
  stakeAmount: bigint;
}

export const TONTINE_DISABLED: TontineInput = {
  enabled: false,
  roundDurationSeconds: 0,
  roundContribution: 0n,
  firstClaimAtSeconds: 0,
  cycleRounds: 0,
  stakeAmount: 0n,
};

export interface CreateKittyInputs {
  /// Human-readable kitty name (max 19 chars enforced by BaseGroup).
  name: string;
  /// 3-4 letter symbol for the ERC-1155 group token.
  symbol: string;
  /// Member Circles wallet addresses. Must be >= 2 and all unique. For tontine mode,
  /// the order of this list is the rotation order — index 0 claims round 0.
  members: Address[];
  /// 1-100. 51 = simple majority.
  quorumPercent: number;
  /// Raw uint128 amount under which any member can spend without a vote.
  smallTxThreshold: bigint;
  /// Voting window in seconds.
  votingPeriodSeconds: number;
  /// Where fees from the BaseGroup (if any) go. Default: the creator.
  feeCollection: Address;
  /// Optional service address on the BaseGroup. Default: zero.
  service?: Address;
  /// Optional IPFS metadata digest (bytes32). Default: zero.
  metadataDigest?: Hex;
  /// Optional rotating-savings (tontine) configuration. Default: disabled.
  tontine?: TontineInput;
}

/// Build the single `createKitty` transaction that spins up a BaseGroup,
/// deploys a KittyGovernance and trusts the founding members. The user signs
/// it once via the host's `sendTransactions([...])`.
export function buildCreateKittyTx(inputs: CreateKittyInputs): MiniappTransaction {
  if (!CIRCLES_CONFIG.kittyFactoryAddress) {
    throw new Error(
      'KittyFactory address not configured — set VITE_KITTY_FACTORY after deploying.',
    );
  }
  if (inputs.name.length > 19) {
    throw new Error('Kitty name exceeds 19 characters (BaseGroup limit).');
  }
  if (inputs.members.length < 2) {
    throw new Error('A kitty needs at least 2 members.');
  }
  if (inputs.quorumPercent < 1 || inputs.quorumPercent > 100) {
    throw new Error('Quorum must be between 1 and 100.');
  }
  const tontine = inputs.tontine ?? TONTINE_DISABLED;
  if (tontine.enabled) {
    if (tontine.roundDurationSeconds <= 0 || tontine.roundContribution <= 0n) {
      throw new Error('Tontine mode requires non-zero round duration and contribution.');
    }
  }

  const data = encodeFunctionData({
    abi: kittyFactoryAbi,
    functionName: 'createKitty',
    args: [
      {
        service: inputs.service ?? '0x0000000000000000000000000000000000000000',
        feeCollection: inputs.feeCollection,
        initialConditions: [],
        name: inputs.name,
        symbol: inputs.symbol,
        metadataDigest:
          inputs.metadataDigest ??
          '0x0000000000000000000000000000000000000000000000000000000000000000',
      },
      {
        members: inputs.members,
        quorumPercent: inputs.quorumPercent,
        smallTxThreshold: inputs.smallTxThreshold,
        votingPeriod: inputs.votingPeriodSeconds,
        trustExpiry: TRUST_EXPIRY_NEVER,
        tontine: {
          enabled: tontine.enabled,
          roundDuration: tontine.roundDurationSeconds,
          roundContribution: tontine.roundContribution,
          firstClaimAt: tontine.firstClaimAtSeconds,
          cycleRounds: tontine.cycleRounds,
          stakeAmount: tontine.stakeAmount,
        },
      },
    ],
  });

  return {
    to: CIRCLES_CONFIG.kittyFactoryAddress,
    data,
    value: '0',
  };
}

/// Build the deposit bundle: groupMint personal CRC into pot tokens, then
/// send those pot tokens to the kitty (which custodies the pool).
/// User signs one Safe execution → 2 calldata items.
export function buildDepositBundle(args: {
  member: Address;
  baseGroup: Address;
  governance: Address;
  potTokenId: bigint;
  /// Amount of personal CRC to commit (uint256 base units, e.g. 30e18 = 30 CRC).
  amount: bigint;
}): MiniappTransaction[] {
  const core = getCore();
  return [
    toMiniappTx(
      core.hubV2.groupMint(args.baseGroup, [args.member], [args.amount], '0x'),
    ),
    toMiniappTx(
      core.hubV2.safeTransferFrom(
        args.member,
        args.governance,
        args.potTokenId,
        args.amount,
        '0x',
      ),
    ),
  ];
}

/// Build a `propose` tx.
export function buildProposeTx(args: {
  governance: Address;
  recipient: Address;
  amount: bigint;
  memo: string;
}): MiniappTransaction {
  return {
    to: args.governance,
    data: encodeFunctionData({
      abi: kittyGovernanceAbi,
      functionName: 'propose',
      args: [args.recipient, args.amount, args.memo],
    }),
    value: '0',
  };
}

/// Build an `approve` tx.
export function buildApproveTx(args: {
  governance: Address;
  proposalId: bigint;
}): MiniappTransaction {
  return {
    to: args.governance,
    data: encodeFunctionData({
      abi: kittyGovernanceAbi,
      functionName: 'approve',
      args: [args.proposalId],
    }),
    value: '0',
  };
}

/// Build an `execute` tx. Front-end bundles `[approve, execute]` when the
/// next vote will meet quorum.
export function buildExecuteTx(args: {
  governance: Address;
  proposalId: bigint;
}): MiniappTransaction {
  return {
    to: args.governance,
    data: encodeFunctionData({
      abi: kittyGovernanceAbi,
      functionName: 'execute',
      args: [args.proposalId],
    }),
    value: '0',
  };
}

/// Build a `Hub.trust(trustee, expiry)` tx. The caller's Safe vouches for the
/// trustee in the Circles V2 trust graph from now to `TRUST_EXPIRY_NEVER`.
/// Used both for trusting a group avatar (so the member can deposit into the
/// pool) and for trusting individual humans inline from the kitty detail
/// page — same primitive either way.
export function buildTrustTx(args: { trustee: Address }): MiniappTransaction {
  return toMiniappTx(getCore().hubV2.trust(args.trustee, TRUST_EXPIRY_NEVER));
}

/// Build a `claimRound` tx for tontine mode.
export function buildClaimRoundTx(args: { governance: Address }): MiniappTransaction {
  return {
    to: args.governance,
    data: encodeFunctionData({
      abi: kittyGovernanceAbi,
      functionName: 'claimRound',
      args: [],
    }),
    value: '0',
  };
}

/// Build a `depositStake` tx — the second half of the two-step stake flow.
/// The member must have already transferred `stakeAmount` worth of pot
/// tokens into the kitty (bundle via buildDepositBundle); this call
/// reclassifies that deposit as the penalty stake and bumps the
/// stakedMemberCount.
export function buildDepositStakeTx(args: { governance: Address }): MiniappTransaction {
  return {
    to: args.governance,
    data: encodeFunctionData({
      abi: kittyGovernanceAbi,
      functionName: 'depositStake',
      args: [],
    }),
    value: '0',
  };
}

/// Build a `withdrawStake` tx — only available once the kitty enters
/// Phase.Complete. Returns the member's remaining stake (whatever wasn't
/// slashed for defaults) as pot tokens to the caller.
export function buildWithdrawStakeTx(args: { governance: Address }): MiniappTransaction {
  return {
    to: args.governance,
    data: encodeFunctionData({
      abi: kittyGovernanceAbi,
      functionName: 'withdrawStake',
      args: [],
    }),
    value: '0',
  };
}

/// Build a `smallSpend` tx.
export function buildSmallSpendTx(args: {
  governance: Address;
  recipient: Address;
  amount: bigint;
  memo: string;
}): MiniappTransaction {
  return {
    to: args.governance,
    data: encodeFunctionData({
      abi: kittyGovernanceAbi,
      functionName: 'smallSpend',
      args: [args.recipient, args.amount, args.memo],
    }),
    value: '0',
  };
}

// ── ServiceRegistry transactions ──────────────────────────────────────────

/// Build a `publish` tx for the singleton ServiceRegistry v2. Includes the
/// provider's opt-in `poolShareBps` (0–2000) — the % of every payment they
/// want routed to the community pool. The contract just records the
/// declared share; the PaySheet computes and bundles the actual split.
export function buildPublishServiceTx(args: {
  title: string;
  description: string;
  priceCrc: bigint;
  durationMins: number;
  poolShareBps: number;
}): MiniappTransaction {
  if (!CIRCLES_CONFIG.serviceRegistryAddress) {
    throw new Error('ServiceRegistry address not configured (VITE_SERVICE_REGISTRY).');
  }
  return {
    to: CIRCLES_CONFIG.serviceRegistryAddress,
    data: encodeFunctionData({
      abi: serviceRegistryAbi,
      functionName: 'publish',
      args: [args.title, args.description, args.priceCrc, args.durationMins, args.poolShareBps],
    }),
    value: '0',
  };
}

/// Build an `update` tx (provider-only on-chain). v2 includes the
/// editable `poolShareBps` so providers can adjust their community
/// contribution over time.
export function buildUpdateServiceTx(args: {
  id: bigint;
  title: string;
  description: string;
  priceCrc: bigint;
  durationMins: number;
  poolShareBps: number;
}): MiniappTransaction {
  if (!CIRCLES_CONFIG.serviceRegistryAddress) {
    throw new Error('ServiceRegistry address not configured.');
  }
  return {
    to: CIRCLES_CONFIG.serviceRegistryAddress,
    data: encodeFunctionData({
      abi: serviceRegistryAbi,
      functionName: 'update',
      args: [args.id, args.title, args.description, args.priceCrc, args.durationMins, args.poolShareBps],
    }),
    value: '0',
  };
}

/// Build a `deactivate` tx (provider-only on-chain).
export function buildDeactivateServiceTx(args: { id: bigint }): MiniappTransaction {
  if (!CIRCLES_CONFIG.serviceRegistryAddress) {
    throw new Error('ServiceRegistry address not configured.');
  }
  return {
    to: CIRCLES_CONFIG.serviceRegistryAddress,
    data: encodeFunctionData({
      abi: serviceRegistryAbi,
      functionName: 'deactivate',
      args: [args.id],
    }),
    value: '0',
  };
}

/// Build a `logPayment` tx — bundled AFTER a real Hub.safeTransferFrom in
/// the same signature so the on-chain trace mirrors the actual payment.
export function buildLogPaymentTx(args: {
  serviceId: bigint;
  amount: bigint;
  memo: string;
}): MiniappTransaction {
  if (!CIRCLES_CONFIG.serviceRegistryAddress) {
    throw new Error('ServiceRegistry address not configured.');
  }
  return {
    to: CIRCLES_CONFIG.serviceRegistryAddress,
    data: encodeFunctionData({
      abi: serviceRegistryAbi,
      functionName: 'logPayment',
      args: [args.serviceId, args.amount, args.memo],
    }),
    value: '0',
  };
}

// ── Rewards pool transactions (Republish 5) ──────────────────────────────

/// Build a `BuyerActivity.markPaid()` tx. Idempotent — calling more than
/// once is a no-op (firstPaidAt is sticky after the first set). Bundled
/// BEFORE `Hub.groupMint` in the pool route so the OpenMintPolicy's
/// `hasPaid` gate is satisfied by the time the mint reaches the Hub.
export function buildMarkPaidTx(): MiniappTransaction {
  if (!CIRCLES_CONFIG.buyerActivityAddress) {
    throw new Error('BuyerActivity address not configured (VITE_BUYER_ACTIVITY).');
  }
  return {
    to: CIRCLES_CONFIG.buyerActivityAddress,
    data: encodeFunctionData({
      abi: buyerActivityAbi,
      functionName: 'markPaid',
      args: [],
    }),
    value: '0',
  };
}

/// Build a `RewardPool.enterWeek()` tx. Registers the buyer as eligible
/// for the current week's draw. Idempotent within a week (re-entering is
/// a no-op). Bundled at the end of the pool route, AFTER `groupMint` and
/// the pool token transfer, so the buyer is on the books for the prize
/// they just helped fund.
export function buildEnterPoolWeekTx(): MiniappTransaction {
  if (!CIRCLES_CONFIG.rewardPoolAddress) {
    throw new Error('RewardPool address not configured (VITE_REWARD_POOL).');
  }
  return {
    to: CIRCLES_CONFIG.rewardPoolAddress,
    data: encodeFunctionData({
      abi: rewardPoolAbi,
      functionName: 'enterWeek',
      args: [],
    }),
    value: '0',
  };
}

/// Build a `RewardPool.enterProviderWeek(provider)` tx. Bundled in the
/// PaySheet pool route right after the buyer's `enterWeek()` call —
/// when the buyer pays a service with a community share, the provider
/// who got paid is auto-enrolled in the parallel provider draw for the
/// current week.
export function buildEnterProviderWeekTx(args: { provider: Address }): MiniappTransaction {
  if (!CIRCLES_CONFIG.rewardPoolAddress) {
    throw new Error('RewardPool address not configured (VITE_REWARD_POOL).');
  }
  return {
    to: CIRCLES_CONFIG.rewardPoolAddress,
    data: encodeFunctionData({
      abi: rewardPoolAbi,
      functionName: 'enterProviderWeek',
      args: [args.provider],
    }),
    value: '0',
  };
}

/// Build a `RewardPool.claimProvider(weekIndex)` tx. Mirrors `claim`
/// but for the provider-side draw winner.
export function buildClaimProviderPrizeTx(args: {
  weekIndex: bigint;
}): MiniappTransaction {
  if (!CIRCLES_CONFIG.rewardPoolAddress) {
    throw new Error('RewardPool address not configured.');
  }
  return {
    to: CIRCLES_CONFIG.rewardPoolAddress,
    data: encodeFunctionData({
      abi: rewardPoolAbi,
      functionName: 'claimProvider',
      args: [args.weekIndex],
    }),
    value: '0',
  };
}

/// Build a `RewardPool.claim(weekIndex)` tx. The winner of a past week's
/// draw calls this to receive their snapshotted prize (group tokens of
/// the pool). They must have trusted the pool group prior to receiving
/// (auto-bundled the first time they pay a pool-share service via the
/// PaySheet pool route).
export function buildClaimPrizeTx(args: { weekIndex: bigint }): MiniappTransaction {
  if (!CIRCLES_CONFIG.rewardPoolAddress) {
    throw new Error('RewardPool address not configured.');
  }
  return {
    to: CIRCLES_CONFIG.rewardPoolAddress,
    data: encodeFunctionData({
      abi: rewardPoolAbi,
      functionName: 'claim',
      args: [args.weekIndex],
    }),
    value: '0',
  };
}

/// Build a `RewardPool.drawWeekly(weekIndex)` tx. Anyone can call after
/// the target week has fully closed (`weekIndex < currentWeek()`). Picks
/// a random eligible buyer via `block.prevrandao` and snapshots the
/// pool's current group-token balance as the prize.
export function buildDrawWeeklyTx(args: { weekIndex: bigint }): MiniappTransaction {
  if (!CIRCLES_CONFIG.rewardPoolAddress) {
    throw new Error('RewardPool address not configured.');
  }
  return {
    to: CIRCLES_CONFIG.rewardPoolAddress,
    data: encodeFunctionData({
      abi: rewardPoolAbi,
      functionName: 'drawWeekly',
      args: [args.weekIndex],
    }),
    value: '0',
  };
}

/// Build a `rate` tx (1..5 stars). Re-rating overwrites the previous slot.
export function buildRateServiceTx(args: {
  serviceId: bigint;
  stars: number;
}): MiniappTransaction {
  if (!CIRCLES_CONFIG.serviceRegistryAddress) {
    throw new Error('ServiceRegistry address not configured.');
  }
  return {
    to: CIRCLES_CONFIG.serviceRegistryAddress,
    data: encodeFunctionData({
      abi: serviceRegistryAbi,
      functionName: 'rate',
      args: [args.serviceId, args.stars],
    }),
    value: '0',
  };
}

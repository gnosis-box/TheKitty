import { encodeFunctionData, type Hex } from 'viem';

import type { MiniappTransaction } from '@/components/wallet/WalletProvider';
import type { Address } from '@/types/kitty';

import { CIRCLES_CONFIG } from './circles-config';
import { hubV2Abi } from './abi/hub-v2';
import { kittyFactoryAbi } from './abi/kitty-factory';
import { kittyGovernanceAbi } from './abi/kitty-governance';

// uint96 max = 2**96 - 1 → "trust never expires" sentinel used by Circles V2.
export const TRUST_EXPIRY_NEVER: bigint = (1n << 96n) - 1n;

export interface CreateKittyInputs {
  /// Human-readable kitty name (max 19 chars enforced by BaseGroup).
  name: string;
  /// 3-4 letter symbol for the ERC-1155 group token.
  symbol: string;
  /// Member Safe addresses. Must be >= 2 and all unique.
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
  const hub = CIRCLES_CONFIG.v2HubAddress;
  const groupMint = encodeFunctionData({
    abi: hubV2Abi,
    functionName: 'groupMint',
    args: [args.baseGroup, [args.member], [args.amount], '0x'],
  });
  const transfer = encodeFunctionData({
    abi: hubV2Abi,
    functionName: 'safeTransferFrom',
    args: [args.member, args.governance, args.potTokenId, args.amount, '0x'],
  });
  return [
    { to: hub, data: groupMint, value: '0' },
    { to: hub, data: transfer, value: '0' },
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

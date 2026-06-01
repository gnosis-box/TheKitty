export type Address = `0x${string}`;

export type KittyMode = 'tontine' | 'free';

export interface KittyRef {
  /// Address of the deployed KittyGovernance contract.
  governance: Address;
  /// Address of the Circles V2 group avatar (the Safe registered as a group).
  groupAvatar: Address;
  /// Human-readable name chosen at creation time.
  name: string;
  /// 3-4 letter symbol used for the ERC-1155 group token.
  symbol: string;
  /// Member Circles wallet addresses, in creation order.
  members: Address[];
  /// Quorum required (1-100). 51 = simple majority.
  quorumPercent: number;
  /// Spend cap below which any member can pay without a vote (raw uint128, decimal string).
  smallTxThreshold: string;
  /// Voting window per proposal, in seconds.
  votingPeriod: number;
  /// Unix timestamp (seconds) of the creation tx.
  createdAt: number;
  /// Chain id (100 = Gnosis mainnet / sandbox).
  chainId: number;
  /// Whether the kitty was created in rotating-savings mode. Optional for
  /// backward compat with entries saved before this field existed — those
  /// default to 'free' (the only mode that existed back then).
  mode?: KittyMode;
  /// Per-member contribution (raw uint128 as decimal string) when mode='tontine'.
  roundContribution?: string;
  /// Round length in seconds when mode='tontine'.
  roundDuration?: number;
  /// Total rounds in a full cycle when mode='tontine'.
  cycleRounds?: number;
  /// Per-member penalty stake (raw uint128 as decimal string). 0 = no stake.
  stakeAmount?: string;
}

export interface ProposalView {
  id: bigint;
  proposer: Address;
  recipient: Address;
  amount: bigint;
  deadline: number;
  approvals: number;
  executed: boolean;
  memo: string;
}

// Hand-written viem-compatible ABI for KittyGovernance.sol (solc 0.8.24).
// Source of truth: contracts/src/KittyGovernance.sol. Keep in sync.
// To regenerate from forge: `forge inspect KittyGovernance abi`.

export const kittyGovernanceAbi = [
  // ── constructor ────────────────────────────────────────────────────────────
  {
    type: 'constructor',
    inputs: [
      { name: '_hub', type: 'address' },
      { name: '_groupAvatar', type: 'address' },
      { name: 'members_', type: 'address[]' },
      { name: '_quorumPercent', type: 'uint8' },
      { name: '_smallTxThreshold', type: 'uint128' },
      { name: '_votingPeriod', type: 'uint32' },
      {
        name: '_tontine',
        type: 'tuple',
        components: [
          { name: 'enabled', type: 'bool' },
          { name: 'roundDuration', type: 'uint32' },
          { name: 'roundContribution', type: 'uint128' },
          { name: 'firstClaimAt', type: 'uint32' },
        ],
      },
    ],
    stateMutability: 'nonpayable',
  },

  // ── state-changing ─────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'smallSpend',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint128' },
      { name: 'memo', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'propose',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint128' },
      { name: 'memo', type: 'string' },
    ],
    outputs: [{ name: 'id', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'execute',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimRound',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── views ──────────────────────────────────────────────────────────────────
  { type: 'function', name: 'hub', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'groupAvatar', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'potTokenId', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'quorumPercent', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'smallTxThreshold', inputs: [], outputs: [{ type: 'uint128' }], stateMutability: 'view' },
  { type: 'function', name: 'votingPeriod', inputs: [], outputs: [{ type: 'uint32' }], stateMutability: 'view' },
  { type: 'function', name: 'tontineMode', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'roundDuration', inputs: [], outputs: [{ type: 'uint32' }], stateMutability: 'view' },
  { type: 'function', name: 'roundContribution', inputs: [], outputs: [{ type: 'uint128' }], stateMutability: 'view' },
  { type: 'function', name: 'currentRound', inputs: [], outputs: [{ type: 'uint32' }], stateMutability: 'view' },
  { type: 'function', name: 'nextClaimAt', inputs: [], outputs: [{ type: 'uint32' }], stateMutability: 'view' },
  { type: 'function', name: 'currentClaimer', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'roundPayout', inputs: [], outputs: [{ type: 'uint128' }], stateMutability: 'view' },
  {
    type: 'function',
    name: 'isMember',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasVoted',
    inputs: [{ type: 'uint256' }, { type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  { type: 'function', name: 'memberCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  {
    type: 'function',
    name: 'getMembers',
    inputs: [],
    outputs: [{ type: 'address[]' }],
    stateMutability: 'view',
  },
  { type: 'function', name: 'proposalCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  {
    type: 'function',
    name: 'deposited',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint128' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalDeposited',
    inputs: [],
    outputs: [{ type: 'uint128' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'supportsInterface',
    inputs: [{ type: 'bytes4' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getProposal',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'proposer', type: 'address' },
          { name: 'recipient', type: 'address' },
          { name: 'amount', type: 'uint128' },
          { name: 'deadline', type: 'uint32' },
          { name: 'approvals', type: 'uint32' },
          { name: 'executed', type: 'bool' },
          { name: 'memo', type: 'string' },
        ],
      },
    ],
    stateMutability: 'view',
  },

  // ── events ─────────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'KittyInitialized',
    inputs: [
      { indexed: true, name: 'group', type: 'address' },
      { indexed: false, name: 'members', type: 'address[]' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Proposed',
    inputs: [
      { indexed: true, name: 'id', type: 'uint256' },
      { indexed: true, name: 'proposer', type: 'address' },
      { indexed: true, name: 'recipient', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint128' },
      { indexed: false, name: 'deadline', type: 'uint32' },
      { indexed: false, name: 'memo', type: 'string' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Approved',
    inputs: [
      { indexed: true, name: 'id', type: 'uint256' },
      { indexed: true, name: 'voter', type: 'address' },
      { indexed: false, name: 'approvals', type: 'uint32' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Executed',
    inputs: [
      { indexed: true, name: 'id', type: 'uint256' },
      { indexed: true, name: 'recipient', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint128' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SmallSpend',
    inputs: [
      { indexed: true, name: 'by', type: 'address' },
      { indexed: true, name: 'recipient', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint128' },
      { indexed: false, name: 'memo', type: 'string' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Deposit',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint128' },
      { indexed: false, name: 'newTotal', type: 'uint128' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TontineInitialized',
    inputs: [
      { indexed: false, name: 'roundDuration', type: 'uint32' },
      { indexed: false, name: 'roundContribution', type: 'uint128' },
      { indexed: false, name: 'firstClaimAt', type: 'uint32' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RoundClaimed',
    inputs: [
      { indexed: true, name: 'round', type: 'uint32' },
      { indexed: true, name: 'claimer', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint128' },
      { indexed: false, name: 'nextClaimAt', type: 'uint32' },
    ],
    anonymous: false,
  },

  // ── errors ─────────────────────────────────────────────────────────────────
  { type: 'error', name: 'NotMember', inputs: [] },
  { type: 'error', name: 'BadQuorum', inputs: [] },
  { type: 'error', name: 'BadVotingPeriod', inputs: [] },
  { type: 'error', name: 'NotEnoughMembers', inputs: [] },
  { type: 'error', name: 'DuplicateMember', inputs: [] },
  { type: 'error', name: 'AmountExceedsThreshold', inputs: [] },
  { type: 'error', name: 'AlreadyExecuted', inputs: [] },
  { type: 'error', name: 'AlreadyVoted', inputs: [] },
  { type: 'error', name: 'VotingClosed', inputs: [] },
  { type: 'error', name: 'QuorumNotReached', inputs: [] },
  { type: 'error', name: 'UnknownProposal', inputs: [] },
  { type: 'error', name: 'OnlyHub', inputs: [] },
  { type: 'error', name: 'WrongTokenId', inputs: [] },
  { type: 'error', name: 'ZeroAddress', inputs: [] },
  { type: 'error', name: 'DirectMintNotAllowed', inputs: [] },
  { type: 'error', name: 'MemoTooLong', inputs: [] },
  { type: 'error', name: 'NotTontine', inputs: [] },
  { type: 'error', name: 'BadTontineParams', inputs: [] },
  { type: 'error', name: 'RoundNotReady', inputs: [] },
  { type: 'error', name: 'NotYourTurn', inputs: [] },
  // Inherited from OpenZeppelin ReentrancyGuard / SafeCast.
  { type: 'error', name: 'ReentrancyGuardReentrantCall', inputs: [] },
  {
    type: 'error',
    name: 'SafeCastOverflowedUintDowncast',
    inputs: [
      { name: 'bits', type: 'uint8' },
      { name: 'value', type: 'uint256' },
    ],
  },
] as const;

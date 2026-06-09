/// ABI of `RewardPool` (Republish 5). The contract address is both the
/// prize custodian and the pool group avatar `TheKittyPool` / `TKP`
/// registered on Hub V2 with `OpenMintPolicy` attached. Front-end uses
/// it for:
///   - reading the current pool balance and weekly state on `/stats`
///   - calling `enterWeek()` in the PaySheet bundle so a buyer who just
///     paid is in the current week's draw
///   - winner UX (`claim`)
///   - reading event history (`WinnerDrawn`, `Claimed`) for the leaderboard

export const rewardPoolAbi = [
  // ── views ──
  {
    type: 'function',
    name: 'selfTokenId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'mintPolicy',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'currentWeek',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'entriesCount',
    stateMutability: 'view',
    inputs: [{ name: 'weekIndex', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'entries',
    stateMutability: 'view',
    inputs: [{ name: 'weekIndex', type: 'uint256' }],
    outputs: [{ type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'enteredWeek',
    stateMutability: 'view',
    inputs: [
      { name: 'weekIndex', type: 'uint256' },
      { name: 'buyer', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'winners',
    stateMutability: 'view',
    inputs: [{ name: 'weekIndex', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'weeklyPrize',
    stateMutability: 'view',
    inputs: [{ name: 'weekIndex', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'claimed',
    stateMutability: 'view',
    inputs: [{ name: 'weekIndex', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'poolBalance',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  // ── writes ──
  {
    type: 'function',
    name: 'enterWeek',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'drawWeekly',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'weekIndex', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'weekIndex', type: 'uint256' }],
    outputs: [],
  },
  // ── events ──
  {
    type: 'event',
    name: 'WeekEntered',
    inputs: [
      { indexed: true, name: 'weekIndex', type: 'uint256' },
      { indexed: true, name: 'buyer', type: 'address' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'WinnerDrawn',
    inputs: [
      { indexed: true, name: 'weekIndex', type: 'uint256' },
      { indexed: true, name: 'winner', type: 'address' },
      { indexed: false, name: 'prize', type: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Claimed',
    inputs: [
      { indexed: true, name: 'weekIndex', type: 'uint256' },
      { indexed: true, name: 'winner', type: 'address' },
      { indexed: false, name: 'prize', type: 'uint256' },
    ],
    anonymous: false,
  },
] as const;

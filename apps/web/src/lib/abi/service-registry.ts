// Hand-written viem-compatible ABI for ServiceRegistry.sol (solc 0.8.24).
// Source of truth: contracts/src/ServiceRegistry.sol. Keep in sync.
// To regenerate from forge: `forge inspect ServiceRegistry abi`.

export const serviceRegistryAbi = [
  // ── constants ──────────────────────────────────────────────────────────────
  { type: 'function', name: 'MAX_TITLE_LEN', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'MAX_DESCRIPTION_LEN', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'MAX_MEMO_LEN', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'MAX_POOL_SHARE_BPS', inputs: [], outputs: [{ type: 'uint16' }], stateMutability: 'view' },

  // ── write ──────────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'publish',
    inputs: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'priceCrc', type: 'uint128' },
      { name: 'durationMins', type: 'uint32' },
      { name: 'poolShareBps', type: 'uint16' },
    ],
    outputs: [{ name: 'id', type: 'uint64' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'update',
    inputs: [
      { name: 'id', type: 'uint64' },
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'priceCrc', type: 'uint128' },
      { name: 'durationMins', type: 'uint32' },
      { name: 'poolShareBps', type: 'uint16' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'deactivate',
    inputs: [{ name: 'id', type: 'uint64' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'logPayment',
    inputs: [
      { name: 'id', type: 'uint64' },
      { name: 'amount', type: 'uint128' },
      { name: 'memo', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'rate',
    inputs: [
      { name: 'id', type: 'uint64' },
      { name: 'stars', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── views ──────────────────────────────────────────────────────────────────
  { type: 'function', name: 'serviceCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  {
    type: 'function',
    name: 'getService',
    inputs: [{ name: 'id', type: 'uint64' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint64' },
          { name: 'provider', type: 'address' },
          { name: 'title', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'priceCrc', type: 'uint128' },
          { name: 'durationMins', type: 'uint32' },
          { name: 'active', type: 'bool' },
          { name: 'createdAt', type: 'uint64' },
          { name: 'poolShareBps', type: 'uint16' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'servicesByProvider',
    inputs: [{ type: 'address' }],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'id', type: 'uint64' },
          { name: 'provider', type: 'address' },
          { name: 'title', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'priceCrc', type: 'uint128' },
          { name: 'durationMins', type: 'uint32' },
          { name: 'active', type: 'bool' },
          { name: 'createdAt', type: 'uint64' },
          { name: 'poolShareBps', type: 'uint16' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'activeServicesByProvider',
    inputs: [{ type: 'address' }],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'id', type: 'uint64' },
          { name: 'provider', type: 'address' },
          { name: 'title', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'priceCrc', type: 'uint128' },
          { name: 'durationMins', type: 'uint32' },
          { name: 'active', type: 'bool' },
          { name: 'createdAt', type: 'uint64' },
          { name: 'poolShareBps', type: 'uint16' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'serviceIdsByProvider',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint64[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'timesPaid',
    inputs: [{ type: 'uint64' }],
    outputs: [{ type: 'uint128' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalPaid',
    inputs: [{ type: 'uint64' }],
    outputs: [{ type: 'uint128' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ratingsSum',
    inputs: [{ type: 'uint64' }],
    outputs: [{ type: 'uint128' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ratingsCount',
    inputs: [{ type: 'uint64' }],
    outputs: [{ type: 'uint64' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ratingBy',
    inputs: [
      { type: 'uint64' },
      { type: 'address' },
    ],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },

  // ── events ─────────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'ServicePublished',
    inputs: [
      { indexed: true, name: 'id', type: 'uint64' },
      { indexed: true, name: 'provider', type: 'address' },
      { indexed: false, name: 'title', type: 'string' },
      { indexed: false, name: 'priceCrc', type: 'uint128' },
      { indexed: false, name: 'durationMins', type: 'uint32' },
      { indexed: false, name: 'poolShareBps', type: 'uint16' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ServiceUpdated',
    inputs: [
      { indexed: true, name: 'id', type: 'uint64' },
      { indexed: true, name: 'provider', type: 'address' },
      { indexed: false, name: 'title', type: 'string' },
      { indexed: false, name: 'priceCrc', type: 'uint128' },
      { indexed: false, name: 'durationMins', type: 'uint32' },
      { indexed: false, name: 'poolShareBps', type: 'uint16' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ServiceDeactivated',
    inputs: [
      { indexed: true, name: 'id', type: 'uint64' },
      { indexed: true, name: 'provider', type: 'address' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ServicePaid',
    inputs: [
      { indexed: true, name: 'id', type: 'uint64' },
      { indexed: true, name: 'provider', type: 'address' },
      { indexed: true, name: 'buyer', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint128' },
      { indexed: false, name: 'memo', type: 'string' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ServiceRated',
    inputs: [
      { indexed: true, name: 'id', type: 'uint64' },
      { indexed: true, name: 'rater', type: 'address' },
      { indexed: false, name: 'stars', type: 'uint8' },
      { indexed: false, name: 'ratingsCount', type: 'uint64' },
      { indexed: false, name: 'ratingsSum', type: 'uint128' },
    ],
    anonymous: false,
  },

  // ── errors ─────────────────────────────────────────────────────────────────
  { type: 'error', name: 'NotProvider', inputs: [] },
  { type: 'error', name: 'ServiceNotFound', inputs: [] },
  { type: 'error', name: 'ServiceInactive', inputs: [] },
  { type: 'error', name: 'EmptyTitle', inputs: [] },
  { type: 'error', name: 'TitleTooLong', inputs: [] },
  { type: 'error', name: 'DescriptionTooLong', inputs: [] },
  { type: 'error', name: 'MemoTooLong', inputs: [] },
  { type: 'error', name: 'BadRating', inputs: [] },
  { type: 'error', name: 'PoolShareTooHigh', inputs: [] },
] as const;

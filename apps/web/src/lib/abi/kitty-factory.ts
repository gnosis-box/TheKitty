// Hand-written viem-compatible ABI for KittyFactory.sol.
// Source of truth: contracts/src/KittyFactory.sol. Keep in sync.

export const kittyFactoryAbi = [
  {
    type: 'function',
    name: 'createKitty',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'g',
        type: 'tuple',
        components: [
          { name: 'service', type: 'address' },
          { name: 'feeCollection', type: 'address' },
          { name: 'initialConditions', type: 'address[]' },
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'metadataDigest', type: 'bytes32' },
        ],
      },
      {
        name: 'k',
        type: 'tuple',
        components: [
          { name: 'members', type: 'address[]' },
          { name: 'quorumPercent', type: 'uint8' },
          { name: 'smallTxThreshold', type: 'uint128' },
          { name: 'votingPeriod', type: 'uint32' },
          { name: 'trustExpiry', type: 'uint96' },
        ],
      },
    ],
    outputs: [
      { name: 'baseGroup', type: 'address' },
      { name: 'governance', type: 'address' },
    ],
  },
  {
    type: 'function',
    name: 'baseGroupFactory',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'hub',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'event',
    name: 'KittyCreated',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: true, name: 'baseGroup', type: 'address' },
      { indexed: true, name: 'governance', type: 'address' },
      { indexed: false, name: 'members', type: 'address[]' },
      { indexed: false, name: 'quorumPercent', type: 'uint8' },
      { indexed: false, name: 'smallTxThreshold', type: 'uint128' },
      { indexed: false, name: 'votingPeriod', type: 'uint32' },
    ],
  },
] as const;

// Minimal subset of the Circles V2 NameRegistry ABI.
// Source: @aboutcircles/sdk-abis@0.1.31.

export const nameRegistryAbi = [
  {
    type: 'function',
    name: 'getMetadataDigest',
    stateMutability: 'view',
    inputs: [{ name: '_avatar', type: 'address' }],
    outputs: [{ type: 'bytes32' }],
  },
] as const;

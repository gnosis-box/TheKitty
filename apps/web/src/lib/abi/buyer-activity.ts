/// ABI of `BuyerActivity` (Republish 5). Public attestation log of which
/// Circles humans have paid ≥1 service via the Kitty. Read for the
/// pool-eligibility badge; written via `markPaid()` in the PaySheet
/// bundle right after the provider transfer (so the OpenMintPolicy's
/// `hasPaid` gate is satisfied before `groupMint` runs in step 5).

export const buyerActivityAbi = [
  {
    type: 'function',
    name: 'markPaid',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'hasPaid',
    stateMutability: 'view',
    inputs: [{ name: 'buyer', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'firstPaidAt',
    stateMutability: 'view',
    inputs: [{ name: 'buyer', type: 'address' }],
    outputs: [{ type: 'uint64' }],
  },
  {
    type: 'event',
    name: 'MarkedPaid',
    inputs: [
      { indexed: true, name: 'buyer', type: 'address' },
      { indexed: false, name: 'at', type: 'uint64' },
    ],
    anonymous: false,
  },
] as const;

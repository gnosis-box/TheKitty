// Minimal subset of the Circles V2 Hub ABI used by the mini-app.
// Source: @aboutcircles/sdk-abis@0.1.31 — see node_modules for the full ABI.
// We narrow to what we actually call from the front-end (Phase 2 needs only
// toTokenId + safeTransferFrom + balanceOf; groupMint lands in Phase 3).

export const hubV2Abi = [
  {
    type: 'function',
    name: 'toTokenId',
    stateMutability: 'pure',
    inputs: [{ name: 'avatar', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'safeTransferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'id', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'groupMint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_group', type: 'address' },
      { name: '_collateralAvatars', type: 'address[]' },
      { name: '_amounts', type: 'uint256[]' },
      { name: '_data', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'trust',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_trustReceiver', type: 'address' },
      { name: '_expiry', type: 'uint96' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isTrusted',
    stateMutability: 'view',
    inputs: [
      { name: '_truster', type: 'address' },
      { name: '_trustee', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
  /// Emitted on every `trust` call. Used by the discovery reader to list
  /// the viewer's outgoing trusts (truster = viewer). The `expiryTime`
  /// lets the reader filter expired or revoked trusts (revocation = a
  /// trust call with `expiry < now`).
  {
    type: 'event',
    name: 'Trust',
    inputs: [
      { indexed: true, name: 'truster', type: 'address' },
      { indexed: true, name: 'trustee', type: 'address' },
      { indexed: false, name: 'expiryTime', type: 'uint256' },
    ],
    anonymous: false,
  },
] as const;

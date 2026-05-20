import { createPublicClient, http, type PublicClient } from 'viem';
import { gnosis } from 'viem/chains';

import { CIRCLES_CONFIG } from './circles-config';

let cached: PublicClient | null = null;

/// Read-only viem client pointing at Gnosis Chain. Used to wait for tx
/// receipts and decode events emitted by the factory. The host wallet
/// handles all writes via `sendTransactions`; we never sign or broadcast
/// from the client.
export function getPublicClient(): PublicClient {
  if (cached) return cached;
  cached = createPublicClient({
    chain: gnosis,
    transport: http(CIRCLES_CONFIG.rpcUrl),
  });
  return cached;
}

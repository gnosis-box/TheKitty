import type { Hex } from 'viem';

import { CIRCLES_CONFIG } from './circles-config';
import { nameRegistryAbi } from './abi/name-registry';
import { getPublicClient } from './public-client';
import type { Address } from '@/types/kitty';

const ZERO_DIGEST = '0x0000000000000000000000000000000000000000000000000000000000000000';

export interface RawProfile {
  name?: string;
  description?: string;
  previewImageUrl?: string;
  imageUrl?: string;
}

/// Resolve a Circles profile for an avatar address in two on-chain hops:
///   1. NameRegistry.getMetadataDigest(addr) → bytes32 CIDv0 digest
///   2. profileService GET get?cid=Qm... → JSON profile
///
/// Returns null when the avatar has no profile (digest == 0 or fetch
/// 404s). Errors are caught and surfaced as null so the UI falls back
/// gracefully to the deterministic-color bubble.
export async function fetchCirclesProfile(address: Address): Promise<RawProfile | null> {
  try {
    const digest = (await getPublicClient().readContract({
      abi: nameRegistryAbi,
      address: CIRCLES_CONFIG.nameRegistryAddress,
      functionName: 'getMetadataDigest',
      args: [address],
    })) as Hex;

    if (!digest || digest === ZERO_DIGEST) return null;

    const cid = bytes32ToCidV0(digest);
    const base = CIRCLES_CONFIG.profileServiceUrl.endsWith('/')
      ? CIRCLES_CONFIG.profileServiceUrl
      : `${CIRCLES_CONFIG.profileServiceUrl}/`;

    const res = await fetch(`${base}get?cid=${cid}`);
    if (!res.ok) return null;
    const json = (await res.json()) as RawProfile;
    return json;
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[profile-fetcher] failed for', address, err);
    }
    return null;
  }
}

// CIDv0 = base58btc(multihash(sha256, 32, digest))
// multihash header: 0x12 (sha256) + 0x20 (length 32) → 34 bytes total → "Qm..." string.
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function bytes32ToCidV0(hexDigest: Hex): string {
  const hex = hexDigest.startsWith('0x') ? hexDigest.slice(2) : hexDigest;
  if (hex.length !== 64) {
    throw new Error(`Expected 32-byte hex digest, got ${hex.length / 2} bytes`);
  }
  const bytes = new Uint8Array(34);
  bytes[0] = 0x12;
  bytes[1] = 0x20;
  for (let i = 0; i < 32; i++) {
    bytes[2 + i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  // Base58 encode the multihash bytes.
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = '';
  while (n > 0n) {
    out = BASE58_ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  // Leading 0x00 bytes become leading '1's.
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    out = '1' + out;
  }
  return out;
}

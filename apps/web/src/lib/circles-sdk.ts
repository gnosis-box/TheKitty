import { Sdk } from '@aboutcircles/sdk';
import { circlesConfig } from '@aboutcircles/sdk-utils';

let sdk: Sdk | null = null;

/// Lazy-instantiated read-only Circles SDK. No contractRunner means we can
/// only read on-chain data and profiles — writes still go through the
/// miniapp host. Singleton so the underlying RPC clients are reused.
export function getCirclesSdk(): Sdk {
  if (!sdk) {
    sdk = new Sdk(circlesConfig[100]);
  }
  return sdk;
}

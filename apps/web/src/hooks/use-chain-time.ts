import { useEffect, useState } from 'react';

import { getPublicClient } from '@/lib/public-client';

/// Returns the *current* time in seconds, calibrated against the Gnosis Chain
/// `block.timestamp`. Multiple devices viewing the same kitty will read the
/// same value within ~1s regardless of their local clock drift.
///
/// Implementation: at mount we fetch the latest block once, compute an
/// offset = chainTime - localTime, and apply it to Date.now() on every tick.
/// We resync every 30s so drift can't accumulate. While the first fetch is
/// in flight we return the raw local time so the UI doesn't show 0 / NaN.
///
/// The hook ticks at `tickMs` (default 1000ms) so consumers re-render
/// automatically — useful for countdowns.
export function useChainTime(tickMs = 1000): number {
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(0);

  // Re-sync the offset with the chain periodically. The first call happens
  // immediately so the initial paint is roughly correct.
  useEffect(() => {
    let cancelled = false;
    async function sync() {
      try {
        const block = await getPublicClient().getBlock({ blockTag: 'latest' });
        const localNow = Math.floor(Date.now() / 1000);
        const chainNow = Number(block.timestamp);
        if (!cancelled) setOffset(chainNow - localNow);
      } catch {
        // RPC blip — keep the previous offset.
      }
    }
    void sync();
    const id = setInterval(sync, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Tick locally so the UI updates between syncs. Each tick is "free" — we
  // re-compute `Math.floor(Date.now() / 1000) + offset` on read.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  // `tick` is in the dep array implicitly via state churn; reading it here
  // ensures consumers re-render when it changes.
  void tick;

  return Math.floor(Date.now() / 1000) + offset;
}

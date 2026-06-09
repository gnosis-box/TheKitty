import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Crown, Ticket } from 'lucide-react';

import { useWallet } from '@/hooks/use-wallet';
import {
  readPoolState,
  readProviderInThisWeek,
  readViewerInThisWeek,
  type PoolState,
} from '@/lib/reward-pool-reader';
import { formatCrc } from '@/lib/utils';
import type { Address } from '@/types/kitty';

/// Top-of-page banner on `/services` that surfaces the weekly pool
/// without requiring users to discover the `/pool` route from the
/// burger menu. Three states by viewer state:
///
///   - disconnected   → hide (no eligibility to surface)
///   - eligible       → emerald "🎟 you're in" + tap to open pool
///   - not eligible   → amber "X TKP up for grabs" + CTA to enter
///
/// Reads each datum independently (poolState + buyerInWeek +
/// providerInWeek) so a slow read can't trap the page in a loading
/// state — the banner just shows the data it has so far.
export function PoolEligibilityBanner() {
  const { address, isConnected } = useWallet();
  const viewer = address as Address | null;
  const [pool, setPool] = useState<PoolState | null>(null);
  const [inBuyer, setInBuyer] = useState<boolean>(false);
  const [inProvider, setInProvider] = useState<boolean>(false);

  useEffect(() => {
    void readPoolState().then(
      (s) => setPool(s),
      () => setPool(null),
    );
  }, []);

  useEffect(() => {
    if (!viewer) {
      setInBuyer(false);
      setInProvider(false);
      return;
    }
    void readViewerInThisWeek(viewer).then(
      (ok) => setInBuyer(ok),
      () => setInBuyer(false),
    );
    void readProviderInThisWeek(viewer).then(
      (ok) => setInProvider(ok),
      () => setInProvider(false),
    );
  }, [viewer]);

  // Hide when disconnected or when there's literally nothing to show
  // (no pool address configured).
  if (!isConnected || !viewer) return null;
  if (!pool) return null;

  const isEligible = inBuyer || inProvider;

  if (isEligible) {
    return (
      <Link
        to="/pool"
        className="group flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-3 transition hover:bg-emerald-500/10"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Ticket className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-emerald-900">
            🎟 You're in this week's draw
          </p>
          <p className="truncate text-[11px] text-[var(--color-muted)]">
            {inBuyer && inProvider
              ? `Both draws · ${formatCrc(pool.balance)} TKP in the pool`
              : inBuyer
                ? `Buyer draw (80%) · ${formatCrc(pool.balance)} TKP up for grabs`
                : `Provider draw (20%) · ${formatCrc(pool.balance)} TKP up for grabs`}
          </p>
        </div>
        <ArrowRight className="size-4 text-emerald-600 transition group-hover:translate-x-0.5" />
      </Link>
    );
  }

  // Not eligible — surface the pool size and a CTA only if there's
  // anything to win. When the pool is empty we keep the banner small
  // and inviting ("be the first").
  const isEmpty = pool.balance === 0n;
  return (
    <Link
      to="/pool"
      className="group flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 transition hover:bg-amber-500/10"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-700">
        <Crown className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-amber-900">
          {isEmpty
            ? 'Be the first in this week’s draw'
            : `${formatCrc(pool.balance)} TKP up for grabs Sunday`}
        </p>
        <p className="truncate text-[11px] text-[var(--color-muted)]">
          Pay any service with a community share to enter.
        </p>
      </div>
      <ArrowRight className="size-4 text-amber-700 transition group-hover:translate-x-0.5" />
    </Link>
  );
}

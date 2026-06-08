import { useEffect, useState } from 'react';

import { countUnratedPaidServices } from '@/lib/services-reader';
import { useWallet } from '@/hooks/use-wallet';

/// Pending-actions count for the burger drawer's red dot. V1 only tracks
/// "services you paid but never rated" because that's the cheapest signal
/// to read (two event queries, indexed by viewer). Future iterations
/// compose more signals from a single hook (proposals to vote on, tontine
/// rounds opening soon, fresh trusts to acknowledge), so the badge can
/// stay a single number.
export function useActionableCount(): number {
  const { address } = useWallet();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!address) {
      setCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const n = await countUnratedPaidServices(address);
        if (!cancelled) setCount(n);
      } catch {
        if (!cancelled) setCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  return count;
}

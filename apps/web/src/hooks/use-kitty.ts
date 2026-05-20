import { useCallback, useEffect, useState } from 'react';

import { readKittyState, type KittyState } from '@/lib/kitty-reader';
import type { Address } from '@/types/kitty';

export interface UseKittyResult {
  state: KittyState | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/// Fetches the kitty's on-chain state and re-runs whenever the governance
/// address changes or the consumer calls `refresh()`. No polling — keep the
/// RPC light. Each user action calls `refresh()` after tx confirmation.
export function useKitty(governance: Address | undefined): UseKittyResult {
  const [state, setState] = useState<KittyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!governance) {
      setState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await readKittyState(governance);
      setState(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [governance]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { state, loading, error, refresh };
}

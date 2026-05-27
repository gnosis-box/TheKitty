import { useCallback, useEffect, useState } from 'react';

import { readKittyHistory, type HistoryEntry } from '@/lib/kitty-history';
import type { Address } from '@/types/kitty';

export function useHistory(governance: Address | undefined) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!governance) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const next = await readKittyHistory(governance);
      setEntries(next);
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

  return { entries, loading, error, refresh };
}

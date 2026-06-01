import { useEffect, useState, type ReactNode } from 'react';
import { Activity, Coins, RotateCw } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { readGlobalStats, type GlobalStats } from '@/lib/global-stats';
import { formatCrc } from '@/lib/utils';

/// Lightweight cross-kitty activity card. Aggregates KittyCreated +
/// RoundClaimed events for the deployed factory and surfaces three numbers:
/// kitties created, rounds paid out, CRC moved. Hidden entirely when the
/// stats are empty (don't shout "0 / 0 / 0" at a fresh visitor).
export function PublicStats() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await readGlobalStats();
        if (!cancelled) setStats(s);
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.kittiesCreated === 0) return null;

  return (
    <Card>
      <CardContent>
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          On Circles, all-time
        </p>
        <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
          <Stat
            icon={<Activity className="size-3.5" />}
            label="Kitties"
            value={stats.kittiesCreated.toString()}
          />
          <Stat
            icon={<RotateCw className="size-3.5" />}
            label="Rounds paid"
            value={stats.roundsPaid.toString()}
          />
          <Stat
            icon={<Coins className="size-3.5" />}
            label="CRC moved"
            value={formatCrc(stats.totalPaidOut)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface StatProps {
  icon: ReactNode;
  label: string;
  value: string;
}

function Stat({ icon, label, value }: StatProps) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-[var(--color-surface-hi)] px-3 py-2">
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {icon}
        {label}
      </span>
      <span className="font-mono text-base">{value}</span>
    </div>
  );
}

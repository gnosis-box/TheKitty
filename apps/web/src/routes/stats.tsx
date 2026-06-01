import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Coins,
  ExternalLink,
  RotateCw as RotateIcon,
  Trophy,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CIRCLES_CONFIG } from '@/lib/circles-config';
import { readGlobalStats, type GlobalStats } from '@/lib/global-stats';
import { formatCrc, shortAddress } from '@/lib/utils';

export default function StatsRoute() {
  const navigate = useNavigate();
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

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          aria-label="Back"
          className="px-2"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
            The Kitty
          </p>
          <h1 className="text-2xl font-semibold leading-tight">Activity</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            What the Kitty network has done so far on Gnosis Chain.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4" /> All-time
          </CardTitle>
          <CardDescription>
            Aggregated from the deployed KittyFactory + every governance contract it spawned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : !stats || stats.kittiesCreated === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              Nothing yet. Be the first to start a tontine on this factory.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Stat
                icon={<Activity className="size-3.5" />}
                label="Kitties"
                value={stats.kittiesCreated.toString()}
              />
              <Stat
                icon={<RotateIcon className="size-3.5" />}
                label="Rounds paid"
                value={stats.roundsPaid.toString()}
              />
              <Stat
                icon={<Coins className="size-3.5" />}
                label="CRC moved"
                value={formatCrc(stats.totalPaidOut)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-4" /> Why this matters
          </CardTitle>
          <CardDescription>
            Numbers driven by the protocol, not by us.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-[var(--color-text)]">
            <li>
              <strong>Kitties</strong> — every row above is a real BaseGroup avatar on Circles
              V2 with a custom KittyGovernance custodian. Anyone can audit them on-chain.
            </li>
            <li>
              <strong>Rounds paid</strong> — each time a member's turn came up and they called
              <code className="rounded bg-[var(--color-surface-hi)] px-1 py-0.5">claimRound</code>
              , the contract paid them out and rotated to the next member. No organizer involved.
            </li>
            <li>
              <strong>CRC moved</strong> — total CRC that left the kitty pools into members'
              wallets through the rotation. Demurrage-friendly: this is exactly the kind of
              circulation Circles is designed for.
            </li>
          </ul>
        </CardContent>
      </Card>

      {CIRCLES_CONFIG.kittyFactoryAddress && (
        <Card>
          <CardContent>
            <p className="text-xs text-[var(--color-muted)]">
              KittyFactory:
              <a
                href={`https://gnosisscan.io/address/${CIRCLES_CONFIG.kittyFactoryAddress}`}
                target="_blank"
                rel="noreferrer"
                className="ml-1 inline-flex items-center gap-1 font-mono hover:text-[var(--color-text)]"
              >
                {shortAddress(CIRCLES_CONFIG.kittyFactoryAddress)}
                <ExternalLink className="size-3" />
              </a>
            </p>
          </CardContent>
        </Card>
      )}
    </main>
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

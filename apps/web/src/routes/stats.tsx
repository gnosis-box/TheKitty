import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Coins,
  Crown,
  ExternalLink,
  HandCoins,
  RotateCw as RotateIcon,
  Store,
  Trophy,
  Users,
} from 'lucide-react';

import { BurgerButton } from '@/components/BurgerButton';
import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CIRCLES_CONFIG } from '@/lib/circles-config';
import {
  readGlobalStats,
  readServiceStats,
  type GlobalStats,
  type ServiceStats,
} from '@/lib/global-stats';
import {
  readTopProvidersByActivity,
  type ProviderActivity,
} from '@/lib/services-reader';
import { formatCrc, shortAddress } from '@/lib/utils';

export default function StatsRoute() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [services, setServices] = useState<ServiceStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<ProviderActivity[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, sv, lb] = await Promise.all([
          readGlobalStats(),
          readServiceStats(),
          readTopProvidersByActivity(10),
        ]);
        if (!cancelled) {
          setStats(s);
          setServices(sv);
          setLeaderboard(lb);
        }
      } catch {
        if (!cancelled) {
          setStats(null);
          setServices(null);
          setLeaderboard(null);
        }
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
      <header className="flex items-center gap-3">
        <BurgerButton />
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
            <Store className="size-4" /> Services board
          </CardTitle>
          <CardDescription>
            What people in the circle have published and bought from each other.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : !services || services.servicesPublished === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              Nothing on the board yet. Publish what you offer to get the first stat.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat
                icon={<Store className="size-3.5" />}
                label="Active"
                value={services.activeServices.toString()}
                hint={`${services.servicesPublished} ever published`}
              />
              <Stat
                icon={<Users className="size-3.5" />}
                label="Providers"
                value={services.activeProviders.toString()}
                hint="With an active listing"
              />
              <Stat
                icon={<HandCoins className="size-3.5" />}
                label="Payments"
                value={services.paymentsLogged.toString()}
                hint="Logged on-chain"
              />
              <Stat
                icon={<Coins className="size-3.5" />}
                label="CRC paid"
                value={formatCrc(services.totalCrcPaid)}
                hint="Total moved through services"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4" /> Funding side
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
              No kitties yet — start a tontine or open a group pot.
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
            <Crown className="size-4" /> Top providers
          </CardTitle>
          <CardDescription>
            Ranked by CRC received through the ServiceRegistry. The leaderboard
            is the network's reputation in motion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : !leaderboard || leaderboard.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              No payments yet — the first provider paid lands here.
            </p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {leaderboard.map((entry, idx) => (
                <li key={entry.provider}>
                  <Link
                    to={`/providers/${entry.provider.toLowerCase()}`}
                    className="flex items-center gap-3 rounded-lg bg-[var(--color-surface-hi)] px-3 py-2 hover:bg-[var(--color-border)]"
                  >
                    <span className="w-5 shrink-0 text-center font-mono text-[11px] text-[var(--color-muted)]">
                      {idx + 1}
                    </span>
                    <MemberAvatar address={entry.provider} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[11px]">
                        {shortAddress(entry.provider)}
                      </p>
                      <p className="text-[10px] text-[var(--color-muted)]">
                        {entry.paymentCount} payment
                        {entry.paymentCount === 1 ? '' : 's'} · {entry.uniqueBuyers}{' '}
                        buyer{entry.uniqueBuyers === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm">
                      {formatCrc(entry.totalCrcReceived)}
                      <span className="ml-1 text-[10px] text-[var(--color-muted)]">CRC</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
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
              <strong>Active services</strong> — every row is a real on-chain listing in the
              singleton ServiceRegistry. Anyone can browse and pay through{' '}
              <code className="rounded bg-[var(--color-surface-hi)] px-1 py-0.5">
                Hub.safeTransferFrom
              </code>{' '}
              without a platform sitting in the middle.
            </li>
            <li>
              <strong>Providers</strong> — distinct Circles humans who currently have at least
              one active listing. The trust-graph is the discoverability layer; the registry
              is just the catalog.
            </li>
            <li>
              <strong>Payments + CRC paid</strong> — every pay flow bundles a{' '}
              <code className="rounded bg-[var(--color-surface-hi)] px-1 py-0.5">logPayment</code>
              {' '}call after the transfer, so the aggregates above mirror what actually moved
              between humans. Demurrage-friendly: this is exactly the kind of circulation
              Circles is designed for.
            </li>
            <li>
              <strong>Kitties + rounds + CRC moved</strong> — every kitty is a real BaseGroup
              avatar on Circles V2 with a custom KittyGovernance custodian. Rounds paid are
              cases where a member called{' '}
              <code className="rounded bg-[var(--color-surface-hi)] px-1 py-0.5">claimRound</code>
              {' '}and the contract rotated to the next member by index — no organizer ever
              involved.
            </li>
          </ul>
        </CardContent>
      </Card>

      {(CIRCLES_CONFIG.kittyFactoryAddress || CIRCLES_CONFIG.serviceRegistryAddress) && (
        <Card>
          <CardContent>
            <div className="flex flex-col gap-1 text-xs text-[var(--color-muted)]">
              {CIRCLES_CONFIG.kittyFactoryAddress && (
                <p>
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
              )}
              {CIRCLES_CONFIG.serviceRegistryAddress && (
                <p>
                  ServiceRegistry:
                  <a
                    href={`https://gnosisscan.io/address/${CIRCLES_CONFIG.serviceRegistryAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 inline-flex items-center gap-1 font-mono hover:text-[var(--color-text)]"
                  >
                    {shortAddress(CIRCLES_CONFIG.serviceRegistryAddress)}
                    <ExternalLink className="size-3" />
                  </a>
                </p>
              )}
            </div>
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
  hint?: string;
}

function Stat({ icon, label, value, hint }: StatProps) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-[var(--color-surface-hi)] px-3 py-2">
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {icon}
        {label}
      </span>
      <span className="font-mono text-base">{value}</span>
      {hint && (
        <span className="text-[10px] leading-tight text-[var(--color-muted)]">{hint}</span>
      )}
    </div>
  );
}

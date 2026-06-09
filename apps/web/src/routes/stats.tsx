import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Activity,
  Coins,
  Crown,
  ExternalLink,
  Gift,
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
import { useWallet } from '@/hooks/use-wallet';
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
import {
  readPoolState,
  readViewerWins,
  type PoolState,
  type ViewerWin,
} from '@/lib/reward-pool-reader';
import { buildClaimPrizeTx } from '@/lib/tx-builders';
import { formatCrc, shortAddress } from '@/lib/utils';
import type { Address } from '@/types/kitty';

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

      <PrizePoolCard />

      <ClaimableWinningsCard />

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
              <p>
                Community pool Safe:
                <a
                  href={`https://gnosisscan.io/address/${CIRCLES_CONFIG.communityPoolAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1 inline-flex items-center gap-1 font-mono hover:text-[var(--color-text)]"
                >
                  {shortAddress(CIRCLES_CONFIG.communityPoolAddress)}
                  <ExternalLink className="size-3" />
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

/// `/stats` headline — the weekly prize pool. Now wired to the on-chain
/// `RewardPool` (Republish 5): live pool balance, this week's entries,
/// previous week's winner with an inline claim status, and a link to the
/// pool's address on gnosisscan. The countdown to Sunday 18:00 UTC keeps
/// the visual "you can still get in" rhythm for buyers.
function PrizePoolCard() {
  const [now, setNow] = useState(() => Date.now());
  const [pool, setPool] = useState<PoolState | null>(null);
  const [poolLoading, setPoolLoading] = useState(true);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await readPoolState();
        if (!cancelled) setPool(s);
      } catch {
        if (!cancelled) setPool(null);
      } finally {
        if (!cancelled) setPoolLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const nextDrawMs = useMemo(() => nextSundayEveningUtc(now), [now]);
  const remainingMs = Math.max(0, nextDrawMs - now);
  const poolAddress = pool?.poolAddress ?? CIRCLES_CONFIG.rewardPoolAddress;
  const balanceLabel = pool ? `${formatCrc(pool.balance)} TKP` : '—';
  const entriesLabel = pool ? pool.currentWeekEntries.toString() : '—';

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="size-4 text-amber-500" /> This week's prize pool
        </CardTitle>
        <CardDescription>
          Funded by every service's opt-in community share. One eligible buyer
          wins the pot every Sunday at 18:00 UTC. Draws are settled
          trustlessly on-chain by{' '}
          <code className="font-mono text-[10px]">RewardPool</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat
            icon={<Coins className="size-3.5" />}
            label="Pool balance"
            value={poolLoading ? '…' : balanceLabel}
            hint="Live on-chain"
          />
          <Stat
            icon={<Users className="size-3.5" />}
            label="In this week"
            value={poolLoading ? '…' : entriesLabel}
            hint="Eligible buyers"
          />
          <Stat
            icon={<RotateIcon className="size-3.5" />}
            label="Next draw in"
            value={formatRemaining(remainingMs)}
            hint="Sun · 18:00 UTC"
          />
          <Stat
            icon={<Trophy className="size-3.5" />}
            label="Last week"
            value={
              pool?.previousWeekWinner
                ? shortAddress(pool.previousWeekWinner)
                : pool && pool.previousWeekEntries > 0n
                  ? 'Pending draw'
                  : '—'
            }
            hint={
              pool?.previousWeekWinner
                ? pool.previousWeekClaimed
                  ? `${formatCrc(pool.previousWeekPrize)} · claimed`
                  : `${formatCrc(pool.previousWeekPrize)} TKP · unclaimed`
                : 'Winner shows here Sunday'
            }
          />
        </div>
        {poolAddress && (
          <a
            href={`https://gnosisscan.io/address/${poolAddress}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-900 hover:underline"
          >
            <ExternalLink className="size-3" /> View RewardPool contract on
            gnosisscan
          </a>
        )}
        <p className="mt-2 text-[11px] text-[var(--color-muted)]">
          Eligible = any human who paid at least one service via the Kitty
          this week. The pool token is{' '}
          <code className="font-mono">TKP</code> (TheKittyPool group
          avatar). Winners redeem TKP into the underlying CRC via the
          group's policy at any time.
        </p>
      </CardContent>
    </Card>
  );
}

/// Self-hiding card that renders only when the connected viewer has at
/// least one unclaimed prize from a past draw. Each row carries a
/// "Claim" CTA that bundles a single `RewardPool.claim(weekIndex)` tx.
/// The viewer's wallet already trusts the pool group (set up the first
/// time they paid a pool-share service via the PaySheet pool route), so
/// the claim transfer goes through without an extra trust step.
function ClaimableWinningsCard() {
  const { address, isConnected, sendTransactions } = useWallet();
  const viewer = address as Address | null;
  const [wins, setWins] = useState<ViewerWin[] | null>(null);
  const [claimingWeek, setClaimingWeek] = useState<bigint | null>(null);

  useEffect(() => {
    if (!viewer) {
      setWins([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await readViewerWins(viewer);
        if (!cancelled) setWins(list);
      } catch {
        if (!cancelled) setWins([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewer]);

  if (!isConnected || !wins) return null;
  const unclaimed = wins.filter((w) => !w.claimed);
  const totalUnclaimed = unclaimed.reduce((acc, w) => acc + w.prize, 0n);
  if (unclaimed.length === 0) return null;

  async function claim(weekIndex: bigint) {
    setClaimingWeek(weekIndex);
    try {
      toast.loading('Claiming prize…', { id: 'claim-prize' });
      const tx = buildClaimPrizeTx({ weekIndex });
      const [hash] = await sendTransactions([tx]);
      if (!hash) throw new Error('Host returned no tx hash');
      toast.success('Prize claimed', { id: 'claim-prize' });
      if (viewer) {
        const fresh = await readViewerWins(viewer);
        setWins(fresh);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Claim failed', {
        id: 'claim-prize',
      });
    } finally {
      setClaimingWeek(null);
    }
  }

  return (
    <Card className="border-emerald-500/40 bg-emerald-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="size-4 text-emerald-600" /> You have unclaimed
          winnings
        </CardTitle>
        <CardDescription>
          {unclaimed.length === 1
            ? `You won a past draw and haven't claimed yet — ${formatCrc(totalUnclaimed)} TKP waiting.`
            : `You won ${unclaimed.length} past draws — ${formatCrc(totalUnclaimed)} TKP total, all unclaimed.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {unclaimed.map((w) => (
            <li
              key={w.weekIndex.toString()}
              className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-[var(--color-surface)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  Week #{w.weekIndex.toString()}
                </p>
                <p className="font-mono text-[11px] text-[var(--color-muted)]">
                  {formatCrc(w.prize)} TKP
                </p>
              </div>
              <button
                type="button"
                onClick={() => void claim(w.weekIndex)}
                disabled={claimingWeek !== null}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white shadow hover:bg-emerald-700 disabled:opacity-50"
              >
                <Gift className="size-3.5" />
                {claimingWeek === w.weekIndex ? 'Claiming…' : 'Claim'}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-[var(--color-muted)]">
          You receive TKP (the pool's group token). Hold it for future
          redraws, or burn it later via the pool's redemption policy to
          get a basket of the contributing buyers' CRC back.
        </p>
      </CardContent>
    </Card>
  );
}

/// Returns the unix-ms timestamp of the next Sunday at 18:00 UTC after
/// `nowMs`. Used for the draw countdown.
function nextSundayEveningUtc(nowMs: number): number {
  const d = new Date(nowMs);
  const dayUtc = d.getUTCDay(); // 0 = Sunday
  const hUtc = d.getUTCHours();
  // Days to advance to reach the next Sunday 18h UTC.
  let daysToAdd = (7 - dayUtc) % 7;
  if (daysToAdd === 0 && hUtc >= 18) daysToAdd = 7;
  const target = new Date(d);
  target.setUTCDate(d.getUTCDate() + daysToAdd);
  target.setUTCHours(18, 0, 0, 0);
  return target.getTime();
}

function formatRemaining(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
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

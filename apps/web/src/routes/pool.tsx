import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowRight,
  Crown,
  ExternalLink,
  Gift,
  RotateCw as RotateIcon,
  Sparkles,
  Ticket,
  Trophy,
  Users,
} from 'lucide-react';

import { BurgerButton } from '@/components/BurgerButton';
import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWallet } from '@/hooks/use-wallet';
import { CIRCLES_CONFIG } from '@/lib/circles-config';
import {
  readPoolState,
  readPastDraws,
  readProviderInThisWeek,
  readViewerInThisWeek,
  readViewerProviderWins,
  readViewerWins,
  readWeekEntries,
  readWeekProviderEntries,
  type PastDraw,
  type PoolState,
  type ViewerWin,
} from '@/lib/reward-pool-reader';
import { buildClaimPrizeTx, buildClaimProviderPrizeTx } from '@/lib/tx-builders';
import { formatCrc, shortAddress } from '@/lib/utils';
import type { Address } from '@/types/kitty';

/// Standalone surface for the weekly prize pool. Pulled out of `/stats`
/// in Republish 5 once the on-chain `RewardPool` shipped, so the
/// engagement mechanic has its own destination in the burger menu
/// instead of being buried as one of three cards in the stats page.
///
/// Top-down: prize headline, the viewer's own status (eligible / not),
/// "who's in this week" avatar stack, claim-now block (self-hiding),
/// past draws rail, how-it-works footer.
export default function PoolRoute() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex items-center gap-3">
        <BurgerButton />
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
            The Kitty
          </p>
          <h1 className="text-2xl font-semibold leading-tight">Weekly pool</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            A random buyer wins it every Sunday at 18:00 UTC.
          </p>
        </div>
      </header>

      <PrizeHeadline />
      <ViewerStatusCard />
      <EntriesThisWeekCard />
      <ClaimableWinningsCard />
      <ClaimableProviderWinningsCard />
      <PastDrawsCard />
      <HowItWorksCard />
    </main>
  );
}

/// Same data layout as the old `PrizePoolCard` on `/stats`, just rebranded
/// without the "Last week" stat (which lives in its own past-draws rail
/// below instead).
function PrizeHeadline() {
  const [now, setNow] = useState(() => Date.now());
  const [pool, setPool] = useState<PoolState | null>(null);
  const [loading, setLoading] = useState(true);

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
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const nextDrawMs = useMemo(() => nextSundayEveningUtc(now), [now]);
  const remainingMs = Math.max(0, nextDrawMs - now);
  const poolAddress = pool?.poolAddress ?? CIRCLES_CONFIG.rewardPoolAddress;

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="size-5 text-amber-500" /> This week's pool
        </CardTitle>
        <CardDescription>
          Funded by every service's opt-in community share. Settled
          trustlessly on-chain by{' '}
          <code className="font-mono text-[10px]">RewardPool</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-2xl bg-[var(--color-surface)]/60 p-4 text-center">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Prize so far
          </p>
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">
            {loading ? '—' : formatCrc(pool?.balance ?? 0n)}
            <span className="ml-1 text-base font-normal text-[var(--color-muted)]">
              TKP
            </span>
          </p>
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
            <RotateIcon className="size-3" />
            Drawn in <strong className="ml-1 font-medium text-[var(--color-text)]">{formatRemaining(remainingMs)}</strong>
            <span className="ml-1">· Sun 18h UTC</span>
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <Stat
            icon={<Users className="size-3.5" />}
            label="Buyers in week"
            value={loading ? '…' : (pool?.currentWeekEntries ?? 0n).toString()}
            hint="80% draw"
          />
          <Stat
            icon={<Users className="size-3.5" />}
            label="Providers in week"
            value={loading ? '…' : (pool?.currentWeekProviderEntries ?? 0n).toString()}
            hint="20% draw"
          />
        </div>
        <p className="mt-3 text-[11px] leading-snug text-[var(--color-muted)]">
          The pool is drawn twice every Sunday: 80% goes to a random
          buyer who paid this week, 20% goes to a random provider whose
          service was paid this week.
        </p>
        {poolAddress && (
          <a
            href={`https://gnosisscan.io/address/${poolAddress}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-900 hover:underline"
          >
            <ExternalLink className="size-3" /> View RewardPool on gnosisscan
          </a>
        )}
      </CardContent>
    </Card>
  );
}

/// "Are you in this week?" status card. Shows both the buyer-draw
/// eligibility and the provider-draw eligibility separately, since the
/// same wallet can be in one, the other, or both. Three top-level
/// states: disconnected · in some draw · in none.
function ViewerStatusCard() {
  const { address, isConnected } = useWallet();
  const viewer = address as Address | null;
  const [buyerEligible, setBuyerEligible] = useState<boolean | null>(null);
  const [providerEligible, setProviderEligible] = useState<boolean | null>(null);

  useEffect(() => {
    if (!viewer) {
      setBuyerEligible(null);
      setProviderEligible(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [b, p] = await Promise.all([
          readViewerInThisWeek(viewer),
          readProviderInThisWeek(viewer),
        ]);
        if (!cancelled) {
          setBuyerEligible(b);
          setProviderEligible(p);
        }
      } catch {
        if (!cancelled) {
          setBuyerEligible(false);
          setProviderEligible(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewer]);

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <div className="flex size-9 items-center justify-center rounded-full bg-[var(--color-surface-hi)] text-[var(--color-muted)]">
            <Ticket className="size-4" />
          </div>
          <div className="text-sm leading-snug">
            <p className="font-medium">Open in the Circles playground</p>
            <p className="text-[11px] text-[var(--color-muted)]">
              We need your Circles wallet to check your eligibility.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const inBuyer = buyerEligible === true;
  const inProvider = providerEligible === true;
  const inAny = inBuyer || inProvider;

  if (inAny) {
    return (
      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <CardContent className="flex flex-col gap-2 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Ticket className="size-4" />
            </div>
            <div className="text-sm leading-snug">
              <p className="font-medium text-emerald-900">
                🎟 You're in this week's draw
              </p>
              <p className="text-[11px] text-[var(--color-muted)]">
                {inBuyer && inProvider
                  ? 'Both the buyer (80%) and provider (20%) draws — you doubled your chances.'
                  : inBuyer
                    ? 'Buyer draw (80% of the pool). Good luck Sunday.'
                    : 'Provider draw (20% of the pool). One of your services got paid this week.'}
              </p>
            </div>
          </div>
          {!inBuyer && inProvider && (
            <Link
              to="/services"
              className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-emerald-500/40 bg-white/40 text-[11px] font-medium text-emerald-900 hover:bg-white/60"
            >
              Also enter the buyer draw — pay any service{' '}
              <ArrowRight className="size-3" />
            </Link>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="flex items-center gap-3 py-4">
        <div className="flex size-9 items-center justify-center rounded-full bg-amber-500/20 text-amber-700">
          <Sparkles className="size-4" />
        </div>
        <div className="flex-1 text-sm leading-snug">
          <p className="font-medium text-amber-900">Not in this week yet</p>
          <p className="text-[11px] text-[var(--color-muted)]">
            Pay a pool-share service (80% draw) OR get paid for one of
            yours (20% draw) to enter.
          </p>
        </div>
        <Link
          to="/services"
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-amber-500 px-2.5 text-[11px] font-medium text-white hover:bg-amber-600"
        >
          Browse
          <ArrowRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

/// Two stacks of avatars side-by-side: buyers eligible for the 80% draw
/// and providers eligible for the 20% draw. Each capped at 12 visible
/// + "+N more" pill so a popular week doesn't run off the card.
function EntriesThisWeekCard() {
  const [buyers, setBuyers] = useState<Address[] | null>(null);
  const [providers, setProviders] = useState<Address[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await readPoolState();
        if (!state) {
          if (!cancelled) {
            setBuyers([]);
            setProviders([]);
          }
          return;
        }
        const [b, p] = await Promise.all([
          readWeekEntries(state.currentWeekIndex),
          readWeekProviderEntries(state.currentWeekIndex),
        ]);
        if (!cancelled) {
          setBuyers(b);
          setProviders(p);
        }
      } catch {
        if (!cancelled) {
          setBuyers([]);
          setProviders([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (buyers === null || providers === null) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4" /> In this week
        </CardTitle>
        <CardDescription>
          Avatars on both sides of the draws. Tap any to open their
          provider profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <EntryStack
          label="Buyer draw (80%)"
          entries={buyers}
          tone="amber"
          empty="No one paid a pool-share service yet this week."
        />
        <EntryStack
          label="Provider draw (20%)"
          entries={providers}
          tone="emerald"
          empty="No provider has been paid via the pool route yet this week."
        />
      </CardContent>
    </Card>
  );
}

interface EntryStackProps {
  label: string;
  entries: Address[];
  tone: 'amber' | 'emerald';
  empty: string;
}

function EntryStack({ label, entries, tone, empty }: EntryStackProps) {
  const visible = entries.slice(0, 12);
  const extra = entries.length - visible.length;
  const dot =
    tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        <span className={`inline-block size-1.5 rounded-full ${dot}`} />
        <span>{label}</span>
        <span className="font-mono text-[var(--color-text)]">
          · {entries.length}
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="text-[11px] text-[var(--color-muted)]">{empty}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {visible.map((addr) => (
            <Link
              key={addr}
              to={`/providers/${addr.toLowerCase()}`}
              className="rounded-full ring-2 ring-transparent transition hover:ring-amber-300"
              title={shortAddress(addr)}
            >
              <MemberAvatar address={addr} size="sm" />
            </Link>
          ))}
          {extra > 0 && (
            <span className="ml-1 inline-flex h-7 items-center rounded-full bg-[var(--color-surface-hi)] px-2 text-[10px] font-medium text-[var(--color-muted)]">
              +{extra}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/// Lifted from the old `/stats` card. Self-hides until the viewer has
/// unclaimed wins, then surfaces a per-week Claim button.
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
            ? `${formatCrc(totalUnclaimed)} TKP from a past draw, waiting on you.`
            : `${formatCrc(totalUnclaimed)} TKP from ${unclaimed.length} past draws.`}
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
      </CardContent>
    </Card>
  );
}

/// Mirror of `ClaimableWinningsCard` for the provider-side draw. A
/// provider whose service was paid this week and who got drawn for the
/// 20% share sees this card with a per-week Claim button.
function ClaimableProviderWinningsCard() {
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
        const list = await readViewerProviderWins(viewer);
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
      toast.loading('Claiming provider prize…', { id: 'claim-provider' });
      const tx = buildClaimProviderPrizeTx({ weekIndex });
      const [hash] = await sendTransactions([tx]);
      if (!hash) throw new Error('Host returned no tx hash');
      toast.success('Provider prize claimed', { id: 'claim-provider' });
      if (viewer) {
        const fresh = await readViewerProviderWins(viewer);
        setWins(fresh);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Claim failed', {
        id: 'claim-provider',
      });
    } finally {
      setClaimingWeek(null);
    }
  }

  return (
    <Card className="border-sky-500/40 bg-sky-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="size-4 text-sky-600" /> Provider winnings to claim
        </CardTitle>
        <CardDescription>
          {unclaimed.length === 1
            ? `You won ${formatCrc(totalUnclaimed)} TKP in a past provider draw.`
            : `${formatCrc(totalUnclaimed)} TKP across ${unclaimed.length} past provider draws.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {unclaimed.map((w) => (
            <li
              key={w.weekIndex.toString()}
              className="flex items-center justify-between gap-3 rounded-lg border border-sky-500/30 bg-[var(--color-surface)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  Week #{w.weekIndex.toString()} · Provider draw
                </p>
                <p className="font-mono text-[11px] text-[var(--color-muted)]">
                  {formatCrc(w.prize)} TKP
                </p>
              </div>
              <button
                type="button"
                onClick={() => void claim(w.weekIndex)}
                disabled={claimingWeek !== null}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-3 text-xs font-medium text-white shadow hover:bg-sky-700 disabled:opacity-50"
              >
                <Gift className="size-3.5" />
                {claimingWeek === w.weekIndex ? 'Claiming…' : 'Claim'}
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/// Past draws rail — newest 5. Shows winner avatar + prize + claim status.
function PastDrawsCard() {
  const [draws, setDraws] = useState<PastDraw[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await readPastDraws();
        if (!cancelled) setDraws(list);
      } catch {
        if (!cancelled) setDraws([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (draws === null) return null;
  if (draws.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-4" /> Past draws
          </CardTitle>
          <CardDescription>
            No draws yet — the first winner gets crowned this Sunday.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const visible = draws.slice(0, 5);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-4" /> Past draws
        </CardTitle>
        <CardDescription>
          Winners crowned by the on-chain draw. Avatars link to their
          provider profile.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {visible.map((d) => (
            <li
              key={d.weekIndex.toString()}
              className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-hi)] px-3 py-2"
            >
              <Link to={`/providers/${d.winner.toLowerCase()}`} className="shrink-0">
                <MemberAvatar address={d.winner} size="sm" />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  Week #{d.weekIndex.toString()}
                </p>
                <p className="truncate font-mono text-[11px] text-[var(--color-muted)]">
                  {shortAddress(d.winner)} · {formatCrc(d.prize)} TKP
                </p>
              </div>
              <span
                className={
                  d.claimed
                    ? 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700'
                    : 'rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-800'
                }
              >
                {d.claimed ? 'Claimed' : 'Unclaimed'}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function HowItWorksCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4" /> How it works
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed">
        <p>
          <strong>1.</strong> A provider publishes a service with a
          community share <code className="font-mono text-[11px]">0–20%</code>.
        </p>
        <p>
          <strong>2.</strong> When you pay it, the share is auto-routed
          to <code className="font-mono text-[11px]">RewardPool</code>.
          <strong> You</strong> (the buyer) are entered in the buyer
          draw. <strong>The provider</strong> is entered in the provider
          draw.
        </p>
        <p>
          <strong>3.</strong> Sunday at 18:00 UTC the pool is split{' '}
          <strong>80% buyer / 20% provider</strong>. Two random winners
          are picked on-chain via{' '}
          <code className="font-mono text-[11px]">block.prevrandao</code>.
        </p>
        <p>
          <strong>4.</strong> Both winners claim their TKP, then can
          redeem it back to CRC any time via the pool's policy.
        </p>
        <p className="text-[11px] text-[var(--color-muted)]">
          Two-sided design so both providers AND buyers have skin in
          growing the pool. No protocol fee. No yield. Just
          redistribution between humans who pay each other.
        </p>
      </CardContent>
    </Card>
  );
}

interface StatProps {
  icon: React.ReactNode;
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
        <span className="text-[10px] leading-tight text-[var(--color-muted)]">
          {hint}
        </span>
      )}
    </div>
  );
}

function nextSundayEveningUtc(nowMs: number): number {
  const d = new Date(nowMs);
  const dayUtc = d.getUTCDay();
  const hUtc = d.getUTCHours();
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

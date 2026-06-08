import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownUp, Plus, Search, Store, Zap } from 'lucide-react';

import { AppFooter } from '@/components/AppFooter';
import { BurgerButton } from '@/components/BurgerButton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { InviteButton } from '@/components/InviteButton';
import { Input } from '@/components/ui/input';
import { InviterBanner } from '@/components/pot/InviterBanner';
import { Logo } from '@/components/Logo';
import { MainTabs } from '@/components/MainTabs';
import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { OpenInPlayground } from '@/components/OpenInPlayground';
import { PaySheet } from '@/components/services/PaySheet';
import { ServiceCard } from '@/components/services/ServiceCard';
import { Skeleton } from '@/components/ui/skeleton';
import { CIRCLES_CONFIG } from '@/lib/circles-config';
import {
  ratingAverage,
  readAllActiveServices,
  readNetworkRecentPayments,
  type RecentPayment,
  type ServiceView,
} from '@/lib/services-reader';
import { readServiceStats, type ServiceStats } from '@/lib/global-stats';
import { formatCrc } from '@/lib/utils';
import { useWallet } from '@/hooks/use-wallet';

/// Sort options exposed by the search bar. Keep the list short — every
/// option corresponds to a different mental model the buyer might have
/// (recency, affordability, social proof, quality).
type SortKey = 'newest' | 'cheapest' | 'mostPaid' | 'highestRated';

const SORT_LABEL: Record<SortKey, string> = {
  newest: 'Newest',
  cheapest: 'Cheapest',
  mostPaid: 'Most paid',
  highestRated: 'Highest rated',
};

/// Services tab — default app surface. Loads the full registry of active
/// services, surfaces them with rating + trust state, and routes to the
/// pay flow when a card's CTA is tapped (W6 will wire the actual flow).
export default function ServicesRoute() {
  const { address, isConnected, isMiniappHost } = useWallet();
  const registryReady = Boolean(CIRCLES_CONFIG.serviceRegistryAddress);

  const [services, setServices] = useState<ServiceView[] | null>(null);
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [recent, setRecent] = useState<RecentPayment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<ServiceView | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');

  const fetchServices = useCallback(async () => {
    if (!registryReady) {
      setServices([]);
      setStats(null);
      setRecent([]);
      return;
    }
    try {
      const [list, statsAgg, recentList] = await Promise.all([
        readAllActiveServices(address ?? undefined),
        readServiceStats(),
        readNetworkRecentPayments(5),
      ]);
      setServices(list);
      setStats(statsAgg);
      setRecent(recentList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
      setServices([]);
      setStats(null);
      setRecent([]);
    }
  }, [address, registryReady]);

  useEffect(() => {
    let cancelled = false;
    setServices(null);
    setError(null);
    void fetchServices().catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Failed to load services');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fetchServices]);

  /// Client-side filter + sort. Cheap at hackathon scale (tens of services);
  /// past that we'd push the work to the registry or a subgraph.
  const filtered = useMemo(() => {
    if (!services) return null;
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? services.filter(
          (s) =>
            s.title.toLowerCase().includes(needle) ||
            s.description.toLowerCase().includes(needle),
        )
      : services;
    const sorted = [...matched].sort((a, b) => {
      switch (sort) {
        case 'cheapest':
          if (a.priceCrc === b.priceCrc) return 0;
          return a.priceCrc < b.priceCrc ? -1 : 1;
        case 'mostPaid':
          if (a.timesPaid === b.timesPaid) return 0;
          return a.timesPaid > b.timesPaid ? -1 : 1;
        case 'highestRated': {
          const ra = ratingAverage(a) ?? -1;
          const rb = ratingAverage(b) ?? -1;
          return rb - ra;
        }
        case 'newest':
        default:
          return b.createdAt - a.createdAt;
      }
    });
    return sorted;
  }, [services, query, sort]);

  function onPay(service: ServiceView) {
    setPayTarget(service);
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <BurgerButton />
          <Logo size={42} className="mt-1" />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              The Kitty
            </p>
            <h1 className="text-2xl font-semibold leading-tight">Services</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              What your circle is offering.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && address ? (
            <>
              <InviteButton variant="pill" />
              <Link
                to={`/providers/${address.toLowerCase()}`}
                aria-label="My profile"
                className="rounded-full hover:opacity-80"
              >
                <MemberAvatar address={address} size="sm" />
              </Link>
            </>
          ) : (
            <Badge tone="neutral">{isMiniappHost ? 'Waiting…' : 'Standalone'}</Badge>
          )}
        </div>
      </header>

      <MainTabs />

      <InviterBanner selfAddress={address} />

      {stats && stats.servicesPublished > 0 && (
        <p className="inline-flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
          <Zap className="size-3 text-amber-500" />
          <strong className="font-mono text-[var(--color-text)]">{stats.activeServices}</strong>
          {' active · '}
          <strong className="font-mono text-[var(--color-text)]">{stats.activeProviders}</strong>
          {' providers · '}
          <strong className="font-mono text-[var(--color-text)]">{formatCrc(stats.totalCrcPaid)}</strong>
          {' CRC circulated · '}
          <strong className="font-mono text-[var(--color-text)]">{stats.paymentsLogged}</strong>
          {' payments'}
        </p>
      )}

      <Link
        to="/services/new"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-fg)] shadow-[0_10px_28px_-12px_var(--color-shadow)] hover:brightness-110"
      >
        <Plus className="size-4" /> Publish a service
      </Link>

      {recent && recent.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Recently paid in your network
          </p>
          <div className="flex flex-col gap-1.5">
            {recent.map((p) => (
              <Link
                key={p.txHash}
                to={`/services/${p.serviceId.toString()}`}
                className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hi)] px-3 py-2 hover:bg-[var(--color-border)]"
              >
                <MemberAvatar address={p.buyer} size="xs" />
                <span className="flex-1 truncate text-[11px] text-[var(--color-muted)]">
                  paid service #{p.serviceId.toString()}
                  {p.memo && <span className="ml-1 italic">"{p.memo}"</span>}
                </span>
                <span className="shrink-0 font-mono text-[11px]">
                  {formatCrc(p.amount)} CRC
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {services !== null && services.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted)]" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search services"
              className="pl-9"
            />
          </div>
          <label className="flex h-10 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-muted)]">
            <ArrowDownUp className="size-3.5" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="bg-transparent text-sm text-[var(--color-text)] outline-none"
            >
              {Object.entries(SORT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {!registryReady && (
        <Card className="border-rose-500/40 bg-rose-500/5">
          <CardContent>
            <p className="text-sm text-rose-700">
              ServiceRegistry address is missing. Set <code>VITE_SERVICE_REGISTRY</code> in the
              build env (see README).
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-rose-500/40 bg-rose-500/5">
          <CardContent>
            <p className="text-sm text-rose-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {!isConnected && (
        <Card>
          <CardContent>
            <p className="text-sm text-[var(--color-muted)]">
              The Kitty needs the Circles host to inject your Circles wallet — open this URL
              inside the official playground to start.
            </p>
            <div className="mt-3">
              <OpenInPlayground />
            </div>
          </CardContent>
        </Card>
      )}

      {registryReady && services === null && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-[var(--radius-card)]" />
          ))}
        </div>
      )}

      {registryReady && services !== null && services.length === 0 && (
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <Store className="mt-0.5 size-5 text-[var(--color-muted)]" />
              <div>
                <p className="text-sm font-medium">Nothing on the board yet.</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Post what you offer in CRC, or invite someone who does.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {filtered !== null && filtered.length === 0 && services && services.length > 0 && (
        <Card>
          <CardContent>
            <p className="text-sm text-[var(--color-muted)]">
              No services match "<span className="font-medium">{query}</span>". Try another
              term or clear the search.
            </p>
          </CardContent>
        </Card>
      )}

      {filtered !== null && filtered.length > 0 && (
        <section className="flex flex-col gap-3">
          {filtered.map((s) => (
            <ServiceCard
              key={s.id.toString()}
              service={s}
              hasViewer={Boolean(address)}
              onPay={onPay}
              onTrusted={() => {
                void fetchServices();
              }}
            />
          ))}
        </section>
      )}

      <AppFooter />

      {payTarget && (
        <PaySheet
          service={payTarget}
          open={Boolean(payTarget)}
          onClose={() => setPayTarget(null)}
          onPaid={() => {
            void fetchServices();
          }}
        />
      )}
    </main>
  );
}


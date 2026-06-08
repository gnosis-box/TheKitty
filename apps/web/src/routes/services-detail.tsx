import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Clock,
  HandCoins,
  Pencil,
  Share2,
  Star,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { BurgerButton } from '@/components/BurgerButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { OpenInPlayground } from '@/components/OpenInPlayground';
import { PaySheet } from '@/components/services/PaySheet';
import { TrustButton } from '@/components/services/TrustButton';
import { Skeleton } from '@/components/ui/skeleton';
import { useWallet } from '@/hooks/use-wallet';
import {
  ratingAverage,
  readMyServices,
  readRatingBreakdown,
  readServiceById,
  type RatingBreakdown,
  type ServiceView,
} from '@/lib/services-reader';
import { formatCrc, shortAddress } from '@/lib/utils';
import { CIRCLES_CONFIG } from '@/lib/circles-config';
import { hubV2Abi } from '@/lib/abi/hub-v2';
import { getPublicClient } from '@/lib/public-client';
import type { Address } from '@/types/kitty';

/// `/services/:id` — full-page view of a single service. Used for:
///   - Deep-linking from outside (e.g. a friend shares the URL in chat)
///   - Browsing a provider's other services
///   - A richer pay surface than the inline card
///
/// Loads the service + the same provider's other active services, refreshes
/// after a successful payment, and hosts the `PaySheet` for the actual flow.
export default function ServicesDetailRoute() {
  const { id: idParam } = useParams<{ id: string }>();
  const { address, isConnected } = useWallet();
  const navigate = useNavigate();

  const id = useMemo(() => {
    if (!idParam) return null;
    try {
      return BigInt(idParam);
    } catch {
      return null;
    }
  }, [idParam]);

  const [service, setService] = useState<ServiceView | null>(null);
  const [siblings, setSiblings] = useState<ServiceView[]>([]);
  const [breakdown, setBreakdown] = useState<RatingBreakdown | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const isOwner =
    service != null &&
    address != null &&
    service.provider.toLowerCase() === address.toLowerCase();

  async function load() {
    if (id == null) {
      setNotFound(true);
      setLoaded(true);
      return;
    }
    const s = await readServiceById(id);
    if (!s) {
      setNotFound(true);
      setLoaded(true);
      return;
    }
    // Stamp the viewer's trust state so PaySheet can decide between
    // "Pay" and "Trust + pay". readServiceById doesn't do this (it's a
    // single-service view, no viewer assumed).
    if (address && CIRCLES_CONFIG.v2HubAddress) {
      try {
        const trusted = (await getPublicClient().readContract({
          abi: hubV2Abi,
          address: CIRCLES_CONFIG.v2HubAddress,
          functionName: 'isTrusted',
          args: [address as Address, s.provider],
        })) as boolean;
        s.trustedByViewer = trusted;
      } catch {
        s.trustedByViewer = false;
      }
    }
    setService(s);
    setLoaded(true);

    // Provider's other services + per-star breakdown, both in parallel.
    try {
      const [all, bd] = await Promise.all([
        readMyServices(s.provider),
        readRatingBreakdown(s.id),
      ]);
      setSiblings(all.filter((x) => x.active && x.id !== s.id));
      setBreakdown(bd);
    } catch {
      setSiblings([]);
      setBreakdown(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setService(null);
    setNotFound(false);
    (async () => {
      try {
        if (!cancelled) await load();
      } catch {
        if (!cancelled) {
          setNotFound(true);
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, address]);

  function onShare() {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.share) {
      navigator
        .share({ title: service?.title ?? 'The Kitty', url })
        .catch(() => {});
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Link copied'))
      .catch(() => toast.error('Could not copy link'));
  }

  if (!loaded) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </main>
    );
  }

  if (notFound || !service) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
        <header className="flex items-center gap-3">
          <BurgerButton />
          <h1 className="text-2xl font-semibold">Not found</h1>
        </header>
        <Card>
          <CardContent>
            <p className="text-sm">This service doesn't exist (or was removed).</p>
            <Button onClick={() => navigate('/services')} className="mt-3">
              Back to services
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const avg = ratingAverage(service);
  const priceLabel = formatCrc(service.priceCrc);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/services')}
          aria-label="Back"
          className="px-2"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Service
          </p>
          <h1 className="text-2xl font-semibold leading-tight">{service.title}</h1>
        </div>
        <button
          type="button"
          onClick={onShare}
          aria-label="Share"
          className="inline-flex size-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:bg-[var(--color-surface-hi)] hover:text-[var(--color-text)]"
        >
          <Share2 className="size-4" />
        </button>
      </header>

      <Card>
        <CardContent>
          {service.description && (
            <p className="text-sm leading-relaxed">{service.description}</p>
          )}

          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hi)] p-3">
            <div className="text-left">
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                Price
              </p>
              <p className="font-mono text-2xl leading-tight">
                {priceLabel}
                <span className="ml-1 text-xs text-[var(--color-muted)]">CRC</span>
              </p>
            </div>
            {service.durationMins > 0 && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                  Duration
                </p>
                <p className="inline-flex items-center gap-1 font-mono text-base leading-tight">
                  <Clock className="size-3.5" />
                  {formatDuration(service.durationMins)}
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Link
              to={`/providers/${service.provider.toLowerCase()}`}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl hover:bg-[var(--color-surface-hi)]"
            >
              <MemberAvatar address={service.provider} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {shortAddress(service.provider)}
                </p>
                <p className="text-[10px] text-[var(--color-muted)]">
                  Provider · see all services
                </p>
              </div>
            </Link>
            <TrustButton
              trustee={service.provider}
              trusted={service.trustedByViewer}
              onTrusted={() => {
                void load();
              }}
            />
          </div>
        </CardContent>
      </Card>

      {service.poolShareBps > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent>
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-900">
              ✨ Contributes{' '}
              {(service.poolShareBps / 100).toFixed(
                service.poolShareBps % 100 === 0 ? 0 : 1,
              )}
              % of every payment to the community pool
            </p>
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">
              The pool funds the weekly prize draw + referral rewards. Top
              contributors get featured on the services page.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Star className="size-4" /> Reputation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat
              label="Rating"
              value={avg !== null ? avg.toFixed(1) : '—'}
              hint={`${Number(service.ratingsCount)} rater${
                Number(service.ratingsCount) === 1 ? '' : 's'
              }`}
            />
            <Stat
              label="Paid"
              value={Number(service.timesPaid).toString()}
              hint="payments"
            />
            <Stat label="CRC paid" value={formatCrc(service.totalPaid)} hint="lifetime" />
          </div>

          {breakdown && (
            <RatingBars
              breakdown={breakdown}
              totalRaters={Number(service.ratingsCount)}
            />
          )}
        </CardContent>
      </Card>

      {siblings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <HandCoins className="size-4" /> More from this provider
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {siblings.map((sib) => (
                <li key={sib.id.toString()}>
                  <Link
                    to={`/services/${sib.id.toString()}`}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-surface-hi)] px-3 py-2 hover:bg-[var(--color-border)]"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">{sib.title}</span>
                    <span className="shrink-0 font-mono text-sm">
                      {formatCrc(sib.priceCrc)}
                      <span className="ml-1 text-[10px] text-[var(--color-muted)]">CRC</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {isOwner ? (
        <Link
          to={`/services/${service.id.toString()}/edit`}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium hover:bg-[var(--color-surface-hi)]"
        >
          <Pencil className="size-4" /> Edit this service
        </Link>
      ) : isConnected ? (
        <button
          type="button"
          onClick={() => setPayOpen(true)}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] text-sm font-medium text-[var(--color-accent-fg)] shadow-[0_10px_28px_-12px_var(--color-shadow)] hover:brightness-110"
        >
          {service.trustedByViewer === true ? (
            <>
              <Check className="size-4" /> Pay {priceLabel} CRC
            </>
          ) : (
            <>Trust + pay {priceLabel} CRC</>
          )}
        </button>
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm text-[var(--color-muted)]">
              Open this URL inside the Circles playground to pay this service.
            </p>
            <div className="mt-3">
              <OpenInPlayground />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <p className="text-[11px] text-[var(--color-muted)]">
            Posted{' '}
            <a
              href={`https://gnosisscan.io/address/${CIRCLES_CONFIG.serviceRegistryAddress}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono hover:text-[var(--color-text)]"
            >
              on-chain
            </a>{' '}
            · service #{service.id.toString()} ·{' '}
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" /> {Number(service.timesPaid)} paid · ★{' '}
              {avg !== null ? avg.toFixed(1) : '—'}
            </span>
          </p>
        </CardContent>
      </Card>

      {service && (
        <PaySheet
          service={service}
          open={payOpen}
          onClose={() => setPayOpen(false)}
          onPaid={() => {
            void load();
          }}
        />
      )}
    </main>
  );
}

interface RatingBarsProps {
  breakdown: RatingBreakdown;
  totalRaters: number;
}

/// Per-star distribution: one row per level (5★ at the top), with a fill
/// bar proportional to that bucket's share of the *busiest* bucket. Same
/// pattern as App Store / Play Store reviews.
function RatingBars({ breakdown, totalRaters }: RatingBarsProps) {
  if (totalRaters === 0) return null;
  const max = Math.max(breakdown[1], breakdown[2], breakdown[3], breakdown[4], breakdown[5], 1);
  const levels = [5, 4, 3, 2, 1] as const;
  return (
    <div className="mt-4 flex flex-col gap-1.5">
      {levels.map((n) => {
        const count = breakdown[n];
        const width = `${(count / max) * 100}%`;
        return (
          <div key={n} className="flex items-center gap-2 text-[11px]">
            <span className="inline-flex w-6 items-center gap-0.5 font-mono">
              {n}
              <Star className="size-3 fill-current text-amber-500" />
            </span>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-hi)]">
              <div
                className="absolute inset-y-0 left-0 bg-amber-500"
                style={{ width }}
              />
            </div>
            <span className="w-6 text-right font-mono text-[var(--color-muted)]">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface StatProps {
  label: string;
  value: string;
  hint?: string;
}

function Stat({ label, value, hint }: StatProps) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-[var(--color-surface-hi)] px-3 py-2">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </span>
      <span className="font-mono text-base">{value}</span>
      {hint && (
        <span className="text-[10px] leading-tight text-[var(--color-muted)]">{hint}</span>
      )}
    </div>
  );
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

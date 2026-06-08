import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Coins, Copy, HandCoins, Share2, Star, Store } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { TrustButton } from '@/components/services/TrustButton';
import { CIRCLES_CONFIG } from '@/lib/circles-config';
import { hubV2Abi } from '@/lib/abi/hub-v2';
import { getPublicClient } from '@/lib/public-client';
import {
  countTrustsWhoPaidProvider,
  ratingAverage,
  readMyServices,
  readPaidServiceIdsByPayer,
  readProviderWeeklyStreak,
  type ProviderStreak,
  type ServiceView,
} from '@/lib/services-reader';
import { buildRateServiceTx } from '@/lib/tx-builders';
import { formatCrc, shortAddress } from '@/lib/utils';
import { useWallet } from '@/hooks/use-wallet';
import type { Address } from '@/types/kitty';

/// `/providers/:address` — public, shareable view of a single provider's
/// catalog. Mirrors the "Stripe link in bio" pattern: one URL the human
/// hands out everywhere ("here's everything I offer in CRC"). Lists every
/// active service, summarises lifetime CRC received and average rating
/// across the whole shop, links to each detail page for the pay flow.
export default function ProviderProfileRoute() {
  const { address: providerParam } = useParams<{ address: string }>();
  const { address: viewer, sendTransactions } = useWallet();
  const navigate = useNavigate();

  const provider = useMemo<Address | null>(() => {
    if (!providerParam) return null;
    if (!/^0x[a-fA-F0-9]{40}$/.test(providerParam)) return null;
    return providerParam.toLowerCase() as Address;
  }, [providerParam]);

  const [services, setServices] = useState<ServiceView[] | null>(null);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState<ProviderStreak | null>(null);
  const [openRateFor, setOpenRateFor] = useState<string | null>(null);
  const [rating, setRating] = useState(false);
  const [trustedByViewer, setTrustedByViewer] = useState<boolean | undefined>(
    undefined,
  );
  const [trustsWhoPaid, setTrustsWhoPaid] = useState<Address[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh(p: Address) {
    const isSelfNow = viewer && viewer.toLowerCase() === p.toLowerCase();
    const [list, paid, isTrustedRaw, streakRaw, social] = await Promise.all([
      readMyServices(p),
      !isSelfNow && viewer
        ? readPaidServiceIdsByPayer(viewer as Address, p)
        : Promise.resolve(new Set<string>()),
      !isSelfNow && viewer
        ? (getPublicClient().readContract({
            abi: hubV2Abi,
            address: CIRCLES_CONFIG.v2HubAddress,
            functionName: 'isTrusted',
            args: [viewer as Address, p],
          }) as Promise<boolean>)
        : Promise.resolve(undefined as boolean | undefined),
      readProviderWeeklyStreak(p),
      !isSelfNow && viewer
        ? countTrustsWhoPaidProvider(viewer as Address, p)
        : Promise.resolve({ count: 0, trusts: [] as Address[] }),
    ]);
    setServices(list);
    setPaidIds(paid);
    setTrustedByViewer(isTrustedRaw);
    setStreak(streakRaw);
    setTrustsWhoPaid(social.trusts);
  }

  useEffect(() => {
    if (!provider) {
      setError('Not a valid Circles address.');
      setServices([]);
      return;
    }
    let cancelled = false;
    setServices(null);
    setError(null);
    (async () => {
      try {
        if (!cancelled) await refresh(provider);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load provider');
          setServices([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, viewer]);

  async function rateService(serviceId: bigint, stars: number) {
    if (!viewer) return;
    setRating(true);
    try {
      toast.loading('Saving rating…', { id: 'rate-from-profile' });
      const tx = buildRateServiceTx({ serviceId, stars });
      const [hash] = await sendTransactions([tx]);
      if (!hash) throw new Error('Host returned no tx hash');
      toast.success(`Thanks — ${stars}★ saved`, { id: 'rate-from-profile' });
      setOpenRateFor(null);
      if (provider) await refresh(provider);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to rate', {
        id: 'rate-from-profile',
      });
    } finally {
      setRating(false);
    }
  }

  function onShare() {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.share) {
      navigator
        .share({ title: 'The Kitty — provider profile', url })
        .catch(() => {});
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Link copied'))
      .catch(() => toast.error('Could not copy link'));
  }

  const aggregate = useMemo(() => {
    if (!services || services.length === 0) return null;
    let totalPaid = 0n;
    let totalPayments = 0;
    let ratingsSum = 0n;
    let ratingsCount = 0n;
    let active = 0;
    for (const s of services) {
      totalPaid += s.totalPaid;
      totalPayments += Number(s.timesPaid);
      ratingsSum += s.ratingsSum;
      ratingsCount += s.ratingsCount;
      if (s.active) active += 1;
    }
    const avg =
      ratingsCount > 0n ? Number(ratingsSum) / Number(ratingsCount) : null;
    return { totalPaid, totalPayments, active, avg, ratingsCount };
  }, [services]);

  const isSelf =
    provider && viewer && viewer.toLowerCase() === provider.toLowerCase();
  const activeServices = services?.filter((s) => s.active) ?? [];

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="px-2"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Provider
          </p>
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

      {provider && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <MemberAvatar address={provider} size="md" />
              {isSelf && <Badge tone="neutral">You</Badge>}
              <div className="ml-auto">
                <TrustButton
                  trustee={provider}
                  trusted={trustedByViewer}
                  onTrusted={() => provider && void refresh(provider)}
                />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <p className="font-mono text-xs text-[var(--color-muted)]">
                {shortAddress(provider)}
              </p>
              <CopyAddressButton address={provider} />
            </div>
            {trustsWhoPaid.length > 0 && !trustedByViewer && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5">
                <div className="flex -space-x-2">
                  {trustsWhoPaid.slice(0, 3).map((t) => (
                    <div
                      key={t}
                      className="rounded-full ring-2 ring-[var(--color-surface)]"
                      title={shortAddress(t)}
                    >
                      <MemberAvatar address={t} size="xs" />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] leading-snug text-amber-900">
                  <strong>{trustsWhoPaid.length}</strong> of your trusts paid
                  here. Tap <em>Trust</em> above to add this provider to your
                  circle.
                </p>
              </div>
            )}
            {streak && streak.weeks > 0 && (
              <p
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-900"
                title="Consecutive ISO weeks (Mon–Sun UTC) with at least one payment received"
              >
                🔥 {streak.weeks} week{streak.weeks === 1 ? '' : 's'} active
                {!streak.currentWeekCounted && (
                  <span className="font-normal text-amber-700">
                    · break-the-streak this week
                  </span>
                )}
              </p>
            )}
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

      {services === null && !error && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[var(--radius-card)]" />
          ))}
        </div>
      )}

      {services !== null && aggregate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Star className="size-4" /> Reputation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Stat
                icon={<Star className="size-3.5" />}
                label="Rating"
                value={aggregate.avg !== null ? aggregate.avg.toFixed(1) : '—'}
                hint={`${Number(aggregate.ratingsCount)} rater${
                  Number(aggregate.ratingsCount) === 1 ? '' : 's'
                }`}
              />
              <Stat
                icon={<HandCoins className="size-3.5" />}
                label="Paid"
                value={aggregate.totalPayments.toString()}
                hint="payments"
              />
              <Stat
                icon={<Coins className="size-3.5" />}
                label="CRC"
                value={formatCrc(aggregate.totalPaid)}
                hint="lifetime"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {services !== null && activeServices.length === 0 && (
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <Store className="mt-0.5 size-5 text-[var(--color-muted)]" />
              <div>
                <p className="text-sm font-medium">
                  No active services right now.
                </p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Either this provider hasn't published anything yet, or all of
                  their listings are deactivated.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeServices.length > 0 && (
        <section className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Active services ({activeServices.length})
          </p>
          {activeServices.map((s) => {
            const avg = ratingAverage(s);
            const key = s.id.toString();
            const canRate = paidIds.has(key);
            const isOpen = openRateFor === key;
            return (
              <div
                key={key}
                className="block rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <Link to={`/services/${key}`} className="block hover:opacity-90">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold leading-tight">
                        {s.title}
                      </p>
                      {s.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">
                          {s.description}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 font-mono text-base leading-tight">
                      {formatCrc(s.priceCrc)}
                      <span className="ml-1 text-xs text-[var(--color-muted)]">
                        CRC
                      </span>
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--color-muted)]">
                    {avg !== null && (
                      <span className="inline-flex items-center gap-0.5">
                        <Star className="size-3 fill-current text-amber-500" />
                        {avg.toFixed(1)}
                        <span>({Number(s.ratingsCount)})</span>
                      </span>
                    )}
                    {s.timesPaid > 0n && <span>{Number(s.timesPaid)} paid</span>}
                  </div>
                </Link>

                {canRate && (
                  <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                    {isOpen ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              disabled={rating}
                              onClick={() => rateService(s.id, n)}
                              aria-label={`${n} star${n === 1 ? '' : 's'}`}
                              className="rounded-full p-1 transition-transform hover:scale-110 disabled:opacity-50"
                            >
                              <Star className="size-5 text-amber-500 hover:fill-current" />
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setOpenRateFor(null)}
                          className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOpenRateFor(key)}
                        className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-hi)] text-xs font-medium hover:bg-[var(--color-border)]"
                      >
                        <Star className="size-3.5" /> Rate this service
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}

/// Tiny inline button that copies the full Circles address to the
/// clipboard. The visible address is truncated (shortAddress) so we need
/// a way to grab the canonical hex without manual DOM selection — useful
/// for pasting into gnosisscan, Circles app, group invites, etc.
function CopyAddressButton({ address }: { address: Address }) {
  const [copied, setCopied] = useState(false);
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success('Address copied');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy');
    }
  }
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="Copy address"
      title={address}
      className="inline-flex size-6 items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-hi)] hover:text-[var(--color-text)]"
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-500" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
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

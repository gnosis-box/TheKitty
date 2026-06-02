import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pencil, Plus, Store, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { BurgerButton } from '@/components/BurgerButton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { OpenInPlayground } from '@/components/OpenInPlayground';
import { Skeleton } from '@/components/ui/skeleton';
import { useWallet } from '@/hooks/use-wallet';
import { CIRCLES_CONFIG } from '@/lib/circles-config';
import { readMyServices, type ServiceView } from '@/lib/services-reader';
import { buildDeactivateServiceTx } from '@/lib/tx-builders';
import { formatCrc } from '@/lib/utils';
import type { Address } from '@/types/kitty';

/// `/services/mine` — manage your published services. Lists everything the
/// viewer has on the ServiceRegistry (active + inactive), with Edit and
/// Deactivate actions. Edit links to `/services/:id/edit`; Deactivate
/// signs a single tx and refreshes in place.
export default function ServicesMineRoute() {
  const { address, isConnected, sendTransactions } = useWallet();
  const navigate = useNavigate();
  const registryReady = Boolean(CIRCLES_CONFIG.serviceRegistryAddress);

  const [services, setServices] = useState<ServiceView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<bigint | null>(null);

  async function load(viewer: Address) {
    try {
      const list = await readMyServices(viewer);
      setServices(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your services');
      setServices([]);
    }
  }

  useEffect(() => {
    if (!address) {
      setServices([]);
      return;
    }
    let cancelled = false;
    setServices(null);
    setError(null);
    (async () => {
      try {
        const list = await readMyServices(address as Address);
        if (!cancelled) setServices(list);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load your services');
          setServices([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  async function onDeactivate(svc: ServiceView) {
    if (!address) return;
    setPendingId(svc.id);
    try {
      toast.loading('Deactivating…', { id: 'deactivate' });
      const tx = buildDeactivateServiceTx({ id: svc.id });
      const [hash] = await sendTransactions([tx]);
      if (!hash) throw new Error('Host returned no tx hash');
      toast.success('Service deactivated', { id: 'deactivate' });
      await load(address as Address);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to deactivate', {
        id: 'deactivate',
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <BurgerButton />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              The Kitty
            </p>
            <h1 className="text-2xl font-semibold leading-tight">My services</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Edit or deactivate what you've published.
            </p>
          </div>
        </div>
      </header>

      <Link
        to="/services/new"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-fg)] shadow-[0_10px_28px_-12px_var(--color-shadow)] hover:brightness-110"
      >
        <Plus className="size-4" /> Publish a service
      </Link>

      {!registryReady && (
        <Card className="border-rose-500/40 bg-rose-500/5">
          <CardContent>
            <p className="text-sm text-rose-700">
              ServiceRegistry address missing — set <code>VITE_SERVICE_REGISTRY</code>.
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
              Open this URL inside the Circles playground to see your services.
            </p>
            <div className="mt-3">
              <OpenInPlayground />
            </div>
          </CardContent>
        </Card>
      )}

      {registryReady && isConnected && services === null && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[var(--radius-card)]" />
          ))}
        </div>
      )}

      {registryReady && isConnected && services !== null && services.length === 0 && (
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <Store className="mt-0.5 size-5 text-[var(--color-muted)]" />
              <div>
                <p className="text-sm font-medium">You haven't published anything yet.</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Tap "Publish a service" to add your first one.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {services !== null && services.length > 0 && (
        <section className="flex flex-col gap-3">
          {services.map((s) => (
            <Card key={s.id.toString()}>
              <CardContent>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-base font-semibold leading-tight">
                        {s.title}
                      </p>
                      {!s.active && <Badge tone="neutral">Inactive</Badge>}
                    </div>
                    {s.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted)]">
                        {s.description}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 font-mono text-base leading-tight">
                    {formatCrc(s.priceCrc)}
                    <span className="ml-1 text-xs text-[var(--color-muted)]">CRC</span>
                  </p>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/services/${s.id.toString()}/edit`)}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hi)] text-xs font-medium hover:bg-[var(--color-border)]"
                  >
                    <Pencil className="size-3.5" /> Edit
                  </button>
                  {s.active && (
                    <button
                      type="button"
                      onClick={() => onDeactivate(s)}
                      disabled={pendingId === s.id}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs font-medium text-rose-700 hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      <XCircle className="size-3.5" />
                      {pendingId === s.id ? 'Deactivating…' : 'Deactivate'}
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}

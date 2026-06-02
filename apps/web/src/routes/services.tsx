import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Store } from 'lucide-react';
import { toast } from 'sonner';

import { AppFooter } from '@/components/AppFooter';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { InviteButton } from '@/components/InviteButton';
import { InviterBanner } from '@/components/pot/InviterBanner';
import { Logo } from '@/components/Logo';
import { MainTabs } from '@/components/MainTabs';
import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { OpenInPlayground } from '@/components/OpenInPlayground';
import { ServiceCard } from '@/components/services/ServiceCard';
import { Skeleton } from '@/components/ui/skeleton';
import { CIRCLES_CONFIG } from '@/lib/circles-config';
import { readAllActiveServices, type ServiceView } from '@/lib/services-reader';
import { useWallet } from '@/hooks/use-wallet';

/// Services tab — default app surface. Loads the full registry of active
/// services, surfaces them with rating + trust state, and routes to the
/// pay flow when a card's CTA is tapped (W6 will wire the actual flow).
export default function ServicesRoute() {
  const { address, isConnected, isMiniappHost } = useWallet();
  const registryReady = Boolean(CIRCLES_CONFIG.serviceRegistryAddress);

  const [services, setServices] = useState<ServiceView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!registryReady) {
      setServices([]);
      return;
    }
    let cancelled = false;
    setServices(null);
    setError(null);
    (async () => {
      try {
        const list = await readAllActiveServices(address ?? undefined);
        if (!cancelled) setServices(list);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load services');
          setServices([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, registryReady]);

  function onPay(service: ServiceView) {
    // W6 wires the actual pay flow. For now we just acknowledge so the user
    // gets feedback while we ship the rest of cycle 3.
    toast.message('Pay flow coming next', {
      description: `${service.title} — ${service.provider}`,
    });
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Logo size={42} className="mt-1" />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              The Kitty
            </p>
            <h1 className="text-2xl font-semibold leading-tight">Services</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Spend your CRC with people you trust.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && address ? (
            <>
              <InviteButton variant="pill" />
              <MemberAvatar address={address} size="sm" />
            </>
          ) : (
            <Badge tone="neutral">{isMiniappHost ? 'Waiting…' : 'Standalone'}</Badge>
          )}
        </div>
      </header>

      <MainTabs />

      <InviterBanner selfAddress={address} />

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
                <p className="text-sm font-medium">No services yet.</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">
                  Be the first to publish — or invite a friend who offers something.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {services !== null && services.length > 0 && (
        <section className="flex flex-col gap-3">
          {services.map((s) => (
            <ServiceCard
              key={s.id.toString()}
              service={s}
              hasViewer={Boolean(address)}
              onPay={onPay}
            />
          ))}
        </section>
      )}

      <AppFooter />
    </main>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ServiceForm, type ServiceFormValues } from '@/components/services/ServiceForm';
import { Skeleton } from '@/components/ui/skeleton';
import { CIRCLES_CONFIG } from '@/lib/circles-config';
import {
  buildDeactivateServiceTx,
  buildUpdateServiceTx,
} from '@/lib/tx-builders';
import { readServiceById, type ServiceView } from '@/lib/services-reader';
import { shortAddress } from '@/lib/utils';
import { useWallet } from '@/hooks/use-wallet';
import type { Address } from '@/types/kitty';

/// `/services/:id/edit` — provider-only update form. Prefills with the
/// current on-chain values and shares the same `<ServiceForm>` as the
/// publish route. Deactivate sits in the form footer so it travels with
/// the same UX block.
export default function ServicesEditRoute() {
  const { id: idParam } = useParams<{ id: string }>();
  const { address, isConnected, sendTransactions } = useWallet();
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
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const registryReady = Boolean(CIRCLES_CONFIG.serviceRegistryAddress);

  useEffect(() => {
    if (id == null) {
      setNotFound(true);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const s = await readServiceById(id);
      if (cancelled) return;
      if (!s) {
        setNotFound(true);
        setLoaded(true);
        return;
      }
      setService(s);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isOwner =
    service != null &&
    address != null &&
    service.provider.toLowerCase() === address.toLowerCase();

  async function update(values: ServiceFormValues) {
    if (id == null) return;
    if (!registryReady) {
      toast.error('ServiceRegistry address missing.');
      return;
    }
    setSubmitting(true);
    try {
      toast.loading('Saving…', { id: 'edit-service' });
      const tx = buildUpdateServiceTx({ id, ...values });
      const [hash] = await sendTransactions([tx]);
      if (!hash) throw new Error('Host returned no tx hash');
      toast.success('Service updated', { id: 'edit-service' });
      navigate('/services/mine');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save', {
        id: 'edit-service',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function onDeactivate() {
    if (id == null) return;
    setDeactivating(true);
    try {
      toast.loading('Deactivating…', { id: 'deactivate-service' });
      const tx = buildDeactivateServiceTx({ id });
      const [hash] = await sendTransactions([tx]);
      if (!hash) throw new Error('Host returned no tx hash');
      toast.success('Service deactivated', { id: 'deactivate-service' });
      navigate('/services/mine');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to deactivate', {
        id: 'deactivate-service',
      });
    } finally {
      setDeactivating(false);
    }
  }

  if (!loaded) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </main>
    );
  }

  if (notFound || !service) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
        <Card>
          <CardContent>
            <p className="text-sm">Service not found.</p>
            <Button onClick={() => navigate('/services/mine')} className="mt-3">
              Back to my services
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
        <Card>
          <CardContent>
            <p className="text-sm">Only the provider can edit this service.</p>
            <Button onClick={() => navigate('/services')} className="mt-3">
              Back to services
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/services/mine')}
          aria-label="Back"
          className="px-2"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Edit service
          </p>
          <h1 className="text-2xl font-semibold">{service.title}</h1>
        </div>
      </header>

      <ServiceForm
        initial={{
          title: service.title,
          description: service.description,
          priceCrcRaw: service.priceCrc,
          durationMins: service.durationMins,
          poolShareBps: service.poolShareBps,
        }}
        submitLabel="Save changes"
        submitting={submitting}
        disabled={!isConnected || deactivating}
        onSubmit={update}
        footer={
          service.active && (
            <button
              type="button"
              onClick={onDeactivate}
              disabled={deactivating || submitting}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/10 text-sm font-medium text-rose-700 hover:bg-rose-500/20 disabled:opacity-50"
            >
              {deactivating ? 'Deactivating…' : 'Deactivate this service'}
            </button>
          )
        }
      />

      <p className="text-center text-xs text-[var(--color-muted)]">
        Editing as {shortAddress(address as Address)}
      </p>
    </main>
  );
}

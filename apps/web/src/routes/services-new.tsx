import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ServiceForm, type ServiceFormValues } from '@/components/services/ServiceForm';
import { CIRCLES_CONFIG } from '@/lib/circles-config';
import { buildPublishServiceTx } from '@/lib/tx-builders';
import { shortAddress } from '@/lib/utils';
import { useWallet } from '@/hooks/use-wallet';
import type { Address } from '@/types/kitty';

/// `/services/new` — publish a new service to the ServiceRegistry. The form
/// is the shared `<ServiceForm>`; this route only owns the page chrome and
/// the publish tx.
export default function ServicesNewRoute() {
  const { address, isConnected, sendTransactions } = useWallet();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const registryReady = Boolean(CIRCLES_CONFIG.serviceRegistryAddress);

  async function publish(values: ServiceFormValues) {
    if (!registryReady) {
      toast.error('ServiceRegistry address missing (VITE_SERVICE_REGISTRY).');
      return;
    }
    if (!address) {
      toast.error('Open inside the Circles playground first.');
      return;
    }
    setSubmitting(true);
    try {
      toast.loading('Publishing…', { id: 'publish-service' });
      const tx = buildPublishServiceTx(values);
      const [hash] = await sendTransactions([tx]);
      if (!hash) throw new Error('Host returned no tx hash');
      toast.success('Service published', { id: 'publish-service' });
      navigate('/services');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish', {
        id: 'publish-service',
      });
    } finally {
      setSubmitting(false);
    }
  }

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
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
            New service
          </p>
          <h1 className="text-2xl font-semibold">Publish a service</h1>
        </div>
      </header>

      {!registryReady && (
        <Card className="border-rose-500/40 bg-rose-500/5">
          <CardContent>
            <p className="text-sm text-rose-700">
              ServiceRegistry address missing — set <code>VITE_SERVICE_REGISTRY</code> in
              the build env.
            </p>
          </CardContent>
        </Card>
      )}

      <ServiceForm
        submitLabel="Publish"
        submitting={submitting}
        disabled={!isConnected || !registryReady}
        onSubmit={publish}
      />

      {!isConnected ? (
        <p className="text-center text-xs text-[var(--color-muted)]">
          Open inside the Circles playground to sign with your Circles wallet.
        </p>
      ) : (
        <p className="text-center text-xs text-[var(--color-muted)]">
          Publishing as {shortAddress(address as Address)}
        </p>
      )}
    </main>
  );
}

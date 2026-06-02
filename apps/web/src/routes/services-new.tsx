import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { parseUnits } from 'viem';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CIRCLES_CONFIG } from '@/lib/circles-config';
import { buildPublishServiceTx } from '@/lib/tx-builders';
import { shortAddress } from '@/lib/utils';
import { useWallet } from '@/hooks/use-wallet';
import type { Address } from '@/types/kitty';

/// `/services/new` — publish a new service to the ServiceRegistry. V1 only
/// covers creation; edits land later via `/services/:id/edit` once the
/// per-provider list view exists.
export default function ServicesNewRoute() {
  const { address, isConnected, sendTransactions } = useWallet();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceCrc, setPriceCrc] = useState('24');
  const [durationMins, setDurationMins] = useState('60');
  const [submitting, setSubmitting] = useState(false);

  const registryReady = Boolean(CIRCLES_CONFIG.serviceRegistryAddress);

  const validation = useMemo(
    () => validate({ title, description, priceCrc, durationMins }),
    [title, description, priceCrc, durationMins],
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validation.ok) {
      if (validation.error) toast.error(validation.error);
      return;
    }
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
      const tx = buildPublishServiceTx({
        title: title.trim(),
        description: description.trim(),
        priceCrc: validation.priceCrcRaw,
        durationMins: validation.durationMinsNum,
      });
      const [txHash] = await sendTransactions([tx]);
      if (!txHash) throw new Error('Host returned no tx hash');
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
              ServiceRegistry address missing — set <code>VITE_SERVICE_REGISTRY</code> in the
              build env.
            </p>
          </CardContent>
        </Card>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>What you're offering</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Title · max 64 chars</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 64))}
                placeholder="Haircut at my studio"
                maxLength={64}
                required
              />
            </div>
            <div className="mt-4 flex flex-col gap-1.5">
              <Label htmlFor="description">Description · optional, max 256 chars</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 256))}
                placeholder="Marseille center, walk-ins welcome"
                maxLength={256}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Price &amp; duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="price">Price · CRC</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step="0.01"
                value={priceCrc}
                onChange={(e) => setPriceCrc(e.target.value)}
                required
              />
              <p className="text-xs text-[var(--color-muted)]">
                Rough anchor: ~1 CRC ≈ 1h of Circles UBI.
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-1.5">
              <Label htmlFor="duration">Duration · minutes (0 if not applicable)</Label>
              <Input
                id="duration"
                type="number"
                min={0}
                step={1}
                value={durationMins}
                onChange={(e) => setDurationMins(e.target.value)}
                required
              />
            </div>
          </CardContent>
        </Card>

        {validation.error && (
          <p className="text-sm text-rose-300">{validation.error}</p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={!isConnected || !validation.ok || !registryReady || submitting}
        >
          {submitting ? 'Publishing…' : 'Publish'}
        </Button>

        {!isConnected ? (
          <p className="text-center text-xs text-[var(--color-muted)]">
            Open inside the Circles playground to sign with your Circles wallet.
          </p>
        ) : (
          <p className="text-center text-xs text-[var(--color-muted)]">
            Publishing as {shortAddress(address as Address)}
          </p>
        )}
      </form>
    </main>
  );
}

interface FormInputs {
  title: string;
  description: string;
  priceCrc: string;
  durationMins: string;
}

interface Validation {
  ok: boolean;
  error?: string;
  priceCrcRaw: bigint;
  durationMinsNum: number;
}

function validate(form: FormInputs): Validation {
  const fallback: Validation = { ok: false, priceCrcRaw: 0n, durationMinsNum: 0 };
  const title = form.title.trim();
  if (!title) return { ...fallback, error: 'Title is required.' };
  if (title.length > 64) return { ...fallback, error: 'Title is too long (max 64 chars).' };
  if (form.description.length > 256) {
    return { ...fallback, error: 'Description is too long (max 256 chars).' };
  }

  let priceCrcRaw: bigint;
  try {
    priceCrcRaw = parseUnits(form.priceCrc || '0', 18);
  } catch {
    return { ...fallback, error: 'Price is not a valid number.' };
  }
  if (priceCrcRaw < 0n) return { ...fallback, error: 'Price cannot be negative.' };

  const durationMinsNum = Number(form.durationMins);
  if (
    !Number.isFinite(durationMinsNum) ||
    durationMinsNum < 0 ||
    !Number.isInteger(durationMinsNum)
  ) {
    return { ...fallback, error: 'Duration must be a non-negative integer.' };
  }

  return { ok: true, priceCrcRaw, durationMinsNum };
}

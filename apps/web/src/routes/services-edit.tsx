import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { formatUnits, parseUnits } from 'viem';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { CIRCLES_CONFIG } from '@/lib/circles-config';
import {
  buildDeactivateServiceTx,
  buildUpdateServiceTx,
} from '@/lib/tx-builders';
import { readServiceById, type ServiceView } from '@/lib/services-reader';
import { shortAddress } from '@/lib/utils';
import { useWallet } from '@/hooks/use-wallet';
import type { Address } from '@/types/kitty';

/// `/services/:id/edit` — owner-only form to update an existing service.
/// Loads the current state via `getService`, prefills the form, submits
/// through `buildUpdateServiceTx`. Also exposes a Deactivate action so
/// the owner can take the listing down without leaving the screen.
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

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceCrc, setPriceCrc] = useState('');
  const [durationMins, setDurationMins] = useState('');
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
      setTitle(s.title);
      setDescription(s.description);
      setPriceCrc(formatUnits(s.priceCrc, 18));
      setDurationMins(String(s.durationMins));
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

  const validation = useMemo(
    () => validate({ title, description, priceCrc, durationMins }),
    [title, description, priceCrc, durationMins],
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (id == null || !validation.ok) {
      if (validation.error) toast.error(validation.error);
      return;
    }
    if (!registryReady) {
      toast.error('ServiceRegistry address missing.');
      return;
    }
    setSubmitting(true);
    try {
      toast.loading('Saving…', { id: 'edit-service' });
      const tx = buildUpdateServiceTx({
        id,
        title: title.trim(),
        description: description.trim(),
        priceCrc: validation.priceCrcRaw,
        durationMins: validation.durationMinsNum,
      });
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

  if (notFound) {
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
          <h1 className="text-2xl font-semibold">{service?.title}</h1>
        </div>
      </header>

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
                maxLength={64}
                required
              />
            </div>
            <div className="mt-4 flex flex-col gap-1.5">
              <Label htmlFor="description">Description · max 256 chars</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 256))}
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
            </div>
            <div className="mt-4 flex flex-col gap-1.5">
              <Label htmlFor="duration">Duration · minutes</Label>
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
          disabled={!isConnected || !validation.ok || submitting || deactivating}
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>

        {service?.active && (
          <button
            type="button"
            onClick={onDeactivate}
            disabled={deactivating || submitting}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/10 text-sm font-medium text-rose-700 hover:bg-rose-500/20 disabled:opacity-50"
          >
            {deactivating ? 'Deactivating…' : 'Deactivate this service'}
          </button>
        )}

        <p className="text-center text-xs text-[var(--color-muted)]">
          Editing as {shortAddress(address as Address)}
        </p>
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
  if (title.length > 64) return { ...fallback, error: 'Title too long.' };
  if (form.description.length > 256) {
    return { ...fallback, error: 'Description too long.' };
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

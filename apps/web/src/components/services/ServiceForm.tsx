import { useMemo, useState, type FormEvent } from 'react';
import { formatUnits, parseUnits } from 'viem';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/// Initial values for prefill. When omitted the form starts blank (publish
/// flow); when provided it acts as an edit form. Numeric fields are
/// pre-formatted (CRC in display units, minutes as a string).
export interface ServiceFormInitial {
  title?: string;
  description?: string;
  /// Price expressed as raw `uint128` atto-CRC (`priceCrc` from the chain).
  /// We format it to a display string internally.
  priceCrcRaw?: bigint;
  durationMins?: number;
}

export interface ServiceFormValues {
  title: string;
  description: string;
  /// Parsed back into raw `uint128` atto-CRC for the tx-builder.
  priceCrc: bigint;
  durationMins: number;
}

interface Props {
  initial?: ServiceFormInitial;
  submitLabel: string;
  submitting: boolean;
  disabled?: boolean;
  onSubmit(values: ServiceFormValues): void;
  /// Optional content rendered between the inputs and the submit button —
  /// used by the edit screen to host the Deactivate action.
  footer?: React.ReactNode;
}

/// Shared `<ServiceForm>` used by both `/services/new` and
/// `/services/:id/edit`. Owns the input state + validation, exposes a
/// single `onSubmit({ title, description, priceCrc, durationMins })`
/// hook for the caller's tx-building logic.
export function ServiceForm({
  initial,
  submitLabel,
  submitting,
  disabled = false,
  onSubmit,
  footer,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [priceCrc, setPriceCrc] = useState(
    initial?.priceCrcRaw != null ? formatUnits(initial.priceCrcRaw, 18) : '24',
  );
  const [durationMins, setDurationMins] = useState(
    initial?.durationMins != null ? String(initial.durationMins) : '60',
  );

  const validation = useMemo(
    () => validate({ title, description, priceCrc, durationMins }),
    [title, description, priceCrc, durationMins],
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validation.ok) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      priceCrc: validation.priceCrcRaw,
      durationMins: validation.durationMinsNum,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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

      {footer}

      <Button
        type="submit"
        size="lg"
        disabled={!validation.ok || submitting || disabled}
      >
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </form>
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

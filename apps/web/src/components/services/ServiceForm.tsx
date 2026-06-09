import { useMemo, useState, type FormEvent } from 'react';
import { formatUnits, parseUnits } from 'viem';
import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/// Hard cap from `ServiceRegistry.MAX_POOL_SHARE_BPS` (10000 = 100%).
/// Mirrored here so the slider can't propose a value the contract would
/// revert on. At 100% the provider runs a pure-fundraiser service that
/// donates the whole payment to the community pool — UI flags that
/// explicitly above 50%.
const MAX_POOL_SHARE_BPS = 10000;
/// Default `poolShareBps` when publishing a new service: a soft nudge,
/// never coercive. Provider can drag the slider to 0% if they want.
const DEFAULT_POOL_SHARE_BPS = 100; // 1%
/// Above this bps we render a warning. Picked at 50% so the provider
/// can't trip into "keep nothing" by accident.
const HIGH_SHARE_WARNING_BPS = 5000;

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
  /// Provider's existing community contribution in basis points.
  /// Defaults to `DEFAULT_POOL_SHARE_BPS` on the publish flow.
  poolShareBps?: number;
}

export interface ServiceFormValues {
  title: string;
  description: string;
  /// Parsed back into raw `uint128` atto-CRC for the tx-builder.
  priceCrc: bigint;
  durationMins: number;
  /// Basis points (0–MAX_POOL_SHARE_BPS) routed to the community pool.
  poolShareBps: number;
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
  const [poolShareBps, setPoolShareBps] = useState<number>(
    initial?.poolShareBps != null ? initial.poolShareBps : DEFAULT_POOL_SHARE_BPS,
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
      poolShareBps: Math.min(Math.max(poolShareBps, 0), MAX_POOL_SHARE_BPS),
    });
  }

  /// Pretty-print basis points as a percentage with one decimal when
  /// needed (e.g. 100 → "1%", 150 → "1.5%", 2000 → "20%").
  function bpsToPercent(bps: number): string {
    const pct = bps / 100;
    return Number.isInteger(pct) ? `${pct}%` : pct.toFixed(1) + '%';
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" /> Community contribution
          </CardTitle>
          <CardDescription>
            Share of every payment routed to the prize pool. Top contributors
            get featured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="poolShare">Pool share</Label>
            <span className="font-mono text-sm">{bpsToPercent(poolShareBps)}</span>
          </div>
          <input
            id="poolShare"
            type="range"
            min={0}
            max={MAX_POOL_SHARE_BPS}
            step={100}
            value={poolShareBps}
            onChange={(e) => setPoolShareBps(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--color-accent)]"
          />
          <div className="mt-1 flex justify-between text-[10px] text-[var(--color-muted)]">
            <span>0%</span>
            <span>50%</span>
            <span>100% (fundraiser)</span>
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            On every {priceCrc || '0'} CRC paid,{' '}
            <strong className="font-mono text-[var(--color-text)]">
              {((Number(priceCrc || '0') * poolShareBps) / 10000).toFixed(2)} CRC
            </strong>{' '}
            ({bpsToPercent(poolShareBps)}) goes to the community pool. You keep{' '}
            <strong className="font-mono text-[var(--color-text)]">
              {(
                Number(priceCrc || '0') -
                (Number(priceCrc || '0') * poolShareBps) / 10000
              ).toFixed(2)} CRC
            </strong>{' '}
            per sale.
          </p>
          {poolShareBps >= HIGH_SHARE_WARNING_BPS && (
            <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-900">
              {poolShareBps === MAX_POOL_SHARE_BPS ? (
                <>
                  ⚠️ <strong>Fundraiser mode</strong>: you keep 0 CRC per sale.
                  Every payment goes entirely to the community pool.
                </>
              ) : (
                <>
                  ⚠️ You're routing more than half of every payment to the pool.
                  Make sure this is intentional before publishing.
                </>
              )}
            </p>
          )}
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

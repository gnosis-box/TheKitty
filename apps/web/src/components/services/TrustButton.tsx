import { useState } from 'react';
import { toast } from 'sonner';
import { Check, UserPlus } from 'lucide-react';

import { useWallet } from '@/hooks/use-wallet';
import { buildTrustTx } from '@/lib/tx-builders';
import type { Address } from '@/types/kitty';

interface Props {
  /// The address the viewer would trust. Skipped (returns null) when the
  /// caller is the same address — you can't usefully trust yourself.
  trustee: Address;
  /// Pre-fetched trust state. `true` → already trusted, render a passive
  /// "Trusted" pill. `false` → render the active button. `undefined` →
  /// also render passive (we don't have the state yet, hide the action).
  trusted: boolean | undefined;
  /// Caller's optimistic refresh after a successful trust tx — usually
  /// re-runs the page's main fetcher.
  onTrusted?(): void;
  /// Pass `true` to render the "Trusted" affirmation; pass `false` to skip
  /// the affirmation when the trustee is the viewer themselves.
  showAffirmation?: boolean;
  variant?: 'pill' | 'inline';
}

/// One-tap on-chain trust extension via the existing `Hub.trust(trustee,
/// type(uint96).max)` tx-builder. Decoupled from the pay flow so the
/// viewer can vouch for a provider (or any Circles human) without
/// initiating a payment.
export function TrustButton({
  trustee,
  trusted,
  onTrusted,
  showAffirmation = true,
  variant = 'pill',
}: Props) {
  const { address, isConnected, sendTransactions } = useWallet();
  const [submitting, setSubmitting] = useState(false);

  const isSelf = address && address.toLowerCase() === trustee.toLowerCase();
  if (isSelf) return null;

  if (trusted === true) {
    if (!showAffirmation) return null;
    return (
      <span
        className={
          variant === 'pill'
            ? 'inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700'
            : 'inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700'
        }
      >
        <Check className="size-3" /> Trusted
      </span>
    );
  }

  async function onTrust() {
    if (!isConnected) {
      toast.error('Open inside the Circles playground first.');
      return;
    }
    setSubmitting(true);
    try {
      toast.loading('Extending trust…', { id: 'trust-action' });
      const tx = buildTrustTx({ trustee });
      const [hash] = await sendTransactions([tx]);
      if (!hash) throw new Error('Host returned no tx hash');
      toast.success('Trust extended', { id: 'trust-action' });
      onTrusted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to trust', {
        id: 'trust-action',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const base =
    variant === 'pill'
      ? 'inline-flex h-7 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[11px] font-medium hover:bg-[var(--color-surface-hi)]'
      : 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-medium hover:bg-[var(--color-surface-hi)]';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void onTrust();
      }}
      disabled={submitting || !isConnected || trusted === undefined}
      aria-label="Trust this Circles human"
      className={`${base} disabled:opacity-50`}
    >
      <UserPlus className="size-3" />
      {submitting ? 'Trusting…' : 'Trust'}
    </button>
  );
}

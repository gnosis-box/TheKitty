import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Network } from 'lucide-react';

import { useWallet } from '@/hooks/use-wallet';
import { buildTrustTx } from '@/lib/tx-builders';
import type { Address } from '@/types/kitty';

interface Props {
  /// The avatar the viewer would vouch for.
  trustee: Address;
  /// True when Hub.isTrusted(viewer, trustee) returned true.
  alreadyTrusted: boolean;
  /// Hide entirely when the row IS the viewer (you don't trust yourself in the
  /// trust graph — it's implicit and the Hub would revert anyway).
  isSelf: boolean;
  /// Called after a successful trust tx so the parent can re-read the trust
  /// state and flip the chip to "trusted".
  onTrusted?: () => void;
}

/// Compact inline chip next to a kitty member's avatar. Drives a single
/// Hub.trust(trustee, expiry) signature so the viewer can vouch for the
/// member directly from the kitty page — no detour through Metri.
///
/// Three states:
///  - self: render nothing
///  - alreadyTrusted: small "trusted" badge with a check
///  - not trusted yet: actionable "Trust" pill
export function TrustChip({ trustee, alreadyTrusted, isSelf, onTrusted }: Props) {
  const { sendTransactions } = useWallet();
  const [signing, setSigning] = useState(false);

  if (isSelf) return null;

  if (alreadyTrusted) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
        <Check className="size-3" />
        trusted
      </span>
    );
  }

  async function onTrust() {
    setSigning(true);
    try {
      toast.loading('Vouching for member…', { id: `trust-${trustee}` });
      const [txHash] = await sendTransactions([buildTrustTx({ trustee })]);
      if (!txHash) throw new Error('Host returned no tx hash');
      toast.success('Trust added ✓', { id: `trust-${trustee}` });
      onTrusted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Trust failed', {
        id: `trust-${trustee}`,
      });
    } finally {
      setSigning(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onTrust}
      disabled={signing}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[color-mix(in_oklab,var(--color-accent),black_20%)] hover:bg-[var(--color-accent-soft)]/80 disabled:opacity-60"
    >
      <Network className="size-3" />
      {signing ? 'Signing…' : 'Trust'}
    </button>
  );
}

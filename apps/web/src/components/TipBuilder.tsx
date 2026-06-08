import { useState } from 'react';
import { toast } from 'sonner';
import { Coffee, HeartHandshake, Pizza } from 'lucide-react';

import { useWallet } from '@/hooks/use-wallet';
import { TRUST_EXPIRY_NEVER } from '@/lib/tx-builders';
import type { Address } from '@/types/kitty';

/// Builder's Circles wallet — recipient of any tip sent through the
/// `<TipBuilder>` block on `/about`. Same address as the project's
/// maintainer (Wieedze / maxime.moodz).
const BUILDER_ADDRESS = '0x84573db6370509840e8225b6E39a9f750c395E68' as Address;

interface Tip {
  emoji: string;
  icon: React.ReactNode;
  label: string;
  amountCrc: bigint;
  description: string;
}

const TIPS: Tip[] = [
  {
    emoji: '🙏',
    icon: <HeartHandshake className="size-4" />,
    label: '10 CRC',
    amountCrc: 10n * 10n ** 18n,
    description: 'Thanks',
  },
  {
    emoji: '☕',
    icon: <Coffee className="size-4" />,
    label: '100 CRC',
    amountCrc: 100n * 10n ** 18n,
    description: 'Coffee',
  },
  {
    emoji: '🍕',
    icon: <Pizza className="size-4" />,
    label: '500 CRC',
    amountCrc: 500n * 10n ** 18n,
    description: 'Pizza',
  },
];

/// "Tip the builder" — three preset CRC amounts the viewer can send to
/// the project's maintainer wallet. Each tap bundles `Hub.trust` (if
/// needed) + `Hub.safeTransferFrom` of viewer's personal CRC, in a
/// single host signature. Matches the pattern other mini-apps in the
/// playground (e.g. Yield) use for builder support.
export function TipBuilder() {
  const { address, isConnected, circlesSdk, sendTransactions } = useWallet();
  const [pending, setPending] = useState<bigint | null>(null);

  const viewer = address as Address | null;
  const isBuilder =
    viewer && viewer.toLowerCase() === BUILDER_ADDRESS.toLowerCase();

  async function onTip(amount: bigint) {
    if (!viewer || !circlesSdk) {
      toast.error('Open inside the Circles playground first.');
      return;
    }
    setPending(amount);
    try {
      toast.loading('Sending tip…', { id: 'tip-builder' });
      const core = circlesSdk.core;
      const tokenId = BigInt(viewer);

      // We can't pre-check trust toward the builder cheaply from here, so
      // we always include the Hub.trust call. Re-trusting an already-
      // trusted address is a no-op on Hub V2 (idempotent), so the worst
      // case is a few extra gas units.
      const reqs = [
        core.hubV2.trust(BUILDER_ADDRESS, TRUST_EXPIRY_NEVER),
        core.hubV2.safeTransferFrom(
          viewer,
          BUILDER_ADDRESS,
          tokenId,
          amount,
          '0x',
        ),
      ];
      const bundle = reqs.map((r) => ({
        to: r.to,
        data: r.data,
        value: r.value == null ? '0' : r.value.toString(),
      }));
      const [hash] = await sendTransactions(bundle);
      if (!hash) throw new Error('Host returned no tx hash');
      toast.success('Tip sent — thanks ❤️', { id: 'tip-builder' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Tip failed', {
        id: 'tip-builder',
      });
    } finally {
      setPending(null);
    }
  }

  // Don't surface the tip block on the builder's own account.
  if (isBuilder) return null;

  return (
    <div className="grid grid-cols-3 gap-2">
      {TIPS.map((tip) => {
        const isPending = pending === tip.amountCrc;
        return (
          <button
            key={tip.label}
            type="button"
            onClick={() => void onTip(tip.amountCrc)}
            disabled={!isConnected || pending !== null}
            className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-center hover:bg-[var(--color-surface-hi)] disabled:opacity-50"
          >
            <span className="text-2xl leading-none" aria-hidden>
              {tip.emoji}
            </span>
            <span className="text-xs font-medium">{tip.label}</span>
            <span className="text-[10px] text-[var(--color-muted)]">
              {isPending ? 'Sending…' : tip.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

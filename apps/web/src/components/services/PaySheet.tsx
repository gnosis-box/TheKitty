import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, ShieldCheck, Wallet, X } from 'lucide-react';

import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { Textarea } from '@/components/ui/textarea';
import { useWallet } from '@/hooks/use-wallet';
import { buildLogPaymentTx } from '@/lib/tx-builders';
import { TRUST_EXPIRY_NEVER } from '@/lib/tx-builders';
import { formatCrc, shortAddress } from '@/lib/utils';
import type { ServiceView } from '@/lib/services-reader';
import type { Address } from '@/types/kitty';

/// The `memo` arg on `ServiceRegistry.logPayment(uint64,uint128,string)` is
/// bound to 256 chars by the contract. Mirror that as a hard cap in the UI
/// so we never produce a tx the contract will revert on.
const MAX_MEMO_LEN = 256;

interface Props {
  service: ServiceView;
  /// Set to a non-null value to open the sheet on a service. Null = closed.
  open: boolean;
  onClose(): void;
  /// Called after a successful pay so the parent can refresh aggregates.
  onPaid(): void;
}

type PaySource = 'wallet';

/// Bottom-sheet UX: source picker + (optional Trust) + Pay + logPayment, all
/// bundled in a single host signature. V1 only exposes the **Circles wallet**
/// source — paying out of a kitty (tontine claim or free-pot smallSpend) lands
/// in a follow-up cycle once we have round/threshold detection plumbed.
export function PaySheet({ service, open, onClose, onPaid }: Props) {
  const { address, isConnected, circlesSdk, sendTransactions } = useWallet();
  const [source] = useState<PaySource>('wallet');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const viewer = address as Address | null;
  const trusted = service.trustedByViewer === true;
  const priceLabel = formatCrc(service.priceCrc);

  // Lock body scroll while the sheet is up.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Esc closes the sheet.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const ctaLabel = useMemo(() => {
    if (submitting) return 'Paying…';
    if (!trusted) return `Trust + pay ${priceLabel} CRC`;
    return `Pay ${priceLabel} CRC`;
  }, [submitting, trusted, priceLabel]);

  async function onConfirm() {
    if (!viewer || !circlesSdk) {
      toast.error('Open inside the Circles playground first.');
      return;
    }
    if (source !== 'wallet') return;

    setSubmitting(true);
    try {
      toast.loading('Sending payment…', { id: 'pay-service' });

      // Use the SDK's typed Hub V2 wrappers — no hand-rolled calldata.
      // `tokenId == uint256(uint160(avatar))` for personal CRC (Hub V2).
      const core = circlesSdk.core;
      const tokenId = BigInt(viewer);
      const reqs = [
        ...(trusted
          ? []
          : [core.hubV2.trust(service.provider, TRUST_EXPIRY_NEVER)]),
        core.hubV2.safeTransferFrom(
          viewer,
          service.provider,
          tokenId,
          service.priceCrc,
          '0x',
        ),
      ];

      // logPayment lives on our own ServiceRegistry, so it stays viem-encoded.
      // The memo is optional — empty string means "no note", which the
      // contract accepts. Calendar-style services use it for "Sat 14h" etc.
      const logTx = buildLogPaymentTx({
        serviceId: service.id,
        amount: service.priceCrc,
        memo: memo.trim(),
      });

      // Convert SDK TransactionRequests (bigint `value`) to the miniapp host
      // shape (hex-string `value`) and ship them all in one signature.
      const bundle = [
        ...reqs.map((r) => ({
          to: r.to,
          data: r.data,
          value: r.value == null ? '0' : r.value.toString(),
        })),
        logTx,
      ];
      const hashes = await sendTransactions(bundle);
      const hash = hashes[0];
      if (!hash) throw new Error('Host returned no tx hash');

      toast.success('Payment sent', { id: 'pay-service' });
      onPaid();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed', {
        id: 'pay-service',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pay ${service.title}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Pay a service
            </p>
            <h2 className="mt-0.5 truncate text-lg font-semibold leading-tight">
              {service.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-8 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-surface-hi)] hover:text-[var(--color-text)]"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hi)] p-3">
          <div className="flex items-center gap-2">
            <MemberAvatar address={service.provider} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm">
                {shortAddress(service.provider)}
              </p>
              <p className="text-[10px] text-[var(--color-muted)]">Provider</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-base leading-tight">
              {priceLabel}
              <span className="ml-1 text-xs text-[var(--color-muted)]">CRC</span>
            </p>
          </div>
        </div>

        <section className="mt-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Source
          </p>
          <div className="mt-2 flex flex-col gap-2">
            <SourceRow
              icon={<Wallet className="size-4" />}
              label="My Circles wallet"
              hint={`Sending ${priceLabel} CRC from your wallet`}
              selected
            />
            <SourceRow
              icon={<ShieldCheck className="size-4" />}
              label="From a kitty"
              hint="Coming soon — tontine round or group-pot small spend"
              disabled
            />
          </div>
        </section>

        <section className="mt-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Note for the provider · optional
          </p>
          <Textarea
            className="mt-2"
            value={memo}
            onChange={(e) => setMemo(e.target.value.slice(0, MAX_MEMO_LEN))}
            placeholder="e.g. Sat 14h, mat haircut"
            maxLength={MAX_MEMO_LEN}
            rows={2}
          />
          <p className="mt-1 text-right text-[10px] text-[var(--color-muted)]">
            {memo.length} / {MAX_MEMO_LEN}
          </p>
        </section>

        {!trusted && (
          <p className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-900">
            You don't trust this provider yet. We'll bundle a one-tap trust with
            your payment in a single signature.
          </p>
        )}

        <button
          type="button"
          onClick={onConfirm}
          disabled={!isConnected || submitting}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] text-sm font-medium text-[var(--color-accent-fg)] shadow-[0_10px_28px_-12px_var(--color-shadow)] hover:brightness-110 disabled:opacity-50"
        >
          {trusted && !submitting && <Check className="size-4" />}
          {ctaLabel}
        </button>

        {!isConnected && (
          <p className="mt-3 text-center text-xs text-[var(--color-muted)]">
            Open inside the Circles playground to sign with your Circles wallet.
          </p>
        )}
      </div>
    </div>
  );
}

interface SourceRowProps {
  icon: React.ReactNode;
  label: string;
  hint: string;
  selected?: boolean;
  disabled?: boolean;
}

function SourceRow({ icon, label, hint, selected, disabled }: SourceRowProps) {
  return (
    <div
      aria-disabled={disabled}
      className={
        'flex items-center justify-between gap-3 rounded-xl border p-3 ' +
        (disabled
          ? 'border-[var(--color-border)] bg-transparent opacity-50'
          : selected
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
            : 'border-[var(--color-border)] bg-[var(--color-surface-hi)]')
      }
    >
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-muted)]">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-[10px] text-[var(--color-muted)]">{hint}</p>
        </div>
      </div>
      {selected && !disabled && (
        <div className="flex size-5 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)]">
          <Check className="size-3" />
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, ShieldCheck, Star, Vote, Wallet, X } from 'lucide-react';

import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { Textarea } from '@/components/ui/textarea';
import { useWallet } from '@/hooks/use-wallet';
import {
  buildLogPaymentTx,
  buildProposeTx,
  buildRateServiceTx,
  buildSmallSpendTx,
  TRUST_EXPIRY_NEVER,
} from '@/lib/tx-builders';
import {
  readGroupPotPaySources,
  type GroupPotPaySource,
} from '@/lib/kitty-pay-sources';
import { readPersonalCrcBalance } from '@/lib/kitty-reader';
import { formatCrc, shortAddress } from '@/lib/utils';
import type { ServiceView } from '@/lib/services-reader';
import type { Address } from '@/types/kitty';

/// The `memo` arg on `ServiceRegistry.logPayment(uint64,uint128,string)` is
/// bound to 256 chars by the contract. Mirror that as a hard cap in the UI
/// so we never produce a tx the contract will revert on.
const MAX_MEMO_LEN = 256;

type Stage = 'pay' | 'rate';

/// Discriminated union for the pay source picker. Wallet is always
/// present; group pots only appear when the viewer is a member, the
/// price fits the small-spend cap, and the provider already trusts the
/// kitty's BaseGroup.
type Source =
  | { type: 'wallet' }
  | { type: 'groupPot'; governance: Address; name: string };

interface Props {
  service: ServiceView;
  /// Set to a non-null value to open the sheet on a service. Null = closed.
  open: boolean;
  onClose(): void;
  /// Called after a successful pay so the parent can refresh aggregates.
  onPaid(): void;
}

/// Bottom-sheet UX: source picker + Pay + logPayment, bundled into a
/// single host signature. Two source types V1:
///   - Wallet  → [trust?, Hub.safeTransferFrom(personal CRC), logPayment]
///   - GroupPot → [kitty.smallSpend, logPayment]
/// Tontines are deliberately absent: they're a savings accumulator,
/// not a spend surface — you claim into your wallet, then pay from there.
export function PaySheet({ service, open, onClose, onPaid }: Props) {
  const { address, isConnected, circlesSdk, sendTransactions } = useWallet();
  const navigate = useNavigate();
  const [source, setSource] = useState<Source>({ type: 'wallet' });
  const [groupPotSources, setGroupPotSources] = useState<GroupPotPaySource[]>([]);
  const [walletBalance, setWalletBalance] = useState<bigint | null>(null);
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [proposingFor, setProposingFor] = useState<Address | null>(null);
  const [stage, setStage] = useState<Stage>('pay');
  const [ratingHover, setRatingHover] = useState(0);
  const [rating, setRating] = useState(0);

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

  // Reset transient state every time the sheet opens fresh.
  useEffect(() => {
    if (!open) return;
    setStage('pay');
    setRating(0);
    setRatingHover(0);
    setSource({ type: 'wallet' });
  }, [open, service.id]);

  // Fetch the viewer's eligible group-pot sources + the wallet balance
  // when the sheet opens. Cheap: 1 multicall for group pots, 1 single
  // read for the personal CRC balance, in parallel.
  useEffect(() => {
    if (!open || !viewer) {
      setGroupPotSources([]);
      setWalletBalance(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [list, bal] = await Promise.all([
          readGroupPotPaySources(viewer, service.provider, service.priceCrc),
          readPersonalCrcBalance(viewer),
        ]);
        if (!cancelled) {
          setGroupPotSources(list);
          setWalletBalance(bal);
        }
      } catch {
        if (!cancelled) {
          setGroupPotSources([]);
          setWalletBalance(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, viewer, service.provider, service.priceCrc]);

  const walletInsufficient =
    walletBalance !== null && walletBalance < service.priceCrc;

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
    if (source.type === 'groupPot') {
      return `Pay ${priceLabel} CRC from ${source.name}`;
    }
    if (!trusted) return `Trust + pay ${priceLabel} CRC`;
    return `Pay ${priceLabel} CRC`;
  }, [submitting, trusted, priceLabel, source]);

  async function onConfirm() {
    if (!viewer || !circlesSdk) {
      toast.error('Open inside the Circles playground first.');
      return;
    }
    setSubmitting(true);
    try {
      toast.loading('Sending payment…', { id: 'pay-service' });

      // logPayment is bundled in every path so the registry aggregates
      // mirror the actual transfer regardless of where the CRC came from.
      const logTx = buildLogPaymentTx({
        serviceId: service.id,
        amount: service.priceCrc,
        memo: memo.trim(),
      });

      let bundle;
      if (source.type === 'groupPot') {
        // Group-pot smallSpend: the kitty sends pot tokens directly to the
        // provider. No Hub.trust step from the buyer is useful here — the
        // recipient-trusts-issuer check on the Hub is against the kitty's
        // BaseGroup, and that's already satisfied (we filtered for it).
        const smallSpendTx = buildSmallSpendTx({
          governance: source.governance,
          recipient: service.provider,
          amount: service.priceCrc,
          memo: memo.trim(),
        });
        bundle = [smallSpendTx, logTx];
      } else {
        // Wallet: typed Hub V2 wrappers from sdk-core. Personal CRC token
        // id == uint256(uint160(viewer)).
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
        bundle = [
          ...reqs.map((r) => ({
            to: r.to,
            data: r.data,
            value: r.value == null ? '0' : r.value.toString(),
          })),
          logTx,
        ];
      }

      const hashes = await sendTransactions(bundle);
      const hash = hashes[0];
      if (!hash) throw new Error('Host returned no tx hash');

      toast.success('Payment sent', { id: 'pay-service' });
      onPaid();
      // Transition to the rate step instead of closing. The user can
      // skip with the X / backdrop and still keep the payment.
      setStage('rate');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed', {
        id: 'pay-service',
      });
    } finally {
      setSubmitting(false);
    }
  }

  /// Open a vote on the kitty for this exact payment. Used when the
  /// price is over the kitty's `smallTxThreshold` — the buyer signs a
  /// `propose(provider, price, memo)` tx and lands on the kitty detail
  /// page so the group can approve. Execute (the actual transfer) will
  /// still fail later if the provider hasn't trusted the kitty's
  /// BaseGroup, but that's a precondition the kitty's members can
  /// negotiate offline.
  async function proposeToKitty(src: GroupPotPaySource) {
    if (!viewer) return;
    setProposingFor(src.kitty.governance);
    try {
      toast.loading('Opening vote…', { id: 'propose-from-pay' });
      const memoForProposal =
        memo.trim().length > 0
          ? `[svc #${service.id.toString()}] ${service.title} — ${memo.trim()}`
          : `[svc #${service.id.toString()}] ${service.title}`;
      const tx = buildProposeTx({
        governance: src.kitty.governance,
        recipient: service.provider,
        amount: service.priceCrc,
        memo: memoForProposal,
      });
      const [hash] = await sendTransactions([tx]);
      if (!hash) throw new Error('Host returned no tx hash');
      toast.success(`Vote opened on ${src.kitty.name}`, {
        id: 'propose-from-pay',
      });
      onClose();
      navigate(`/kitty/${src.kitty.governance}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open vote', {
        id: 'propose-from-pay',
      });
    } finally {
      setProposingFor(null);
    }
  }

  async function submitRating(stars: number) {
    if (!viewer) return;
    setSubmitting(true);
    setRating(stars);
    try {
      toast.loading('Saving rating…', { id: 'rate-service' });
      const tx = buildRateServiceTx({ serviceId: service.id, stars });
      const [hash] = await sendTransactions([tx]);
      if (!hash) throw new Error('Host returned no tx hash');
      toast.success(`Thanks — ${stars}★ saved`, { id: 'rate-service' });
      onPaid();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to rate', {
        id: 'rate-service',
      });
      setRating(0);
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
              {stage === 'rate' ? 'How was it?' : 'Pay a service'}
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

        {stage === 'rate' ? (
          <section className="mt-6 flex flex-col items-center gap-4">
            <p className="text-sm text-[var(--color-muted)]">
              Rate this service so others know it's good.
            </p>
            <div
              role="radiogroup"
              aria-label="Rating"
              className="flex items-center gap-2"
              onMouseLeave={() => setRatingHover(0)}
            >
              {[1, 2, 3, 4, 5].map((n) => {
                const active = n <= (ratingHover || rating);
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} star${n === 1 ? '' : 's'}`}
                    disabled={submitting}
                    onMouseEnter={() => setRatingHover(n)}
                    onFocus={() => setRatingHover(n)}
                    onClick={() => submitRating(n)}
                    className="rounded-full p-1 transition-transform hover:scale-110 disabled:opacity-50"
                  >
                    <Star
                      className={
                        active
                          ? 'size-9 fill-current text-amber-500'
                          : 'size-9 text-[var(--color-muted)]'
                      }
                    />
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="mt-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
            >
              Skip for now
            </button>
          </section>
        ) : (
        <>
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
              hint={
                walletBalance === null
                  ? `Sending ${priceLabel} CRC from your wallet`
                  : walletInsufficient
                    ? `Balance ${formatCrc(walletBalance)} CRC — need ${priceLabel}`
                    : `Available ${formatCrc(walletBalance)} CRC`
              }
              selected={source.type === 'wallet'}
              disabled={walletInsufficient}
              onSelect={() => setSource({ type: 'wallet' })}
            />
            {groupPotSources.map((src) => {
              const govKey = src.kitty.governance;
              const isSelected =
                source.type === 'groupPot' && source.governance === govKey;
              if (!src.eligible) {
                if (src.reason === 'overThreshold') {
                  // Don't disable the row — surface a "Propose" action
                  // instead. The buyer opens a vote, the group decides.
                  const pending = proposingFor === src.kitty.governance;
                  return (
                    <SourceRow
                      key={govKey}
                      icon={<ShieldCheck className="size-4" />}
                      label={src.kitty.name}
                      hint="Over small-spend cap — open a group vote"
                      action={{
                        label: pending ? 'Opening…' : 'Propose',
                        icon: <Vote className="size-3.5" />,
                        disabled: pending || submitting,
                        onClick: () => void proposeToKitty(src),
                      }}
                    />
                  );
                }
                const reason =
                  src.reason === 'insufficientBalance'
                    ? `Pot has ${formatCrc(src.balance)} CRC — need ${priceLabel}`
                    : "Provider doesn't trust this pot yet";
                return (
                  <SourceRow
                    key={govKey}
                    icon={<ShieldCheck className="size-4" />}
                    label={src.kitty.name}
                    hint={reason}
                    disabled
                  />
                );
              }
              return (
                <SourceRow
                  key={govKey}
                  icon={<ShieldCheck className="size-4" />}
                  label={src.kitty.name}
                  hint={`Pot balance ${formatCrc(src.balance)} CRC`}
                  selected={isSelected}
                  onSelect={() =>
                    setSource({
                      type: 'groupPot',
                      governance: govKey,
                      name: src.kitty.name,
                    })
                  }
                />
              );
            })}
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
        </>
        )}
      </div>
    </div>
  );
}

interface SourceRowAction {
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

interface SourceRowProps {
  icon: React.ReactNode;
  label: string;
  hint: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  /// When present, render a button on the right (e.g. "Propose") instead
  /// of the selection checkmark. Used for over-threshold group pots that
  /// can still be acted upon via the vote flow.
  action?: SourceRowAction;
}

function SourceRow({
  icon,
  label,
  hint,
  selected,
  disabled,
  onSelect,
  action,
}: SourceRowProps) {
  const base =
    'flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left ' +
    (disabled
      ? 'border-[var(--color-border)] bg-transparent opacity-50'
      : selected
        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
        : 'border-[var(--color-border)] bg-[var(--color-surface-hi)] hover:bg-[var(--color-border)]');
  const content = (
    <>
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-muted)]">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-[10px] text-[var(--color-muted)]">{hint}</p>
        </div>
      </div>
      {action ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            action.onClick();
          }}
          disabled={action.disabled}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[11px] font-medium hover:bg-[var(--color-surface-hi)] disabled:opacity-50"
        >
          {action.icon}
          {action.label}
        </button>
      ) : (
        selected &&
        !disabled && (
          <div className="flex size-5 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)]">
            <Check className="size-3" />
          </div>
        )
      )}
    </>
  );
  if (onSelect && !disabled && !action) {
    return (
      <button type="button" onClick={onSelect} className={base}>
        {content}
      </button>
    );
  }
  return (
    <div aria-disabled={disabled} className={base}>
      {content}
    </div>
  );
}

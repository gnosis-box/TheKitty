import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { formatUnits, isAddress, parseUnits } from 'viem';
import { ArrowLeft, Cake, HandHeart, Send, UtensilsCrossed, Zap } from 'lucide-react';

import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useKitty } from '@/hooks/use-kitty';
import { useWallet } from '@/hooks/use-wallet';
import { buildProposeTx, buildSmallSpendTx } from '@/lib/tx-builders';
import { formatCrc, shortAddress } from '@/lib/utils';
import type { Address } from '@/types/kitty';

/// Templates that prefill the propose form with a memo + suggested
/// amount so the `propose / approve / execute` flow becomes a first-class
/// action rather than a blank form. The amount is just a suggestion — the
/// user is free to override before submitting.
interface ProposalTemplate {
  id: 'birthday' | 'outing' | 'solidarity';
  icon: ReactNode;
  label: string;
  hint: string;
  memo: string;
  /// 'cap' → suggest the kitty's small-spend cap (single-sig route).
  /// 'cap-x2' → 2× the cap (forces the vote path for larger gestures).
  /// number string → fixed CRC amount.
  /// undefined → leave the amount blank for the user to fill.
  suggestedAmount?: 'cap' | 'cap-x2' | string;
  /// When true the template surfaces a member chip picker so the user
  /// can fill the recipient with a single tap.
  pickFromMembers?: boolean;
}

const TEMPLATES: ProposalTemplate[] = [
  {
    id: 'birthday',
    icon: <Cake className="size-4" />,
    label: 'Birthday gift',
    hint: 'Send a chunk of the kitty to a member who is celebrating.',
    memo: '🎂 Happy birthday',
    suggestedAmount: 'cap',
    pickFromMembers: true,
  },
  {
    id: 'outing',
    icon: <UtensilsCrossed className="size-4" />,
    label: 'Group outing',
    hint: 'Pay a restaurant, venue, or shared activity from the pot.',
    memo: '🍽 Group outing',
    suggestedAmount: 'cap-x2',
  },
  {
    id: 'solidarity',
    icon: <HandHeart className="size-4" />,
    label: 'Solidarity',
    hint: 'Help a person or cause outside the circle.',
    memo: '🤝 Solidarity contribution',
  },
];

export default function KittyProposeRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address, isConnected, sendTransactions } = useWallet();

  const governance = (id ?? '') as Address;
  const { state, refresh } = useKitty(governance);

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<ProposalTemplate['id'] | null>(null);

  /// Apply a template's prefills. Recipient is left empty so the user
  /// either taps a member chip (birthday) or fills it themselves.
  function applyTemplate(t: ProposalTemplate) {
    setActiveTemplate(t.id);
    setMemo(t.memo);
    if (t.suggestedAmount && state) {
      if (t.suggestedAmount === 'cap') {
        setAmount(formatUnits(state.smallTxThreshold, 18));
      } else if (t.suggestedAmount === 'cap-x2') {
        setAmount(formatUnits(state.smallTxThreshold * 2n, 18));
      } else {
        setAmount(t.suggestedAmount);
      }
    } else if (t.suggestedAmount && !state) {
      // Fallback when state isn't loaded yet: at least clear stale value.
      setAmount('');
    }
  }

  const parsedAmount = useMemo(() => {
    if (!amount) return null;
    try {
      return parseUnits(amount, 18);
    } catch {
      return null;
    }
  }, [amount]);

  const isSmall =
    state && parsedAmount !== null && parsedAmount <= state.smallTxThreshold && parsedAmount > 0n;

  if (!id) return null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!state || !address) return;

    if (!isAddress(recipient)) {
      toast.error('Recipient is not a valid address.');
      return;
    }
    if (parsedAmount === null || parsedAmount <= 0n) {
      toast.error('Enter a positive amount.');
      return;
    }

    setSubmitting(true);
    try {
      const tx = isSmall
        ? buildSmallSpendTx({
            governance,
            recipient: recipient as Address,
            amount: parsedAmount,
            memo,
          })
        : buildProposeTx({
            governance,
            recipient: recipient as Address,
            amount: parsedAmount,
            memo,
          });

      toast.loading(isSmall ? 'Sending small spend…' : 'Opening proposal…', { id: 'propose' });
      const [hash] = await sendTransactions([tx]);
      toast.success(
        isSmall ? `Paid ✓ ${hash?.slice(0, 10)}…` : `Proposal opened ✓ ${hash?.slice(0, 10)}…`,
        { id: 'propose' },
      );
      await refresh();
      navigate(`/kitty/${governance}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submit failed', { id: 'propose' });
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
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="px-2"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Spend
          </p>
          <h1 className="text-2xl font-semibold">Pay or propose</h1>
        </div>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Quick templates</CardTitle>
            <CardDescription>
              Common collective expenses, prefilled. Tap one, tweak the
              fields below, send.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className={
                    'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ' +
                    (activeTemplate === t.id
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-hi)] hover:bg-[var(--color-border)]')
                  }
                >
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    {t.icon}
                    {t.label}
                  </div>
                  <p className="text-[10px] leading-snug text-[var(--color-muted)]">
                    {t.hint}
                  </p>
                </button>
              ))}
            </div>
            {activeTemplate === 'birthday' && state && state.members.length > 0 && (
              <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hi)] p-3">
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                  Send to a member
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {state.members
                    .filter((m) => m.toLowerCase() !== (address ?? '').toLowerCase())
                    .map((m) => {
                      const isSelected =
                        recipient.toLowerCase() === m.toLowerCase();
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setRecipient(m)}
                          title={shortAddress(m)}
                          className={
                            'flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-[11px] transition ' +
                            (isSelected
                              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)]'
                              : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:bg-[var(--color-border)]')
                          }
                        >
                          <MemberAvatar address={m} size="sm" />
                          <span className="font-mono">{shortAddress(m)}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recipient</CardTitle>
            <CardDescription>The Circles address receiving the payment.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="recipient">Address</Label>
              <Input
                id="recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value.trim())}
                placeholder="0x…"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Amount · CRC</Label>
              <Input
                id="amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              {state && (
                <p className="text-xs text-[var(--color-muted)]">
                  Small spend cap: {formatCrc(state.smallTxThreshold)} CRC.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="memo">Memo</Label>
              <Textarea
                id="memo"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Rent · February"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isSmall ? (
                <>
                  <Zap className="size-4" /> Direct pay
                  <Badge tone="success">no vote</Badge>
                </>
              ) : (
                <>
                  <Send className="size-4" /> Group vote
                  <Badge tone="accent">requires quorum</Badge>
                </>
              )}
            </CardTitle>
            <CardDescription>
              {isSmall
                ? 'Below the small-spend cap — pays straight from the pool.'
                : 'Above the cap — members vote, then any member executes.'}
            </CardDescription>
          </CardHeader>
        </Card>

        <Button
          type="submit"
          size="lg"
          disabled={!isConnected || submitting || !state || !amount || !recipient}
        >
          {submitting ? 'Sending…' : isSmall ? 'Pay now' : 'Open proposal'}
        </Button>

        {!isConnected ? (
          <p className="text-center text-xs text-[var(--color-muted)]">
            Open inside the Circles playground to sign with your Circles wallet.
          </p>
        ) : address ? (
          <p className="text-center text-xs text-[var(--color-muted)]">
            Signing as {shortAddress(address)}
          </p>
        ) : null}
      </form>
    </main>
  );
}

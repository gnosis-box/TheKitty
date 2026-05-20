import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { isAddress, parseUnits } from 'viem';
import { ArrowLeft, Send, Zap } from 'lucide-react';

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
            <CardTitle>Recipient</CardTitle>
            <CardDescription>The Safe address paying for the goods.</CardDescription>
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
            Open inside the Circles playground to sign with your Safe.
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

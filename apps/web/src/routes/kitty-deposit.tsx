import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { parseUnits } from 'viem';
import { ArrowLeft, PiggyBank } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useKitty } from '@/hooks/use-kitty';
import { useWallet } from '@/hooks/use-wallet';
import { readPersonalCrcBalance } from '@/lib/kitty-reader';
import { buildDepositBundle } from '@/lib/tx-builders';
import { formatCrc, shortAddress } from '@/lib/utils';
import type { Address } from '@/types/kitty';

export default function KittyDepositRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address, isConnected, sendTransactions } = useWallet();

  const governance = (id ?? '') as Address;
  const { state, refresh } = useKitty(governance);

  const [amount, setAmount] = useState('5');
  const [personalCrc, setPersonalCrc] = useState<bigint | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!address) return;
    void readPersonalCrcBalance(address)
      .then(setPersonalCrc)
      .catch(() => setPersonalCrc(null));
  }, [address]);

  if (!id) return null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!address || !state) return;

    let raw: bigint;
    try {
      raw = parseUnits(amount, 18);
    } catch {
      toast.error('Enter a valid amount.');
      return;
    }
    if (raw <= 0n) {
      toast.error('Amount must be greater than zero.');
      return;
    }
    if (personalCrc !== null && raw > personalCrc) {
      toast.error('Amount exceeds your personal CRC balance.');
      return;
    }

    setSubmitting(true);
    try {
      const txs = buildDepositBundle({
        member: address,
        baseGroup: state.groupAvatar,
        governance,
        potTokenId: state.potTokenId,
        amount: raw,
      });

      toast.loading('Sending deposit…', { id: 'deposit' });
      const hashes = await sendTransactions(txs);
      toast.success(`Deposit sent ✓ ${hashes[hashes.length - 1]?.slice(0, 10)}…`, {
        id: 'deposit',
      });
      await refresh();
      navigate(`/kitty/${governance}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Deposit failed', { id: 'deposit' });
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
            Deposit
          </p>
          <h1 className="text-2xl font-semibold">Deposit CRC</h1>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="size-4" /> Amount
          </CardTitle>
          <CardDescription>
            Your personal CRC is collateralized into the kitty pool. The contract custodies
            it on behalf of the group.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {address && personalCrc !== null ? (
            <p className="text-xs text-[var(--color-muted)]">
              Your personal CRC: <strong>{formatCrc(personalCrc)}</strong>
            </p>
          ) : address ? (
            <p className="text-xs text-[var(--color-muted)]">
              Your personal CRC:{' '}
              <Skeleton className="ml-1 inline-block h-3 w-12 align-middle" />
            </p>
          ) : null}
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={!isConnected || submitting || !state}
            >
              {submitting ? 'Depositing…' : 'Deposit'}
            </Button>
            {!isConnected && (
              <p className="text-center text-xs text-[var(--color-muted)]">
                Open inside the Circles playground to sign with your Circles wallet.
              </p>
            )}
            {isConnected && address && (
              <p className="text-center text-xs text-[var(--color-muted)]">
                Signing as {shortAddress(address)}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

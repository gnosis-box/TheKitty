import { useState } from 'react';
import { toast } from 'sonner';
import { Wallet, Signature, Send, ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWallet } from '@/hooks/use-wallet';
import { CIRCLES_CONFIG } from '@/lib/circles-config';
import { shortAddress } from '@/lib/utils';

export default function HomeRoute() {
  const { address, isConnected, isMiniappHost, signMessage, sendTransactions } = useWallet();
  const [busy, setBusy] = useState<null | 'sign' | 'tx'>(null);

  async function handleSign() {
    if (!isConnected) {
      toast.error('Wallet not connected — load the mini-app in the playground.');
      return;
    }
    setBusy('sign');
    try {
      const { signature, verified } = await signMessage('Hello from PotCommun');
      toast.success(
        `Signature ${verified ? '✓' : '(unverified)'} — ${signature.slice(0, 18)}…`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Signing failed');
    } finally {
      setBusy(null);
    }
  }

  async function handleTestTx() {
    if (!isConnected || !address) {
      toast.error('Wallet not connected.');
      return;
    }
    setBusy('tx');
    try {
      // Phase 0 sanity check: noop calldata sent to the V2 Hub.
      // Encoded by hand to avoid pulling viem into the smoke test;
      // real Hub calls land in phase 2 with proper viem encoding.
      const selector = '0x095ea7b3'; // placeholder selector — replaced in phase 2
      const padded = address.replace(/^0x/, '').padStart(64, '0');
      const expiry = 'f'.repeat(64);
      const data = `${selector}${padded}${expiry}` as `0x${string}`;

      const hashes = await sendTransactions([
        {
          to: CIRCLES_CONFIG.v2HubAddress,
          data,
          value: '0',
        },
      ]);
      toast.success(`Tx sent — ${hashes[0]?.slice(0, 18) ?? 'ok'}…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Tx failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
            PotCommun
          </p>
          <h1 className="text-2xl font-semibold">Phase 0 — sanity check</h1>
        </div>
        <Badge tone={CIRCLES_CONFIG.env === 'sandbox' ? 'accent' : 'success'}>
          {CIRCLES_CONFIG.env}
        </Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-4" /> Wallet
          </CardTitle>
          <CardDescription>
            The Circles host injects the Safe address via{' '}
            <code className="text-[var(--color-text)]">onWalletChange</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <Badge tone="success" className="self-start font-mono">
              {shortAddress(address)}
            </Badge>
          ) : (
            <Badge tone="neutral" className="self-start">
              {isMiniappHost ? 'Waiting for host…' : 'Standalone — not connected'}
            </Badge>
          )}
          <p className="text-xs text-[var(--color-muted)]">
            iframe host detected: <strong>{String(isMiniappHost)}</strong>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Host bridge tests</CardTitle>
          <CardDescription>
            Validate the <em>iframe → SDK → Safe</em> chain before moving to phase 1.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSign} disabled={!isConnected || busy === 'sign'}>
            <Signature className="size-4" />
            {busy === 'sign' ? 'Signing…' : 'Sign a message'}
          </Button>
          <Button
            variant="secondary"
            onClick={handleTestTx}
            disabled={!isConnected || busy === 'tx'}
          >
            <Send className="size-4" />
            {busy === 'tx' ? 'Sending…' : 'Send a test tx'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Playground</CardTitle>
          <CardDescription>
            Load this app's Vercel preview URL inside the playground to test under real host
            conditions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href="https://circles.gnosis.io/playground"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-[color-mix(in_oklab,var(--color-accent),white_25%)] hover:underline"
          >
            Open the playground <ExternalLink className="size-3.5" />
          </a>
        </CardContent>
      </Card>
    </main>
  );
}

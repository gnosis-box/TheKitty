import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Wallet, Signature, Send, ChevronDown, ChevronUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KittyCard } from '@/components/pot/KittyCard';
import { useWallet } from '@/hooks/use-wallet';
import { CIRCLES_CONFIG } from '@/lib/circles-config';
import { loadKitties } from '@/lib/storage';
import { shortAddress } from '@/lib/utils';
import type { KittyRef } from '@/types/kitty';

export default function HomeRoute() {
  const { address, isConnected, isMiniappHost, signMessage } = useWallet();
  const [kitties, setKitties] = useState<KittyRef[]>([]);
  const [debugOpen, setDebugOpen] = useState(false);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (!address) {
      setKitties([]);
      return;
    }
    setKitties(loadKitties(address));
  }, [address]);

  async function handleSign() {
    if (!isConnected) {
      toast.error('Wallet not connected — load the mini-app in the Circles host.');
      return;
    }
    setSigning(true);
    try {
      const { signature, verified } = await signMessage('Hello from The Kitty');
      toast.success(`Signature ${verified ? '✓' : '(unverified)'} — ${signature.slice(0, 18)}…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Signing failed');
    } finally {
      setSigning(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
            The Kitty
          </p>
          <h1 className="text-2xl font-semibold">Your group pots</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Chip in. Cash out together.</p>
        </div>
        {isConnected ? (
          <Badge tone="success" className="font-mono">
            {shortAddress(address)}
          </Badge>
        ) : (
          <Badge tone="neutral">{isMiniappHost ? 'Waiting…' : 'Standalone'}</Badge>
        )}
      </header>

      <Link
        to="/kitty/new"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-fg)] shadow-[0_8px_24px_-12px_rgba(124,92,255,0.7)] hover:brightness-110"
      >
        <Plus className="size-4" /> Create a kitty
      </Link>

      {!isConnected && (
        <Card>
          <CardContent>
            <p className="text-sm text-[var(--color-muted)]">
              Open this mini-app inside the Circles playground to see your kitties. The host
              wallet injects your Safe address via <code>onWalletChange</code>.
            </p>
          </CardContent>
        </Card>
      )}

      {isConnected && kitties.length === 0 && (
        <Card>
          <CardContent>
            <p className="text-sm text-[var(--color-muted)]">
              No kitties yet. Create one with two or more friends to start pooling CRC.
            </p>
          </CardContent>
        </Card>
      )}

      {kitties.length > 0 && (
        <section className="flex flex-col gap-3">
          {kitties.map((k) => (
            <KittyCard key={k.governance} kitty={k} />
          ))}
        </section>
      )}

      {/* Dev / sanity-check panel — collapsed by default. */}
      <Card>
        <CardHeader>
          <CardTitle>
            <button
              type="button"
              onClick={() => setDebugOpen((v) => !v)}
              className="flex w-full items-center justify-between text-left text-base"
            >
              <span className="flex items-center gap-2">
                <Wallet className="size-4" /> Host bridge debug
              </span>
              {debugOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          </CardTitle>
          {debugOpen && (
            <CardDescription>
              Validate the iframe → SDK → Safe chain. Useful when debugging the playground.
            </CardDescription>
          )}
        </CardHeader>
        {debugOpen && (
          <CardContent>
            <p className="text-xs text-[var(--color-muted)]">
              iframe host detected: <strong>{String(isMiniappHost)}</strong>
              <br />
              chain id: <strong>{CIRCLES_CONFIG.chainId}</strong>
              <br />
              factory:{' '}
              {CIRCLES_CONFIG.kittyFactoryAddress ? (
                <code>{shortAddress(CIRCLES_CONFIG.kittyFactoryAddress)}</code>
              ) : (
                <span className="text-rose-300">not configured</span>
              )}
            </p>
            <Button onClick={handleSign} disabled={!isConnected || signing} variant="secondary">
              <Signature className="size-4" />
              {signing ? 'Signing…' : 'Sign test message'}
            </Button>
            <Link
              to="/kitty/new"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-surface-hi)] px-4 text-sm text-[var(--color-text)] hover:bg-[var(--color-border)]"
            >
              <Send className="size-4" />
              Try the create-kitty flow
            </Link>
          </CardContent>
        )}
      </Card>
    </main>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { KittyCard } from '@/components/pot/KittyCard';
import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { InviterBanner } from '@/components/pot/InviterBanner';
import { InviteButton } from '@/components/InviteButton';
import { Logo } from '@/components/Logo';
import { useWallet } from '@/hooks/use-wallet';
import { loadKitties } from '@/lib/storage';
import type { KittyRef } from '@/types/kitty';

export default function HomeRoute() {
  const { address, isConnected, isMiniappHost } = useWallet();
  const [kitties, setKitties] = useState<KittyRef[]>([]);

  useEffect(() => {
    if (!address) {
      setKitties([]);
      return;
    }
    setKitties(loadKitties(address));
  }, [address]);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Logo size={42} className="mt-1" />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              The Kitty
            </p>
            <h1 className="text-2xl font-semibold leading-tight">Your tontines</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              On-chain rotating savings, no organizer needed.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && address ? (
            <>
              <InviteButton variant="pill" />
              <MemberAvatar address={address} size="sm" />
            </>
          ) : (
            <Badge tone="neutral">{isMiniappHost ? 'Waiting…' : 'Standalone'}</Badge>
          )}
        </div>
      </header>

      <InviterBanner selfAddress={address} />

      <Link
        to="/kitty/new"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-fg)] shadow-[0_10px_28px_-12px_var(--color-shadow)] hover:brightness-110"
      >
        <Plus className="size-4" /> Start a tontine
      </Link>

      {!isConnected && (
        <Card>
          <CardContent>
            <p className="text-sm text-[var(--color-muted)]">
              Open this mini-app inside the Circles host to see your kitties — the host wallet
              injects your Safe address.
            </p>
          </CardContent>
        </Card>
      )}

      {isConnected && kitties.length === 0 && (
        <Card>
          <CardContent>
            <p className="text-sm text-[var(--color-muted)]">
              No tontines yet. Gather 2+ Circles humans you trust, set a contribution and a
              round length, and the rotation runs itself — no organizer holds the pot.
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
    </main>
  );
}

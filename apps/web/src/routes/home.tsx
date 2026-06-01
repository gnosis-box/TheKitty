import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCw, Users } from 'lucide-react';

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

  // Pick the header copy based on what the user actually has. If they only
  // have tontines (or none yet), the tontine framing is correct. If they
  // have any free-pot kitties too, fall back to the broader "kitties" label.
  const { headerTitle, headerSubtitle, emptyCopy } = useMemo(() => {
    const hasFree = kitties.some((k) => (k.mode ?? 'free') === 'free');
    if (hasFree) {
      return {
        headerTitle: 'Your kitties',
        headerSubtitle: 'Rotating tontines + free group pots, on Circles.',
        emptyCopy:
          'No kitties yet. Start a rotating tontine, or a free-form group pot.',
      };
    }
    return {
      headerTitle: 'Your tontines',
      headerSubtitle: 'On-chain rotating savings, no organizer needed.',
      emptyCopy:
        'No tontines yet. Gather 2+ Circles humans you trust, set a contribution and a round length, and the rotation runs itself — no organizer holds the pot.',
    };
  }, [kitties]);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Logo size={42} className="mt-1" />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              The Kitty
            </p>
            <h1 className="text-2xl font-semibold leading-tight">{headerTitle}</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{headerSubtitle}</p>
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

      <div className="flex flex-col gap-2">
        <Link
          to="/kitty/new?mode=tontine"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-fg)] shadow-[0_10px_28px_-12px_var(--color-shadow)] hover:brightness-110"
        >
          <RotateCw className="size-4" /> Start a tontine
        </Link>
        <Link
          to="/kitty/new?mode=free"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hi)] text-sm text-[var(--color-text)] hover:bg-[var(--color-border)]"
        >
          <Users className="size-3.5" /> Or a group pot
        </Link>
      </div>

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
            <p className="text-sm text-[var(--color-muted)]">{emptyCopy}</p>
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

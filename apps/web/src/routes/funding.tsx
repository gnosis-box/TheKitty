import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCw, Users } from 'lucide-react';

import { AppFooter } from '@/components/AppFooter';
import { BurgerButton } from '@/components/BurgerButton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { InviteButton } from '@/components/InviteButton';
import { InviterBanner } from '@/components/pot/InviterBanner';
import { KittyCard } from '@/components/pot/KittyCard';
import { Logo } from '@/components/Logo';
import { MainTabs } from '@/components/MainTabs';
import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { OpenInPlayground } from '@/components/OpenInPlayground';
import { PublicStats } from '@/components/pot/PublicStats';
import { useWallet } from '@/hooks/use-wallet';
import { discoverKittiesForMember, mergeDiscoveredKitties } from '@/lib/discover-kitties';
import { loadKitties, saveKitty } from '@/lib/storage';
import type { KittyRef } from '@/types/kitty';

/// The funding tab — lists the kitties the viewer belongs to (tontines and
/// group pots) and offers the CTAs to start new ones. The actual spending
/// happens on the Services tab; this surface is purely the cash-flow tool.
export default function FundingRoute() {
  const { address, isConnected, isMiniappHost } = useWallet();
  const [kitties, setKitties] = useState<KittyRef[]>([]);

  useEffect(() => {
    if (!address) {
      setKitties([]);
      return;
    }
    const local = loadKitties(address);
    setKitties(local);

    let cancelled = false;
    (async () => {
      try {
        const discovered = await discoverKittiesForMember(address);
        if (cancelled || discovered.length === 0) return;
        const merged = mergeDiscoveredKitties(local, discovered);
        if (merged.length === local.length) return;
        for (const k of merged.slice(local.length)) {
          saveKitty(address, k);
        }
        setKitties(merged);
      } catch {
        // ignore — local cache is still valid
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const { headerTitle, headerSubtitle, emptyCopy } = useMemo(() => {
    const hasFree = kitties.some((k) => (k.mode ?? 'free') === 'free');
    if (hasFree) {
      return {
        headerTitle: 'Your kitties',
        headerSubtitle: 'Pool CRC in a tontine or group pot.',
        emptyCopy:
          'No kitties yet. Start a tontine or open a group pot with people you trust.',
      };
    }
    return {
      headerTitle: 'Your tontines',
      headerSubtitle: 'Pool CRC in a tontine or group pot.',
      emptyCopy:
        'No tontines yet. Pick 2+ Circles members, set a contribution, and one of you gets the pot each round.',
    };
  }, [kitties]);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <BurgerButton />
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

      <MainTabs />

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

      <PublicStats />

      {!isConnected && (
        <Card>
          <CardContent>
            <p className="text-sm text-[var(--color-muted)]">
              The Kitty needs the Circles host to inject your Circles wallet — open this URL
              inside the official playground to start.
            </p>
            <div className="mt-3">
              <OpenInPlayground />
            </div>
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

      <AppFooter />
    </main>
  );
}

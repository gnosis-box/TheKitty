import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useKitty } from '@/hooks/use-kitty';
import { useWallet } from '@/hooks/use-wallet';
import { CIRCLES_CONFIG } from '@/lib/circles-config';
import { saveKitty } from '@/lib/storage';
import { buildTrustTx } from '@/lib/tx-builders';
import { shortAddress } from '@/lib/utils';
import type { Address, KittyRef } from '@/types/kitty';

/// Landing page for an invite link of the form `/kitty/:id/join` (typically
/// shared after the creator has spun up a kitty). Surfaces a single CTA that
/// bundles the `Hub.trust(group)` opt-in the recipient needs before they can
/// deposit. After the tx confirms we route to the kitty detail view.
///
/// The contract's member set is fixed at creation. If the visitor is NOT in
/// `state.members`, we surface that explicitly instead of letting them sign a
/// trust tx that would unblock nothing.
export default function KittyJoinRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address, isConnected, sendTransactions } = useWallet();

  const governance = (id ?? '') as Address;
  const { state, loading, error } = useKitty(governance);
  const [signing, setSigning] = useState(false);

  const isMember =
    state != null &&
    address != null &&
    state.members.some((m) => m.toLowerCase() === address.toLowerCase());

  async function onJoin() {
    if (!state || !address) return;
    setSigning(true);
    try {
      toast.loading('Opening trust…', { id: 'kitty-join' });
      const [txHash] = await sendTransactions([buildTrustTx({ trustee: state.groupAvatar })]);
      if (!txHash) throw new Error('Host returned no tx hash');

      // Save to the joiner's localStorage so their home lists this kitty
      // alongside ones they created themselves. The kitty IS on-chain — this
      // cache is just the front-end's index for fast home rendering.
      const ref: KittyRef = {
        governance,
        groupAvatar: state.groupAvatar,
        name: `Kitty ${shortAddress(governance)}`,
        symbol: state.tontine.enabled ? 'TON' : 'POT',
        members: [...state.members],
        quorumPercent: state.quorumPercent,
        smallTxThreshold: state.smallTxThreshold.toString(),
        votingPeriod: state.votingPeriod,
        createdAt: Math.floor(Date.now() / 1000),
        chainId: CIRCLES_CONFIG.chainId,
        mode: state.tontine.enabled ? 'tontine' : 'free',
        ...(state.tontine.enabled
          ? {
              roundContribution: state.tontine.roundContribution.toString(),
              roundDuration: state.tontine.roundDuration,
            }
          : {}),
      };
      saveKitty(address, ref);

      toast.success("You're in ✓", { id: 'kitty-join' });
      navigate(`/kitty/${governance}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join', { id: 'kitty-join' });
    } finally {
      setSigning(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          aria-label="Back"
          className="px-2"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Invite</p>
          <h1 className="text-2xl font-semibold leading-tight">Join the kitty</h1>
        </div>
      </header>

      {error && (
        <Card className="border-rose-500/40 bg-rose-500/5">
          <CardContent>
            <p className="text-sm text-rose-700">{error.message}</p>
          </CardContent>
        </Card>
      )}

      {!state && loading && <JoinSkeleton />}

      {state && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4" /> {state.tontine.enabled ? 'Tontine' : 'Group pot'}
              </CardTitle>
              <CardDescription>
                {state.tontine.enabled
                  ? `Rotating savings, ${state.members.length} members.`
                  : `Shared treasury, quorum ${state.quorumPercent}%.`}{' '}
                One signature to opt in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                  Members
                </p>
                {state.members.map((m) => (
                  <div
                    key={m}
                    className="flex items-center gap-2 rounded-md bg-[var(--color-surface-hi)] px-2 py-1"
                  >
                    <MemberAvatar address={m} size="sm" selfAddress={address} />
                    {address && m.toLowerCase() === address.toLowerCase() && (
                      <Badge tone="accent">you</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {!isConnected && (
            <Card>
              <CardContent>
                <p className="text-sm text-[var(--color-muted)]">
                  Open this app inside the Circles host to opt in — the host wallet injects
                  your Circles address.
                </p>
              </CardContent>
            </Card>
          )}

          {isConnected && !isMember && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent>
                <p className="text-sm text-amber-900">
                  You're not on this kitty's member list. Ask the creator to add you to a new
                  one — the member set is locked at creation time.
                </p>
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  Signed in as <span className="font-mono">{shortAddress(address)}</span>
                </p>
              </CardContent>
            </Card>
          )}

          {isConnected && isMember && (
            <>
              <Button type="button" size="lg" onClick={onJoin} disabled={signing}>
                {signing ? 'Opening trust…' : 'Opt in · 1 signature'}
              </Button>
              <p className="text-center text-xs text-[var(--color-muted)]">
                Signs <code>Hub.trust(group)</code> from your Circles wallet so the kitty can
                pull your CRC into the pool when you deposit.
              </p>
            </>
          )}
        </>
      )}
    </main>
  );
}

function JoinSkeleton() {
  return (
    <>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-2 h-3 w-48" />
        </CardHeader>
        <CardContent>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 rounded-md" />
          ))}
        </CardContent>
      </Card>
      <Skeleton className="h-12 rounded-xl" />
    </>
  );
}

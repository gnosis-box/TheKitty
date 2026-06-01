import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Check,
  Clock,
  ExternalLink,
  PiggyBank,
  RefreshCw,
  Send,
  Trophy,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { ProposalCard } from '@/components/pot/ProposalCard';
import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { HistoryList } from '@/components/pot/HistoryList';
import { InviteButton } from '@/components/InviteButton';
import { useHistory } from '@/hooks/use-history';
import { useWallet } from '@/hooks/use-wallet';
import { useKitty } from '@/hooks/use-kitty';
import { buildClaimRoundTx } from '@/lib/tx-builders';
import type { TontineState } from '@/lib/kitty-reader';
import { formatCrc, shortAddress } from '@/lib/utils';
import type { Address, ProposalView } from '@/types/kitty';

export default function KittyDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address } = useWallet();

  const governance = (id ?? '') as Address;
  const { state, loading, error, refresh } = useKitty(governance);
  const { entries: history, loading: historyLoading, refresh: refreshHistory } = useHistory(
    governance,
  );

  const proposalsById = useMemo(() => {
    const map = new Map<string, ProposalView>();
    state?.proposals.forEach((p) => map.set(p.id.toString(), p));
    return map;
  }, [state?.proposals]);

  function refreshAll() {
    void refresh();
    void refreshHistory();
  }

  if (!id) {
    return (
      <main className="mx-auto max-w-md px-5 py-12 text-center text-sm text-[var(--color-muted)]">
        Missing kitty id.
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 py-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
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
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Kitty
            </p>
            <h1 className="font-mono text-base">{shortAddress(governance)}</h1>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <InviteButton variant="pill" joinKitty={governance} label="Invite to this kitty" />
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshAll}
            aria-label="Refresh"
            className="px-2"
            disabled={loading || historyLoading}
          >
            <RefreshCw
              className={loading || historyLoading ? 'size-4 animate-spin' : 'size-4'}
            />
          </Button>
        </div>
      </header>

      {error && (
        <Card className="border-rose-500/40 bg-rose-500/5">
          <CardContent>
            <p className="text-sm text-rose-700">{error.message}</p>
          </CardContent>
        </Card>
      )}

      {state && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="size-4" /> Pool
              </CardTitle>
              <CardDescription>
                {state.tontine.enabled
                  ? 'Rotating savings pool (ROSCA). Each round one member claims the full pot.'
                  : 'Shared pool custodied by the governance contract.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="Current pool" value={`${formatCrc(state.potBalance)} CRC`} />
                <Stat label="Total deposited" value={`${formatCrc(state.totalDeposited)} CRC`} />
                <Stat label="Members" value={String(state.members.length)} />
                <Stat label="Quorum" value={`${state.quorumPercent}%`} />
                <Stat label="Small cap" value={`${formatCrc(state.smallTxThreshold)} CRC`} />
                <Stat
                  label="Voting"
                  value={`${Math.round(state.votingPeriod / 3600)}h`}
                />
              </div>
            </CardContent>
          </Card>

          {state.tontine.enabled && (
            <TontineCard
              governance={governance}
              tontine={state.tontine}
              members={state.members}
              selfAddress={address}
              onClaimed={refreshAll}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <Link
              to={`/kitty/${governance}/deposit`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:brightness-110"
            >
              <PiggyBank className="size-4" /> Deposit
            </Link>
            <Link
              to={`/kitty/${governance}/propose`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-surface-hi)] text-[var(--color-text)] hover:bg-[var(--color-border)]"
            >
              <Send className="size-4" /> Spend
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Members & deposits</CardTitle>
            </CardHeader>
            <CardContent>
              {state.members.map((m) => (
                <div
                  key={m}
                  className="flex items-center gap-3 rounded-lg bg-[var(--color-surface-hi)] px-3 py-2"
                >
                  <MemberAvatar address={m} size="sm" selfAddress={address} className="flex-1" />
                  <span className="shrink-0 font-mono text-xs text-[var(--color-muted)]">
                    {formatCrc(state.deposits[m.toLowerCase()] ?? 0n)} CRC
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Tabs
            defaultValue="proposals"
            options={[
              {
                value: 'proposals',
                label: `Proposals (${state.proposals.filter((p) => !p.executed).length})`,
              },
              { value: 'history', label: `History (${history.length})` },
            ]}
          >
            {(active) =>
              active === 'proposals' ? (
                <ProposalsPane
                  governance={governance}
                  proposals={state.proposals}
                  memberCount={state.members.length}
                  quorumPercent={state.quorumPercent}
                  onChanged={refreshAll}
                />
              ) : (
                <HistoryList
                  entries={history}
                  proposalsById={proposalsById}
                  loading={historyLoading}
                />
              )
            }
          </Tabs>

          <Card>
            <CardContent>
              <p className="text-xs text-[var(--color-muted)]">
                Group avatar:
                <a
                  href={`https://gnosisscan.io/address/${state.groupAvatar}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1 inline-flex items-center gap-1 font-mono hover:text-[var(--color-text)]"
                >
                  {shortAddress(state.groupAvatar)} <ExternalLink className="size-3" />
                </a>
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {!state && loading && !error && <KittyDetailSkeleton />}

      {!state && !loading && !error && (
        <Card>
          <CardContent>
            <p className="text-sm text-[var(--color-muted)]">
              No data — confirm this governance address is correct.
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function KittyDetailSkeleton() {
  return (
    <>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-2 h-3 w-56" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-[var(--color-surface-hi)] px-3 py-2">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function ProposalsPane({
  governance,
  proposals,
  memberCount,
  quorumPercent,
  onChanged,
}: {
  governance: Address;
  proposals: ProposalView[];
  memberCount: number;
  quorumPercent: number;
  onChanged: () => void;
}) {
  const active = proposals.filter((p) => !p.executed && p.deadline * 1000 > Date.now());
  if (active.length === 0) {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--color-muted)]">
              No active proposals. Open a vote for anything above the small-spend cap.
            </p>
            <Link
              to={`/kitty/${governance}/propose`}
              className="shrink-0 text-xs text-[color-mix(in_oklab,var(--color-accent),black_10%)] hover:underline"
            >
              + new
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Link
          to={`/kitty/${governance}/propose`}
          className="text-xs text-[color-mix(in_oklab,var(--color-accent),black_10%)] hover:underline"
        >
          + new
        </Link>
      </div>
      {[...active].reverse().map((p) => (
        <ProposalCard
          key={p.id.toString()}
          governance={governance}
          proposal={p}
          memberCount={memberCount}
          quorumPercent={quorumPercent}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-surface-hi)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">{label}</p>
      <p className="font-mono text-base">{value}</p>
    </div>
  );
}

interface TontineCardProps {
  governance: Address;
  tontine: TontineState;
  members: Address[];
  selfAddress: Address | null;
  onClaimed: () => void;
}

function TontineCard({ governance, tontine, members, selfAddress, onClaimed }: TontineCardProps) {
  const { sendTransactions } = useWallet();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [claiming, setClaiming] = useState(false);

  // Re-tick once per second so the countdown stays accurate without a full refresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const ready = now >= tontine.nextClaimAt;
  const isMyTurn =
    selfAddress != null &&
    tontine.currentClaimer.toLowerCase() === selfAddress.toLowerCase();

  async function onClaim() {
    setClaiming(true);
    try {
      toast.loading('Claiming round…', { id: 'tontine-claim' });
      const [txHash] = await sendTransactions([buildClaimRoundTx({ governance })]);
      if (!txHash) throw new Error('Host returned no tx hash');
      toast.success('Round claimed ✓', { id: 'tontine-claim' });
      onClaimed();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Claim failed', {
        id: 'tontine-claim',
      });
    } finally {
      setClaiming(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-4" /> Round {tontine.currentRound + 1}
        </CardTitle>
        <CardDescription>
          {ready ? (
            <span className="inline-flex items-center gap-1.5 text-[color-mix(in_oklab,var(--color-accent),black_20%)]">
              <Check className="size-3.5" /> Ready to claim
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" /> Opens in {formatCountdown(tontine.nextClaimAt - now)}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] bg-[var(--color-surface-hi)] p-3">
          <div className="flex items-center gap-2">
            <MemberAvatar
              address={tontine.currentClaimer}
              size="sm"
              selfAddress={selfAddress}
            />
            {isMyTurn && <Badge tone="accent">your turn</Badge>}
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              Payout
            </p>
            <p className="font-mono text-base">{formatCrc(tontine.roundPayout)} CRC</p>
          </div>
        </div>

        {isMyTurn && (
          <Button
            type="button"
            size="lg"
            onClick={onClaim}
            disabled={!ready || claiming}
            className="w-full"
          >
            {claiming
              ? 'Claiming…'
              : ready
              ? `Claim ${formatCrc(tontine.roundPayout)} CRC`
              : `Opens in ${formatCountdown(tontine.nextClaimAt - now)}`}
          </Button>
        )}

        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
            Rotation order
          </p>
          {members.map((m, idx) => {
            const cyclePos = idx - (tontine.currentRound % members.length);
            const isPast = cyclePos < 0;
            const isCurrent = cyclePos === 0;
            return (
              <div
                key={m}
                className={
                  'flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm ' +
                  (isCurrent
                    ? 'bg-[var(--color-accent-soft)]'
                    : isPast
                    ? 'text-[var(--color-muted)]'
                    : '')
                }
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 text-center text-xs font-mono text-[var(--color-muted)]">
                    {idx + 1}
                  </span>
                  <MemberAvatar
                    address={m}
                    size="sm"
                    selfAddress={selfAddress}
                  />
                </div>
                {isCurrent && <Badge tone="accent">now</Badge>}
                {isPast && <Check className="size-3.5 text-[var(--color-muted)]" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'now';
  const days = Math.floor(seconds / 86400);
  if (days > 0) return `${days}d ${Math.floor((seconds % 86400) / 3600)}h`;
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

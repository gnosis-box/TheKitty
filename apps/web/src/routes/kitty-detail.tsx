import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, PiggyBank, Send, Sparkles, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { ProposalCard } from '@/components/pot/ProposalCard';
import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { HistoryList } from '@/components/pot/HistoryList';
import { useHistory } from '@/hooks/use-history';
import { useWallet } from '@/hooks/use-wallet';
import { useKitty } from '@/hooks/use-kitty';
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
                Pot tokens custodied by the governance contract.
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
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4" /> Saved from decay
              </CardTitle>
              <CardDescription>
                Personal CRC loses ~7%/yr when it sits still. This is what the kitty kept alive
                by keeping the money in motion.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-2xl">
                +{formatCrc(estimateDecaySaved(state.totalDeposited))} CRC
              </p>
            </CardContent>
          </Card>

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

/// Placeholder decay calculation. Circles' demurrage shrinks idle CRC by
/// ~7%/yr. Real version (Phase 4 polish) compares the kitty's actual balance
/// trajectory against the "everyone kept it in their own wallet" counterfactual.
/// For now, return ~7%/yr prorated over a 30-day window — indicative only.
function estimateDecaySaved(totalDeposited: bigint): bigint {
  // (totalDeposited * 0.07 / 12) — one month at 7%/yr.
  return (totalDeposited * 7n) / 1200n;
}

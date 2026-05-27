import { useState } from 'react';
import { toast } from 'sonner';
import { Check, ExternalLink, PartyPopper } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { useWallet } from '@/hooks/use-wallet';
import { readHasVoted, nextApproveMeetsQuorum, proposalReady } from '@/lib/kitty-reader';
import { buildApproveTx, buildExecuteTx } from '@/lib/tx-builders';
import { formatCrc, relativeTime } from '@/lib/utils';
import type { Address, ProposalView } from '@/types/kitty';

interface Props {
  governance: Address;
  proposal: ProposalView;
  memberCount: number;
  quorumPercent: number;
  onChanged: () => void;
}

export function ProposalCard({
  governance,
  proposal,
  memberCount,
  quorumPercent,
  onChanged,
}: Props) {
  const { address, sendTransactions } = useWallet();
  const [busy, setBusy] = useState<null | 'approve' | 'execute'>(null);

  const expired = !proposal.executed && proposal.deadline * 1000 < Date.now();
  const isReady = proposalReady(proposal, memberCount, quorumPercent);
  const isMine = address && address.toLowerCase() === proposal.proposer.toLowerCase();

  const status: { label: string; tone: 'success' | 'accent' | 'danger' | 'neutral' } =
    proposal.executed
      ? { label: 'Executed', tone: 'success' }
      : expired
        ? { label: 'Expired', tone: 'danger' }
        : isReady
          ? { label: 'Quorum reached', tone: 'accent' }
          : { label: 'Voting', tone: 'neutral' };

  async function handleApprove() {
    if (!address) return;
    setBusy('approve');
    try {
      const alreadyVoted = await readHasVoted({
        governance,
        proposalId: proposal.id,
        member: address,
      });
      if (alreadyVoted) {
        toast.error('You already approved this proposal.');
        return;
      }

      const txs = [buildApproveTx({ governance, proposalId: proposal.id })];
      // If our vote completes the quorum, bundle the execute() right after.
      if (nextApproveMeetsQuorum(proposal, memberCount, quorumPercent)) {
        txs.push(buildExecuteTx({ governance, proposalId: proposal.id }));
      }

      toast.loading('Submitting…', { id: `prop-${proposal.id}` });
      const hashes = await sendTransactions(txs);
      toast.success(
        txs.length === 2
          ? `Approved & executed ✓ ${hashes[hashes.length - 1]?.slice(0, 10)}…`
          : `Approved ✓ ${hashes[0]?.slice(0, 10)}…`,
        { id: `prop-${proposal.id}` },
      );
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approve failed', {
        id: `prop-${proposal.id}`,
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleExecute() {
    if (!address) return;
    setBusy('execute');
    try {
      toast.loading('Executing…', { id: `prop-${proposal.id}` });
      const [hash] = await sendTransactions([
        buildExecuteTx({ governance, proposalId: proposal.id }),
      ]);
      toast.success(`Executed ✓ ${hash?.slice(0, 10)}…`, { id: `prop-${proposal.id}` });
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Execute failed', {
        id: `prop-${proposal.id}`,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-base">{proposal.memo || 'Untitled proposal'}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-[var(--color-surface-hi)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              Amount
            </p>
            <p className="font-mono">{formatCrc(proposal.amount)} CRC</p>
          </div>
          <div className="rounded-lg bg-[var(--color-surface-hi)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              Votes
            </p>
            <p className="font-mono">
              {proposal.approvals} / {memberCount}{' '}
              <span className="text-[var(--color-muted)]">
                (need {Math.ceil((memberCount * quorumPercent) / 100)})
              </span>
            </p>
          </div>
          <div className="rounded-lg bg-[var(--color-surface-hi)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              To
            </p>
            <MemberAvatar address={proposal.recipient} size="xs" />
          </div>
          <div className="rounded-lg bg-[var(--color-surface-hi)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              Deadline
            </p>
            <p className="text-xs">{relativeTime(proposal.deadline)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <span>Proposed by</span>
          <MemberAvatar address={proposal.proposer} size="xs" />
          {isMine && (
            <Badge tone="accent" className="ml-auto">
              you
            </Badge>
          )}
        </div>

        {!proposal.executed && !expired && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={busy !== null}
              className="flex-1"
            >
              <Check className="size-4" />
              {busy === 'approve' ? 'Approving…' : 'Approve'}
            </Button>
            {isReady && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleExecute}
                disabled={busy !== null}
                className="flex-1"
              >
                <PartyPopper className="size-4" />
                {busy === 'execute' ? 'Executing…' : 'Execute'}
              </Button>
            )}
          </div>
        )}

        <a
          href={`https://gnosisscan.io/address/${governance}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
        >
          View governance on GnosisScan <ExternalLink className="size-3" />
        </a>
      </CardContent>
    </Card>
  );
}

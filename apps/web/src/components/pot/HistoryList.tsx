import { ExternalLink, PartyPopper, Zap } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { MemberAvatar } from '@/components/pot/MemberAvatar';
import type { HistoryEntry } from '@/lib/kitty-history';
import { formatCrc } from '@/lib/utils';
import type { ProposalView } from '@/types/kitty';

interface Props {
  entries: HistoryEntry[];
  /// Existing proposals from the same kitty — used to resolve memos for
  /// `executed` entries (the Executed event doesn't carry the memo).
  proposalsById?: Map<string, ProposalView>;
  loading?: boolean;
}

export function HistoryList({ entries, proposalsById, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-[var(--color-muted)]">Loading history…</p>
        </CardContent>
      </Card>
    );
  }
  if (entries.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-[var(--color-muted)]">
            Nothing spent yet. The kitty is fresh.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((e) => {
        const isExec = e.kind === 'executed';
        const memo =
          e.memo || (e.proposalId !== undefined
            ? proposalsById?.get(e.proposalId.toString())?.memo
            : undefined) ||
          (isExec ? 'Group vote settled' : 'Direct pay');

        return (
          <Card key={`${e.txHash}-${e.kind}`}>
            <CardContent>
              <div className="flex items-start gap-3">
                <div
                  className={
                    isExec
                      ? 'flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)]'
                      : 'flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100'
                  }
                >
                  {isExec ? (
                    <PartyPopper className="size-4 text-[var(--color-accent)]" />
                  ) : (
                    <Zap className="size-4 text-emerald-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{memo}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-muted)]">
                    <span>to</span>
                    <MemberAvatar address={e.recipient} size="xs" />
                  </div>
                  {e.kind === 'small-spend' && e.by && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-muted)]">
                      <span>paid by</span>
                      <MemberAvatar address={e.by} size="xs" />
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-mono text-sm font-semibold">
                    −{formatCrc(e.amount)} CRC
                  </span>
                  <a
                    href={`https://gnosisscan.io/tx/${e.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--color-muted)] hover:text-[var(--color-text)]"
                    aria-label="View tx"
                  >
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

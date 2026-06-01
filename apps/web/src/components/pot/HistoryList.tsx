import { ExternalLink, PartyPopper, Trophy, Zap } from 'lucide-react';

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
            No payouts yet. Past rounds and spends will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((e) => {
        const meta = describeEntry(e, proposalsById);

        return (
          <Card key={`${e.txHash}-${e.kind}`}>
            <CardContent>
              <div className="flex items-start gap-3">
                <div
                  className={
                    'flex size-9 shrink-0 items-center justify-center rounded-full ' +
                    meta.iconBg
                  }
                >
                  {meta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{meta.title}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-muted)]">
                    <span>{meta.recipientLabel}</span>
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
                    {meta.amountPrefix}
                    {formatCrc(e.amount)} CRC
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

interface EntryMeta {
  title: string;
  icon: JSX.Element;
  iconBg: string;
  recipientLabel: string;
  amountPrefix: string;
}

function describeEntry(
  e: HistoryEntry,
  proposalsById: Map<string, ProposalView> | undefined,
): EntryMeta {
  if (e.kind === 'round-claimed') {
    return {
      title: `Round ${Number(e.round ?? 0) + 1} claimed`,
      icon: <Trophy className="size-4 text-[var(--color-accent)]" />,
      iconBg: 'bg-[var(--color-accent-soft)]',
      recipientLabel: 'paid to',
      amountPrefix: '',
    };
  }
  if (e.kind === 'executed') {
    const memo =
      e.memo ||
      (e.proposalId !== undefined
        ? proposalsById?.get(e.proposalId.toString())?.memo
        : undefined) ||
      'Group vote settled';
    return {
      title: memo,
      icon: <PartyPopper className="size-4 text-[var(--color-accent)]" />,
      iconBg: 'bg-[var(--color-accent-soft)]',
      recipientLabel: 'to',
      amountPrefix: '−',
    };
  }
  // small-spend
  return {
    title: e.memo || 'Direct pay',
    icon: <Zap className="size-4 text-emerald-600" />,
    iconBg: 'bg-emerald-100',
    recipientLabel: 'to',
    amountPrefix: '−',
  };
}

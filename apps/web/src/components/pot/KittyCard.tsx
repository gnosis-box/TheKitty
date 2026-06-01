import { Link } from 'react-router-dom';
import { ArrowUpRight, Network, RotateCw, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { formatCrc, shortAddress } from '@/lib/utils';
import type { KittyRef } from '@/types/kitty';

interface Props {
  kitty: KittyRef;
  /// How many of the kitty's members the viewing wallet already trusts via
  /// Circles V2 Hub. When undefined the line is omitted (still loading or no
  /// viewer). When zero we still hide it — surfacing "0 in your trust graph"
  /// would feel like a downer instead of a signal.
  trustedCount?: number;
}

export function KittyCard({ kitty, trustedCount }: Props) {
  const mode = kitty.mode ?? 'free';
  const isTontine = mode === 'tontine';

  // Tontine metadata is round contribution. Free-pot metadata is quorum.
  // Members count is shared across both.
  let detail: string;
  if (isTontine && kitty.roundContribution) {
    try {
      detail = `${kitty.members.length} members · ${formatCrc(BigInt(kitty.roundContribution))} CRC / round`;
    } catch {
      detail = `${kitty.members.length} members`;
    }
  } else if (isTontine) {
    detail = `${kitty.members.length} members · rotating`;
  } else {
    detail = `${kitty.members.length} members · quorum ${kitty.quorumPercent}%`;
  }

  return (
    <Link
      to={`/kitty/${kitty.governance}`}
      className="group flex items-center justify-between rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:bg-[var(--color-surface-hi)]"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">{kitty.name}</h3>
          <Badge tone={isTontine ? 'accent' : 'neutral'}>
            {isTontine ? (
              <>
                <RotateCw className="size-3" />
                tontine
              </>
            ) : (
              <>
                <Users className="size-3" />
                group pot
              </>
            )}
          </Badge>
        </div>
        <p className="font-mono text-xs text-[var(--color-muted)]">
          {shortAddress(kitty.governance)}
        </p>
        <p className="text-xs text-[var(--color-muted)]">{detail}</p>
        {typeof trustedCount === 'number' && trustedCount > 0 && (
          <p className="inline-flex items-center gap-1 text-xs text-[color-mix(in_oklab,var(--color-accent),black_20%)]">
            <Network className="size-3" />
            {trustedCount} in your trust graph
          </p>
        )}
      </div>
      <ArrowUpRight className="size-4 text-[var(--color-muted)] transition-colors group-hover:text-[var(--color-text)]" />
    </Link>
  );
}

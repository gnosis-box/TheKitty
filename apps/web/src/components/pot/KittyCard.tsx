import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { shortAddress } from '@/lib/utils';
import type { KittyRef } from '@/types/kitty';

export function KittyCard({ kitty }: { kitty: KittyRef }) {
  return (
    <Link
      to={`/kitty/${kitty.governance}`}
      className="group flex items-center justify-between rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:bg-[var(--color-surface-hi)]"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">{kitty.name}</h3>
          <Badge tone="neutral">{kitty.symbol}</Badge>
        </div>
        <p className="font-mono text-xs text-[var(--color-muted)]">
          {shortAddress(kitty.governance)}
        </p>
        <p className="text-xs text-[var(--color-muted)]">
          {kitty.members.length} members · quorum {kitty.quorumPercent}%
        </p>
      </div>
      <ArrowUpRight className="size-4 text-[var(--color-muted)] transition-colors group-hover:text-[var(--color-text)]" />
    </Link>
  );
}

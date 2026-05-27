import { useState } from 'react';

import { useProfile } from '@/hooks/use-profile';
import { cn, shortAddress } from '@/lib/utils';
import type { Address } from '@/types/kitty';

interface Props {
  address: Address;
  size?: 'xs' | 'sm' | 'md';
  /// Show "you" badge when the address matches.
  selfAddress?: Address | null;
  className?: string;
}

const SIZE_CLASSES = {
  xs: 'size-5',
  sm: 'size-7',
  md: 'size-9',
} as const;

const FALLBACK_PALETTE = [
  'bg-rose-500/30',
  'bg-amber-500/30',
  'bg-emerald-500/30',
  'bg-sky-500/30',
  'bg-violet-500/30',
  'bg-fuchsia-500/30',
];

function colorFor(address: Address): string {
  // Deterministic per-address tint so each member's fallback avatar
  // stays the same across renders.
  let acc = 0;
  for (let i = 2; i < address.length; i++) {
    acc = (acc + address.charCodeAt(i)) % FALLBACK_PALETTE.length;
  }
  return FALLBACK_PALETTE[acc];
}

export function MemberAvatar({ address, size = 'md', selfAddress, className }: Props) {
  const profile = useProfile(address);
  const [imgError, setImgError] = useState(false);

  const img = !imgError ? (profile.previewImageUrl || profile.imageUrl) : undefined;
  const initial = (profile.name?.[0] ?? address[2]).toUpperCase();
  const isSelf = selfAddress && selfAddress.toLowerCase() === address.toLowerCase();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          SIZE_CLASSES[size],
          'shrink-0 overflow-hidden rounded-full ring-1 ring-[var(--color-border)] flex items-center justify-center',
          !img && colorFor(address),
        )}
      >
        {img ? (
          <img
            src={img}
            alt=""
            className="size-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-xs font-semibold text-[var(--color-text)]">{initial}</span>
        )}
      </div>
      <div className="min-w-0 flex flex-col leading-tight">
        <span
          className={cn(
            'truncate',
            profile.name ? 'text-sm' : 'font-mono text-xs',
          )}
        >
          {profile.name ?? shortAddress(address)}
        </span>
        {profile.name && (
          <span className="truncate font-mono text-[10px] text-[var(--color-muted)]">
            {shortAddress(address)}
          </span>
        )}
      </div>
      {isSelf && (
        <span className="ml-auto rounded-full bg-[var(--color-accent)]/15 px-2 py-0.5 text-[10px] font-medium text-[color-mix(in_oklab,var(--color-accent),white_25%)]">
          you
        </span>
      )}
    </div>
  );
}

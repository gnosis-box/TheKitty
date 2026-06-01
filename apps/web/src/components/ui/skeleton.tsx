import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/// Lightweight loading placeholder. Tailwind's animate-pulse gives a subtle
/// breathing effect; use the `bg-` token of the parent surface so the
/// skeleton blends in rather than jumping into focus.
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-[var(--color-border)]/60', className)}
      {...props}
    />
  );
}

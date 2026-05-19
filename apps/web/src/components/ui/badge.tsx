import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-[var(--color-surface-hi)] text-[var(--color-text)]',
        success: 'bg-emerald-500/15 text-emerald-300',
        danger: 'bg-rose-500/15 text-rose-300',
        accent: 'bg-[var(--color-accent)]/15 text-[color-mix(in_oklab,var(--color-accent),white_15%)]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TabsProps {
  defaultValue: string;
  options: Array<{ value: string; label: ReactNode }>;
  children: (active: string) => ReactNode;
  className?: string;
}

/// Tiny controlled-by-state tab strip. No animation, no Radix, just a row of
/// pills + a render-prop body. Keeps the dependency tree minimal.
export function Tabs({ defaultValue, options, children, className }: TabsProps) {
  const [active, setActive] = useState(defaultValue);
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="inline-flex rounded-full bg-[var(--color-surface-hi)] p-1 self-start">
        {options.map((opt) => {
          const isActive = active === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setActive(opt.value)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[0_2px_8px_-4px_rgba(43,29,18,0.18)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]',
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {children(active)}
    </div>
  );
}

import { Menu } from 'lucide-react';

import { useDrawer } from '@/components/AppDrawer';
import { useActionableCount } from '@/hooks/use-actionable-count';

/// Small icon button that opens the navigation drawer. Drop it at the very
/// left of any route header — it's deliberately neutral so it nests next
/// to the Logo without competing for attention.
///
/// A red dot lights up in the top-right corner when the viewer has any
/// actionable items waiting (services they paid but never rated, in V1).
/// One signal is enough to pull users back; the drawer surfaces the
/// details once they tap.
export function BurgerButton() {
  const { setOpen } = useDrawer();
  const actionable = useActionableCount();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={
        actionable > 0
          ? `Open menu (${actionable} pending action${actionable === 1 ? '' : 's'})`
          : 'Open menu'
      }
      className="relative inline-flex size-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] shadow-sm hover:bg-[var(--color-surface-hi)] hover:text-[var(--color-text)]"
    >
      <Menu className="size-5" />
      {actionable > 0 && (
        <span
          aria-hidden
          className="absolute right-1 top-1 inline-flex size-2.5 items-center justify-center rounded-full bg-rose-500 ring-2 ring-[var(--color-surface)]"
        />
      )}
    </button>
  );
}

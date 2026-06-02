import { Menu } from 'lucide-react';

import { useDrawer } from '@/components/AppDrawer';

/// Small icon button that opens the navigation drawer. Drop it at the very
/// left of any route header — it's deliberately neutral so it nests next
/// to the Logo without competing for attention.
export function BurgerButton() {
  const { setOpen } = useDrawer();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Open menu"
      className="inline-flex size-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] shadow-sm hover:bg-[var(--color-surface-hi)] hover:text-[var(--color-text)]"
    >
      <Menu className="size-5" />
    </button>
  );
}

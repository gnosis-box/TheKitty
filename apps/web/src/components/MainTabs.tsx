import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Store, Wallet } from 'lucide-react';

import { cn } from '@/lib/utils';

/// Top-level segmented control between the two main surfaces of the app:
/// the **Services** directory (default — what users came to buy or sell)
/// and **Funding** (the kitties that bankroll the spending).
/// Rendered at the top of `/services` and `/funding` so a tap on either
/// label swaps routes without unmounting the header above it.
export function MainTabs() {
  const { pathname } = useLocation();
  const active: 'services' | 'funding' = pathname.startsWith('/funding')
    ? 'funding'
    : 'services';

  return (
    <div
      role="tablist"
      className="flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-1 text-sm"
    >
      <TabLink to="/services" label="Services" icon={<Store className="size-4" />} active={active === 'services'} />
      <TabLink to="/funding" label="Funding" icon={<Wallet className="size-4" />} active={active === 'funding'} />
    </div>
  );
}

interface TabLinkProps {
  to: string;
  label: string;
  icon: ReactNode;
  active: boolean;
}

function TabLink({ to, label, icon, active }: TabLinkProps) {
  return (
    <Link
      to={to}
      role="tab"
      aria-selected={active}
      className={cn(
        'flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 transition-colors',
        active
          ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)] shadow-sm'
          : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-hi)] hover:text-[var(--color-text)]',
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

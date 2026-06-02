import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChartBar,
  ExternalLink,
  Info,
  Settings,
  Store,
  Wallet,
  X,
} from 'lucide-react';

import { Logo } from '@/components/Logo';
import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { useWallet } from '@/hooks/use-wallet';
import { shortAddress } from '@/lib/utils';
import type { Address } from '@/types/kitty';

interface DrawerContextValue {
  open: boolean;
  setOpen(open: boolean): void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

/// Provides drawer open/close state to anything mounted under it. Also
/// renders the drawer panel + backdrop so they're available on every route
/// without each one re-mounting them.
export function DrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const value = useMemo(() => ({ open, setOpen }), [open]);

  return (
    <DrawerContext.Provider value={value}>
      {children}
      <AppDrawer />
    </DrawerContext.Provider>
  );
}

/// Hook for the burger button (or any other surface) to control the drawer.
export function useDrawer(): DrawerContextValue {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error('useDrawer must be used inside <DrawerProvider>');
  return ctx;
}

/// The slide-in panel itself + its backdrop. Top-down sections: viewer
/// header (avatar + Circles address), nav links (Services / Funding /
/// Stats / About) with active-route highlight, and an internal footer
/// that mirrors the discreet `<AppFooter>` links for redundancy.
function AppDrawer() {
  const { open, setOpen } = useDrawer();
  const { address, isConnected } = useWallet();
  const close = useCallback(() => setOpen(false), [setOpen]);

  // Lock body scroll while the drawer is open + close on Esc.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={close}
        className={
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ' +
          (open ? 'opacity-100' : 'pointer-events-none opacity-0')
        }
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Main navigation"
        className={
          'fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl transition-transform duration-200 ease-out ' +
          (open ? 'translate-x-0' : '-translate-x-full')
        }
      >
        <header className="flex items-center justify-between px-5 pt-5">
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="text-sm font-semibold">The Kitty</span>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="inline-flex size-8 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-surface-hi)] hover:text-[var(--color-text)]"
          >
            <X className="size-4" />
          </button>
        </header>

        <section className="mt-5 px-5">
          {isConnected && address ? (
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hi)] p-3">
              <MemberAvatar address={address as Address} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                  Connected
                </p>
                <p className="truncate text-sm font-medium">
                  {shortAddress(address as Address)}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hi)] p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted)]">
                Not connected
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Open this URL in the Circles playground to use your wallet.
              </p>
            </div>
          )}
        </section>

        <nav className="mt-5 flex-1 px-3">
          <DrawerLink to="/services" icon={<Store className="size-4" />} label="Services" onSelect={close} />
          <DrawerLink to="/services/mine" icon={<Settings className="size-4" />} label="My services" onSelect={close} />
          <DrawerLink to="/funding" icon={<Wallet className="size-4" />} label="Funding" onSelect={close} />
          <DrawerLink to="/stats" icon={<ChartBar className="size-4" />} label="Stats" onSelect={close} />
          <DrawerLink to="/about" icon={<Info className="size-4" />} label="About" onSelect={close} />
        </nav>

        <footer className="border-t border-[var(--color-border)] px-5 py-4 text-xs text-[var(--color-muted)]">
          <a
            href="https://github.com/gnosis-box/TheKitty"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-[var(--color-text)]"
          >
            <ExternalLink className="size-3" /> Source on GitHub
          </a>
          <p className="mt-2">Built on Circles · Gnosis Chain</p>
        </footer>
      </aside>
    </>
  );
}

interface DrawerLinkProps {
  to: string;
  icon: ReactNode;
  label: string;
  onSelect(): void;
}

function DrawerLink({ to, icon, label, onSelect }: DrawerLinkProps) {
  const { pathname } = useLocation();
  const active =
    pathname === to || (to !== '/' && pathname.startsWith(to + '/'));
  return (
    <Link
      to={to}
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      className={
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ' +
        (active
          ? 'bg-[var(--color-accent)]/15 text-[var(--color-text)]'
          : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-hi)] hover:text-[var(--color-text)]')
      }
    >
      <span
        className={
          'flex size-7 items-center justify-center rounded-lg ' +
          (active
            ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
            : 'bg-[var(--color-surface-hi)]')
        }
      >
        {icon}
      </span>
      {label}
    </Link>
  );
}

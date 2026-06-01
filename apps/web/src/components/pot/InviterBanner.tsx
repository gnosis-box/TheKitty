import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { clearInviter, getInviter } from '@/lib/inviter';
import type { Address } from '@/types/kitty';

/// Renders a single dismissible welcome banner when the user landed on the
/// app with `?via=<address>`. Drops itself once dismissed (per session).
export function InviterBanner({ selfAddress }: { selfAddress?: Address | null }) {
  const [inviter, setInviter] = useState<Address | null>(null);

  useEffect(() => {
    setInviter(getInviter());
  }, []);

  if (!inviter) return null;
  if (selfAddress && selfAddress.toLowerCase() === inviter.toLowerCase()) return null;

  function dismiss() {
    clearInviter();
    setInviter(null);
  }

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-accent-soft)] p-3">
      <MemberAvatar address={inviter} size="sm" className="flex-1" />
      <div className="flex-1 text-sm">
        <p className="font-medium">invited you to The Kitty.</p>
        <p className="text-xs text-[var(--color-muted)]">
          Pre-filled on your next kitty.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="rounded-full p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-hi)] hover:text-[var(--color-text)]"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

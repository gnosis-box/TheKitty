import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Send, X } from 'lucide-react';

import { MemberAvatar } from '@/components/pot/MemberAvatar';
import { clearInviter, getInviter } from '@/lib/inviter';
import { shortAddress } from '@/lib/utils';
import type { Address } from '@/types/kitty';

/// Banner shown when the user landed via a `?via=<inviter>` link. It also
/// surfaces the easiest path back: a "Send my address" button that opens
/// the native share sheet (or copies to clipboard) with the user's own Safe
/// address pre-typed, so they can paste it back to the inviter in Telegram /
/// SMS / Discord. Dismissible per session.
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

  async function shareAddressBack() {
    if (!selfAddress) return;
    const message = `My Circles address for the kitty: ${selfAddress}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text: message });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(selfAddress);
      toast.success('Address copied — paste it back to the inviter');
      return;
    } catch {
      // Last resort: surface the text so the user can copy manually.
      toast.message('Send this to the inviter', {
        description: selfAddress,
        duration: 15000,
      });
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-accent-soft)] p-3">
      <div className="flex items-center gap-3">
        <MemberAvatar address={inviter} size="sm" className="flex-1" />
        <div className="flex-1 text-sm">
          <p className="font-medium">invited you to The Kitty.</p>
          <p className="text-xs text-[var(--color-muted)]">
            They need your Circles address to add you as a member.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="self-start rounded-full p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-hi)] hover:text-[var(--color-text)]"
        >
          <X className="size-4" />
        </button>
      </div>
      {selfAddress && (
        <button
          type="button"
          onClick={shareAddressBack}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] text-sm font-medium text-[var(--color-accent-fg)] hover:brightness-110"
        >
          <Send className="size-4" />
          Send my address back ({shortAddress(selfAddress)})
        </button>
      )}
    </div>
  );
}

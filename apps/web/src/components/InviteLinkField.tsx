import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy } from 'lucide-react';

import { buildInviteLinks } from '@/lib/inviter';
import { useWallet } from '@/hooks/use-wallet';

/// Always-visible companion to <InviteButton>. The button tries the native
/// share sheet first, which is invisible on desktop and unreliable inside
/// iframe playground contexts where `navigator.share` exists but does
/// nothing useful. This field renders the same link as a tap-to-copy
/// surface so the user can always grab it manually, paste it in any chat.
export function InviteLinkField() {
  const { address } = useWallet();
  const [copied, setCopied] = useState(false);

  if (!address) return null;
  if (typeof window === 'undefined') return null;

  const { playground } = buildInviteLinks(address, window.location.origin);

  async function copy() {
    try {
      await navigator.clipboard.writeText(playground);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success('Invite link copied');
    } catch {
      // Clipboard blocked — fall back to a select-all so the user can copy
      // manually with the keyboard.
      const el = document.getElementById('invite-link-field') as HTMLInputElement | null;
      el?.select();
      toast.message('Copy this invite link', {
        description: playground,
        duration: 15000,
      });
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5">
      <input
        id="invite-link-field"
        type="text"
        readOnly
        value={playground}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 bg-transparent px-2 py-1 font-mono text-xs text-[var(--color-text)] outline-none"
      />
      <button
        type="button"
        onClick={copy}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--color-surface-hi)] px-2.5 py-1 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-border)]"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

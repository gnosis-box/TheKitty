import { useState } from 'react';
import { toast } from 'sonner';
import { Share2, Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { buildInviteLinks } from '@/lib/inviter';
import { useWallet } from '@/hooks/use-wallet';

interface Props {
  /// Visual variant: pill button (default) or full-width primary CTA.
  variant?: 'primary' | 'pill' | 'ghost';
  /// Label override.
  label?: string;
}

export function InviteButton({ variant = 'pill', label = 'Invite a friend' }: Props) {
  const { address } = useWallet();
  const [justCopied, setJustCopied] = useState(false);

  if (!address) return null;

  async function handleShare() {
    if (!address) return;
    const { playground } = buildInviteLinks(address, window.location.origin);

    // 1. Native share sheet (best on mobile).
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'The Kitty',
          text: 'Join me on The Kitty — a shared group pot on Circles.',
          url: playground,
        });
        return;
      } catch (err) {
        // User cancel → bail silently. Anything else → fall through.
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    // 2. Modern clipboard API (works in same-origin / when iframe granted
    //    clipboard-write).
    try {
      await navigator.clipboard.writeText(playground);
      flashCopied();
      toast.success('Invite link copied');
      return;
    } catch {
      // fall through
    }

    // 3. Legacy execCommand via a hidden textarea — works inside the
    //    Circles iframe where clipboard-write isn't granted.
    if (legacyCopy(playground)) {
      flashCopied();
      toast.success('Invite link copied');
      return;
    }

    // 4. Last resort: surface the URL so the user can copy manually.
    toast.message('Copy this invite link', {
      description: playground,
      duration: 15000,
    });
  }

  function flashCopied() {
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 1800);
  }

  const Icon = justCopied ? Check : variant === 'pill' ? Share2 : Copy;

  if (variant === 'primary') {
    return (
      <Button onClick={handleShare} size="lg" variant="secondary">
        <Icon className="size-4" />
        {justCopied ? 'Copied!' : label}
      </Button>
    );
  }

  if (variant === 'ghost') {
    return (
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
      >
        <Icon className="size-3.5" />
        {justCopied ? 'Copied' : label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={label}
      className="inline-flex size-9 items-center justify-center rounded-full bg-[var(--color-surface-hi)] text-[var(--color-text)] hover:bg-[var(--color-border)]"
    >
      <Icon className="size-4" />
    </button>
  );
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

import { ExternalLink } from 'lucide-react';

import { useWallet } from '@/hooks/use-wallet';

/// When the app is opened standalone (outside the Circles host iframe), the
/// wallet is never injected and the user can't actually do anything. This
/// button surfaces the right move: re-open the same URL inside the official
/// Circles playground host so the Safe is connected.
///
/// Returns null when already running inside the miniapp host (the button has
/// nothing to do in that case).
export function OpenInPlayground() {
  const { isMiniappHost } = useWallet();
  if (isMiniappHost) return null;
  if (typeof window === 'undefined') return null;

  const here = window.location.origin + window.location.pathname + window.location.search;
  const playgroundUrl = `https://circles.gnosis.io/playground?url=${encodeURIComponent(here)}`;

  return (
    <a
      href={playgroundUrl}
      target="_top"
      rel="noreferrer"
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-4 text-sm font-medium text-[color-mix(in_oklab,var(--color-accent),black_20%)] hover:bg-[var(--color-accent-soft)]/80"
    >
      Open in Circles playground
      <ExternalLink className="size-3.5" />
    </a>
  );
}

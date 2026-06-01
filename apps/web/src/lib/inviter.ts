import type { Address } from '@/types/kitty';
import { isAddress } from 'viem';

// Context tracker for the URL `?via=<safe_address>` param.
// When a referral link is opened, we persist the inviter once per session
// so the welcome banner can render across navigations, and the create-kitty
// form can pre-fill the inviter as the first member.

const STORAGE_KEY = 'kitty.v1.invitedBy';
const QUERY_KEY = 'via';

/// Read the `?via=` param from the current URL, validate it, and persist
/// to sessionStorage. Returns the validated inviter address or null.
/// Strips the param from the URL after capture so refreshes don't re-trigger.
export function captureInviterFromUrl(): Address | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const raw = url.searchParams.get(QUERY_KEY);
  if (!raw) return null;
  if (!isAddress(raw)) return null;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Quota or privacy mode — ignore, the value is still usable for this load.
  }

  url.searchParams.delete(QUERY_KEY);
  // Avoid re-parsing on subsequent renders / refresh.
  window.history.replaceState({}, '', url.toString());

  return raw as Address;
}

/// Read the previously captured inviter (if any) for this session.
export function getInviter(): Address | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw && isAddress(raw) ? (raw as Address) : null;
  } catch {
    return null;
  }
}

/// Forget the captured inviter (used when the user dismisses the banner).
export function clearInviter(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

/// Build a shareable link that, when opened inside the Circles playground,
/// loads The Kitty with the current user tagged as the inviter.
///
/// Three flavours:
///   - direct: `https://thekitty.gnosis.box/?via=0xabc…` — bookmark / standalone open
///   - playground: `https://circles.gnosis.io/playground?url=…` — wraps direct in
///     the official iframe host so the recipient gets the Circles UX immediately.
///   - when `joinKitty` is provided, the link points at `/kitty/<gov>/join` so
///     the recipient lands on the 1-signature opt-in screen rather than the home.
export function buildInviteLinks(
  self: Address,
  appOrigin: string,
  opts?: { joinKitty?: Address },
): {
  direct: string;
  playground: string;
} {
  const url = new URL(appOrigin);
  if (opts?.joinKitty) {
    url.pathname = `/kitty/${opts.joinKitty}/join`;
  }
  url.searchParams.set(QUERY_KEY, self);
  const direct = url.toString();

  const playground = `https://circles.gnosis.io/playground?url=${encodeURIComponent(direct)}`;

  return { direct, playground };
}

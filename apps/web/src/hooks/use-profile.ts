import { useEffect, useState } from 'react';

import { getCirclesSdk } from '@/lib/circles-sdk';
import type { Address } from '@/types/kitty';

export interface ProfileInfo {
  name?: string;
  description?: string;
  /// Small avatar URL when available (~96px).
  previewImageUrl?: string;
  /// Full avatar URL when available.
  imageUrl?: string;
  loaded: boolean;
}

const cache = new Map<string, Promise<ProfileInfo>>();

async function fetchProfile(address: Address): Promise<ProfileInfo> {
  try {
    const sdk = getCirclesSdk();
    const avatar = await sdk.getAvatar(address);
    const profile = await avatar.profile.get();
    if (!profile) return { loaded: true };
    return {
      name: (profile as { name?: string }).name,
      description: (profile as { description?: string }).description,
      previewImageUrl: (profile as { previewImageUrl?: string }).previewImageUrl,
      imageUrl: (profile as { imageUrl?: string }).imageUrl,
      loaded: true,
    };
  } catch {
    return { loaded: true };
  }
}

/// Resolve a Circles profile by avatar address (human, group, or org).
/// Cached per-address across the app for the session — kitties of 3 members
/// would otherwise hit the RPC 3 times each render. Returns a stable
/// `loaded: false` placeholder while in flight so consumers can show a
/// skeleton without flicker.
export function useProfile(address: Address | undefined): ProfileInfo {
  const [profile, setProfile] = useState<ProfileInfo>({ loaded: false });

  useEffect(() => {
    if (!address) {
      setProfile({ loaded: true });
      return;
    }
    const key = address.toLowerCase();
    if (!cache.has(key)) {
      cache.set(key, fetchProfile(address));
    }
    let cancelled = false;
    cache.get(key)!.then((p) => {
      if (!cancelled) setProfile(p);
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return profile;
}

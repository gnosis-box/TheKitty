import { useEffect, useState } from 'react';

import { fetchCirclesProfile, type RawProfile } from '@/lib/profile-fetcher';
import type { Address } from '@/types/kitty';

export interface ProfileInfo {
  name?: string;
  description?: string;
  previewImageUrl?: string;
  imageUrl?: string;
  loaded: boolean;
}

const cache = new Map<string, Promise<ProfileInfo>>();

async function loadProfile(address: Address): Promise<ProfileInfo> {
  const raw: RawProfile | null = await fetchCirclesProfile(address);
  if (!raw) return { loaded: true };
  return {
    name: raw.name,
    description: raw.description,
    previewImageUrl: raw.previewImageUrl,
    imageUrl: raw.imageUrl,
    loaded: true,
  };
}

/// Resolve a Circles profile by avatar address. Cached per-address for the
/// session — a kitty of N members would otherwise hit the RPC N times per
/// render. Returns `loaded: false` while in flight so consumers can show a
/// skeleton without flicker; subsequent renders get the cached value.
export function useProfile(address: Address | undefined): ProfileInfo {
  const [profile, setProfile] = useState<ProfileInfo>({ loaded: false });

  useEffect(() => {
    if (!address) {
      setProfile({ loaded: true });
      return;
    }
    const key = address.toLowerCase();
    if (!cache.has(key)) {
      cache.set(key, loadProfile(address));
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

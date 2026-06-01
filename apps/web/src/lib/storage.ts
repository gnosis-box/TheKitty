import { CIRCLES_CONFIG } from './circles-config';
import type { Address, KittyRef } from '@/types/kitty';

// Until we have an on-chain index of kitties an address belongs to, the front
// end caches its own creations in localStorage. The Phase 4 polish can replace
// this with an event-log scan; for the hackathon demo this is fine.

const NAMESPACE = 'kitty.v1';

function keyFor(owner: Address): string {
  return `${NAMESPACE}.kitties.${owner.toLowerCase()}`;
}

/// Read everything we have cached for `owner`. Use `loadKitties` instead when
/// you only want the entries belonging to the currently-configured factory —
/// this one returns whatever's on disk regardless of which factory spawned
/// them, useful for migrations and debugging.
export function loadAllKitties(owner: Address): KittyRef[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(keyFor(owner));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as KittyRef[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/// Load only kitties spawned by the currently-configured `kittyFactoryAddress`.
/// Entries without a `factoryAddress` (legacy saves) are dropped — they
/// belong to a previous factory and would only confuse the user. Chain
/// discovery on home mount will re-populate the truly current ones.
export function loadKitties(owner: Address): KittyRef[] {
  const all = loadAllKitties(owner);
  const factory = CIRCLES_CONFIG.kittyFactoryAddress?.toLowerCase();
  if (!factory) return all;
  return all.filter((k) => k.factoryAddress?.toLowerCase() === factory);
}

export function saveKitty(owner: Address, kitty: KittyRef): void {
  if (typeof window === 'undefined') return;
  const list = loadKitties(owner);
  // De-dupe by governance address.
  const next = [
    kitty,
    ...list.filter((k) => k.governance.toLowerCase() !== kitty.governance.toLowerCase()),
  ];
  window.localStorage.setItem(keyFor(owner), JSON.stringify(next));
}

export function removeKitty(owner: Address, governance: Address): void {
  if (typeof window === 'undefined') return;
  const list = loadKitties(owner).filter(
    (k) => k.governance.toLowerCase() !== governance.toLowerCase(),
  );
  window.localStorage.setItem(keyFor(owner), JSON.stringify(list));
}

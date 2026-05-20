import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatUnits } from 'viem';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function shortAddress(address?: string | null): string {
  if (!address) return '';
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/// Format a raw uint256/uint128 CRC amount as a human-readable string.
/// CRC uses 18 decimals like ETH/DAI.
export function formatCrc(raw: bigint, decimals = 2): string {
  const whole = formatUnits(raw, 18);
  const [int, frac = ''] = whole.split('.');
  if (decimals === 0) return int;
  return `${int}.${(frac + '0'.repeat(decimals)).slice(0, decimals)}`;
}

/// Format a Unix timestamp (seconds) as a relative time string.
/// "in 3h 12m", "23m ago", "expired 1d ago".
export function relativeTime(targetSeconds: number, nowMs = Date.now()): string {
  const deltaSec = targetSeconds - Math.floor(nowMs / 1000);
  const abs = Math.abs(deltaSec);
  const days = Math.floor(abs / 86400);
  const hours = Math.floor((abs % 86400) / 3600);
  const minutes = Math.floor((abs % 3600) / 60);

  let body: string;
  if (days > 0) body = `${days}d ${hours}h`;
  else if (hours > 0) body = `${hours}h ${minutes}m`;
  else body = `${Math.max(1, minutes)}m`;

  return deltaSec >= 0 ? `in ${body}` : `${body} ago`;
}

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function truncateAddress(addr: string, head = 6, tail = 4): string {
  if (!addr.startsWith('0x') || addr.length < head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/** Deterministic hue for avatar fallback fills (0–360). */
export function addressHue(addr: string): number {
  let h = 0;
  const s = addr.toLowerCase().replace(/^0x/, '');
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h % 360);
}

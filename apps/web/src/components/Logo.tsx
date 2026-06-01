import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  /// Pixel size of the rendered logo. Defaults to 28 (header).
  size?: number;
}

/// Inline SVG of The Kitty logo — coral coin with ears + a "K" letterform.
/// Inline (not <img src=…>) so it crisply scales with CSS and avoids a
/// flash before the public asset loads.
export function Logo({ className, size = 28 }: Props) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="The Kitty"
      className={cn('shrink-0', className)}
    >
      <circle cx="50" cy="58" r="32" fill="#ff7a47" />
      <path d="M22 38 L30 12 L46 36 Z" fill="#ff7a47" />
      <path d="M54 36 L70 12 L78 38 Z" fill="#ff7a47" />
      <path d="M30 32 L34 20 L41 32 Z" fill="#ffbf9a" />
      <path d="M59 32 L66 20 L70 32 Z" fill="#ffbf9a" />
      <circle
        cx="50"
        cy="58"
        r="26"
        stroke="#fff7ed"
        strokeWidth="1.4"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M42 46 L42 70 M42 58 L56 46 M42 58 L56 70"
        stroke="#fff7ed"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

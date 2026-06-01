import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  /// Pixel size of the rendered logo. Defaults to 28 (header).
  size?: number;
}

/// The Kitty logomark — coral coin face with ears + a "K" letterform.
/// Served as a PNG out of /public so the rendered art matches the rest of
/// the brand (drop shadow + soft shading) without needing to hand-author
/// the equivalent SVG.
export function Logo({ className, size = 28 }: Props) {
  return (
    <img
      src="/logo.png"
      alt="The Kitty"
      width={size}
      height={size}
      className={cn('shrink-0 select-none', className)}
      draggable={false}
    />
  );
}

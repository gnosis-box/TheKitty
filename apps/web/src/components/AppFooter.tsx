import { Link } from 'react-router-dom';

/// Discreet end-of-page footer used on the two main surfaces (services +
/// funding). Three links — stats, about, and the GitHub repo — kept small
/// so they don't compete with the tab bar above.
export function AppFooter() {
  return (
    <footer className="mt-4 flex items-center justify-center gap-5 text-xs text-[var(--color-muted)]">
      <Link to="/stats" className="hover:text-[var(--color-text)]">
        Stats
      </Link>
      <span className="text-[var(--color-border)]">·</span>
      <Link to="/about" className="hover:text-[var(--color-text)]">
        About
      </Link>
      <span className="text-[var(--color-border)]">·</span>
      <a
        href="https://github.com/gnosis-box/TheKitty"
        target="_blank"
        rel="noreferrer"
        className="hover:text-[var(--color-text)]"
      >
        GitHub
      </a>
    </footer>
  );
}

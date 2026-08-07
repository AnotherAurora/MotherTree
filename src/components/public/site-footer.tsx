export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--mt-border)] bg-[rgb(42_28_22_/_0.06)]">
      <div className="mx-auto max-w-5xl px-6 py-6 text-xs leading-relaxed text-[var(--mt-ink-muted)]">
        <p>
          Contains SKeyDB community data/content for Morimens, created by dansa
          and SKeyDB contributors:{" "}
          <a
            href="https://github.com/dansa/SKeyDB"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--mt-ink)] underline-offset-2 hover:text-[var(--mt-ember-deep)] hover:underline"
          >
            https://github.com/dansa/SKeyDB
          </a>
        </p>
        <p className="mt-2 opacity-70">CC BY-NC-SA 4.0</p>
      </div>
    </footer>
  );
}

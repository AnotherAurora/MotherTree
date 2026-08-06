export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-white">
      <div className="mx-auto max-w-5xl px-6 py-6 text-xs leading-relaxed text-zinc-500">
        <p>
          Contains SKeyDB community data/content for Morimens, created by dansa
          and SKeyDB contributors:{" "}
          <a
            href="https://github.com/dansa/SKeyDB"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-600 underline-offset-2 hover:text-zinc-950 hover:underline"
          >
            https://github.com/dansa/SKeyDB
          </a>
        </p>
        <p className="mt-2 text-zinc-400">CC BY-NC-SA 4.0</p>
      </div>
    </footer>
  );
}

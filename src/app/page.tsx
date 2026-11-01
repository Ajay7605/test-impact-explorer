import { Explorer } from "@/components/Explorer";
import { REPO_URL } from "@/lib/site";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Test Impact Explorer</h1>
          <a
            href={REPO_URL}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:text-foreground"
          >
            Source on GitHub
          </a>
        </div>
        <p className="max-w-2xl text-muted">
          Paste a diff and see exactly which tests need to run. Every selected test comes with the import
          chain that connects it to your change, so you can check the reasoning instead of trusting it.
        </p>
      </header>

      <Explorer />

      <footer className="mt-auto border-t border-border pt-6 text-sm text-muted">
        Static import analysis for JavaScript and TypeScript projects. Your code is analysed in memory and
        never stored.
      </footer>
    </div>
  );
}

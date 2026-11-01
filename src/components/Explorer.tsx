"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { AnalyzeResponse } from "@/lib/impact/analyze";
import { isTestFile } from "@/lib/impact/tests";
import { readProjectFolder } from "@/lib/projectFiles";
import { SAMPLE_DIFF, SAMPLE_FILES, SAMPLE_PROJECT_NAME } from "@/lib/sample/sampleProject";
import { Results } from "./Results";

interface Project {
  name: string;
  files: Record<string, string>;
  isSample: boolean;
}

type Mode = "pick" | "diff";

const SAMPLE_PROJECT: Project = { name: SAMPLE_PROJECT_NAME, files: SAMPLE_FILES, isSample: true };

const EXAMPLES = [
  { label: "date.ts changed", mode: "pick" as const, value: "src/utils/date.ts" },
  { label: "money.ts changed", mode: "pick" as const, value: "src/utils/money.ts" },
  { label: "Sample git diff", mode: "diff" as const, value: SAMPLE_DIFF },
];

// `webkitdirectory` isn't in React's input props, so pass it through a spread.
const directoryProps = { webkitdirectory: "", directory: "" } as Record<string, string>;

// False during server render and hydration, true once React owns the page.
// Before that, clicks on the server-rendered HTML would be silently lost.
const noopSubscribe = () => () => {};
const useHydrated = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function Explorer() {
  const [project, setProject] = useState<Project>(SAMPLE_PROJECT);
  const [mode, setMode] = useState<Mode>("pick");
  const [selected, setSelected] = useState<string[]>([]);
  const [diffText, setDiffText] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const hydrated = useHydrated();

  const files = useMemo(() => Object.keys(project.files).sort(), [project]);
  const testCount = useMemo(() => files.filter(isTestFile).length, [files]);
  const visibleFiles = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? files.filter((f) => f.toLowerCase().includes(q)) : files;
  }, [files, filter]);

  const changes = mode === "pick" ? selected.join("\n") : diffText;
  const canAnalyze = hydrated && changes.trim() !== "" && !loading;

  function switchProject(next: Project) {
    setProject(next);
    setSelected([]);
    setDiffText("");
    setFilter("");
    setResult(null);
    setError(null);
  }

  async function onFolderChosen(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setNotice(null);
    setError(null);
    const loaded = await readProjectFolder(fileList);
    if (Object.keys(loaded.files).length === 0) {
      setError("No JavaScript or TypeScript files found in that folder.");
      return;
    }
    switchProject({ name: loaded.name, files: loaded.files, isSample: false });
    if (loaded.skippedLarge > 0) {
      setNotice(`Skipped ${plural(loaded.skippedLarge, "file")} over 512 KB.`);
    }
    if (folderInput.current) folderInput.current.value = "";
  }

  async function analyze(changeText: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: project.files, changes: changeText }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || body === null) {
        setResult(null);
        setError(body?.error ?? `The server returned ${response.status}.`);
        return;
      }
      setResult(body as AnalyzeResponse);
    } catch {
      setResult(null);
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function runExample(example: (typeof EXAMPLES)[number]) {
    setMode(example.mode);
    if (example.mode === "pick") setSelected([example.value]);
    else setDiffText(example.value);
    void analyze(example.value);
  }

  function toggle(file: string) {
    setSelected((current) =>
      current.includes(file) ? current.filter((f) => f !== file) : [...current, file].sort(),
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" data-ready={hydrated}>
      <div className="flex min-w-0 flex-col gap-6">
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5" aria-labelledby="project-heading">
          <h2 id="project-heading" className="text-sm font-semibold uppercase tracking-wide text-muted">
            1. Project
          </h2>
          <p className="mt-2 font-mono text-sm break-all" data-testid="project-name">
            {project.name}
          </p>
          <p className="text-sm text-muted" data-testid="project-stats">
            {plural(files.length, "file")} · {plural(testCount, "test")}
            {project.isSample && " · bundled sample"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-background">
              Load your own folder
              <input
                ref={folderInput}
                type="file"
                multiple
                className="sr-only"
                data-testid="folder-input"
                onChange={(e) => void onFolderChosen(e.target.files)}
                {...directoryProps}
              />
            </label>
            {!project.isSample && (
              <button
                type="button"
                onClick={() => switchProject(SAMPLE_PROJECT)}
                className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-background"
              >
                Use sample project
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-muted">
            Files are read in your browser. Only .js/.ts source is sent for analysis; node_modules and build
            folders are skipped.
          </p>
          {notice && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{notice}</p>}
        </section>

        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5" aria-labelledby="changes-heading">
          <h2 id="changes-heading" className="text-sm font-semibold uppercase tracking-wide text-muted">
            2. What changed
          </h2>

          <div role="tablist" aria-label="How to enter changes" className="mt-3 flex gap-1 rounded-lg bg-background p-1">
            {(
              [
                ["pick", "Pick files"],
                ["diff", "Paste diff"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => setMode(value)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  mode === value ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "pick" ? (
            <div role="tabpanel" aria-label="Pick files" className="mt-3">
              <div className="flex items-center gap-2">
                <input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter files"
                  aria-label="Filter files"
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
                />
                {selected.length > 0 && (
                  <button type="button" onClick={() => setSelected([])} className="text-sm text-muted hover:text-foreground">
                    Clear ({selected.length})
                  </button>
                )}
              </div>
              <ul className="mt-2 max-h-72 overflow-auto rounded-md border border-border">
                {visibleFiles.map((file) => (
                  <li key={file} className="border-b border-border last:border-b-0">
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-background">
                      <input
                        type="checkbox"
                        checked={selected.includes(file)}
                        onChange={() => toggle(file)}
                        className="accent-[var(--accent)]"
                      />
                      <span className="min-w-0 flex-1 truncate font-mono text-xs" title={file}>
                        {file}
                      </span>
                      {isTestFile(file) && (
                        <span className="rounded bg-emerald-100 px-1.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          test
                        </span>
                      )}
                    </label>
                  </li>
                ))}
                {visibleFiles.length === 0 && <li className="px-3 py-2 text-sm text-muted">No files match.</li>}
              </ul>
            </div>
          ) : (
            <div role="tabpanel" aria-label="Paste diff" className="mt-3">
              <textarea
                value={diffText}
                onChange={(e) => setDiffText(e.target.value)}
                rows={10}
                spellCheck={false}
                aria-label="Diff or list of changed files"
                placeholder={"Paste `git diff`, `git diff --name-status main`,\nor one file path per line."}
                className="w-full resize-y rounded-md border border-border bg-background p-3 font-mono text-xs outline-none focus:border-accent"
              />
              {project.isSample && (
                <button
                  type="button"
                  onClick={() => setDiffText(SAMPLE_DIFF)}
                  className="text-sm text-accent hover:underline"
                >
                  Use sample diff
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={!canAnalyze}
            onClick={() => void analyze(changes)}
            className="mt-4 w-full rounded-md bg-accent px-4 py-2 font-medium text-accent-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Analyzing…" : "Analyze impact"}
          </button>
        </section>
      </div>

      <section className="min-w-0" aria-label="Results" aria-live="polite">
        {error && (
          <div role="alert" data-testid="error" className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}
        {result ? (
          <Results result={result} />
        ) : (
          <div className="flex h-full min-h-64 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border p-6 text-center">
            <p className="max-w-sm text-muted">
              Pick the files you changed or paste a diff, then press <strong>Analyze impact</strong>.
            </p>
            {project.isSample && (
              <div className="flex flex-wrap justify-center gap-2">
                <span className="w-full text-xs uppercase tracking-wide text-muted">Or try an example</span>
                {EXAMPLES.map((example) => (
                  <button
                    key={example.label}
                    type="button"
                    onClick={() => runExample(example)}
                    className="rounded-full border border-border bg-surface px-3 py-1 text-sm transition-colors hover:border-accent"
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

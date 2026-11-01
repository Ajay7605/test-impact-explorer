"use client";

import { useState, type ReactNode } from "react";
import type { AnalyzeResponse } from "@/lib/impact/analyze";
import type { ChangeStatus } from "@/lib/impact/diff";
import { shortNames } from "@/lib/impact/paths";
import { ImpactGraph } from "./ImpactGraph";

const STATUS_STYLE: Record<ChangeStatus, string> = {
  modified: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  added: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  deleted: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  renamed: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
};

function hopLabel(distance: number) {
  if (distance === 0) return "test changed";
  if (distance === 1) return "direct";
  return `${distance} hops`;
}

export function Results({ result }: { result: AnalyzeResponse }) {
  const { summary, affectedTests } = result;
  const command = `npx vitest run ${affectedTests.map((t) => t.file).join(" ")}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); the command stays selectable.
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="results">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Tests to run" value={`${summary.selectedTests} of ${summary.totalTests}`} testId="stat-selected" />
        <Stat label="Tests skipped" value={String(summary.skippedTests)} testId="stat-skipped" />
        <Stat label="Suite skipped" value={`${summary.reductionPct}%`} testId="stat-reduction" />
      </div>

      {result.warnings.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {result.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <Card title={`Changes (${result.changes.length})`}>
        <ul className="flex flex-col gap-1.5">
          {result.changes.map((change) => (
            <li key={change.path} className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`rounded px-1.5 text-[11px] font-medium ${STATUS_STYLE[change.status]}`}>{change.status}</span>
              <span className="min-w-0 break-all font-mono text-xs">{change.path}</span>
              {change.previousPath && <span className="text-xs text-muted">from {change.previousPath}</span>}
              <span className="text-xs text-muted">
                · imported by {change.directDependents} file{change.directDependents === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={`Tests to run (${affectedTests.length})`}>
        {affectedTests.length === 0 ? (
          <p className="text-sm text-muted">No tests depend on these changes.</p>
        ) : (
          <>
            <ol className="flex flex-col divide-y divide-border" data-testid="affected-tests">
              {affectedTests.map((test) => (
                <li key={test.file} className="flex flex-col gap-1 py-2.5 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 break-all font-mono text-sm font-medium">{test.file}</span>
                    <span className="rounded-full bg-background px-2 text-[11px] text-muted">{hopLabel(test.distance)}</span>
                  </div>
                  {test.chain.length > 1 && <Chain chain={test.chain} />}
                  {test.triggeredBy.length > 1 && (
                    <p className="text-xs text-muted">Reached from {test.triggeredBy.length} of your changes</p>
                  )}
                </li>
              ))}
            </ol>
            <div className="mt-3 flex items-stretch gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md bg-background px-3 py-2 font-mono text-xs" data-testid="run-command">
                {command}
              </code>
              <button type="button" onClick={copy} className="rounded-md border border-border px-3 text-sm hover:bg-background">
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </>
        )}
      </Card>

      {result.graph.nodes.length > 0 && (
        <Card title="Impact graph">
          <ImpactGraph graph={result.graph} />
        </Card>
      )}

      {result.skippedTests.length > 0 && (
        <details className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <summary className="cursor-pointer text-sm font-semibold">Skipped tests ({result.skippedTests.length})</summary>
          <ul className="mt-2 flex flex-col gap-1" data-testid="skipped-tests">
            {result.skippedTests.map((t) => (
              <li key={t} className="break-all font-mono text-xs text-muted">
                {t}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Chain({ chain }: { chain: string[] }) {
  const names = shortNames(chain);
  return (
    <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted" aria-label="Import chain">
      {chain.map((file, i) => (
        <span key={file} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden>→</span>}
          <span title={file} className="font-mono">
            {names.get(file)}
          </span>
        </span>
      ))}
    </p>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 sm:p-4">
      <p className="text-lg font-semibold tabular-nums sm:text-2xl" data-testid={testId}>
        {value}
      </p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

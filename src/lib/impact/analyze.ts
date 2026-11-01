import { parseChanges } from "./diff";
import { buildGraph } from "./graph";
import { computeImpact, type ImpactResult } from "./impact";
import { DEFAULT_ALIASES } from "./resolve";

export const LIMITS = {
  maxFiles: 5000,
  maxTotalChars: 8_000_000,
  maxChangeChars: 2_000_000,
};

export interface AnalyzeRequest {
  files: Record<string, string>;
  changes: string;
  aliases?: Record<string, string>;
}

export interface AnalyzeResponse extends ImpactResult {
  summary: {
    totalFiles: number;
    totalTests: number;
    selectedTests: number;
    skippedTests: number;
    /** Share of the test suite that doesn't need to run, 0–100. */
    reductionPct: number;
  };
  warnings: string[];
}

export class AnalyzeError extends Error {}

const isRecordOfStrings = (value: unknown): value is Record<string, string> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((v) => typeof v === "string");

/** Validate untrusted input (e.g. a JSON request body). Throws AnalyzeError with a fixable message. */
export function validateRequest(body: unknown): AnalyzeRequest {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AnalyzeError("Request body must be a JSON object with `files` and `changes`.");
  }
  const { files, changes, aliases } = body as Record<string, unknown>;

  if (!isRecordOfStrings(files)) {
    throw new AnalyzeError("`files` must be an object mapping file paths to source text.");
  }
  const fileCount = Object.keys(files).length;
  if (fileCount === 0) {
    throw new AnalyzeError("`files` is empty. Send at least one source file.");
  }
  if (fileCount > LIMITS.maxFiles) {
    throw new AnalyzeError(`Too many files (${fileCount}). The limit is ${LIMITS.maxFiles}.`);
  }
  const totalChars = Object.values(files).reduce((sum, s) => sum + s.length, 0);
  if (totalChars > LIMITS.maxTotalChars) {
    throw new AnalyzeError("Project is too large (over 8 MB of source). Try a sub-folder.");
  }

  if (typeof changes !== "string") {
    throw new AnalyzeError("`changes` must be a string: a git diff, `--name-status` output, or a list of paths.");
  }
  if (changes.length > LIMITS.maxChangeChars) {
    throw new AnalyzeError("`changes` is too large (over 2 MB).");
  }

  if (aliases !== undefined && !isRecordOfStrings(aliases)) {
    throw new AnalyzeError("`aliases` must map import prefixes to folders, e.g. { \"@/\": \"src/\" }.");
  }

  return { files, changes, aliases };
}

export function analyze(request: AnalyzeRequest): AnalyzeResponse {
  const changes = parseChanges(request.changes);
  if (changes.length === 0) {
    throw new AnalyzeError("No changed files found. Paste a git diff or list at least one file path.");
  }

  const graph = buildGraph(request.files, { aliases: request.aliases ?? DEFAULT_ALIASES });
  const result = computeImpact(graph, changes);

  const totalTests = graph.tests.length;
  const selectedTests = result.affectedTests.length;
  const warnings: string[] = [];

  if (totalTests === 0) {
    warnings.push("No test files found (looked for *.test.*, *.spec.* and __tests__/).");
  }
  for (const path of result.notFound) {
    warnings.push(`${path} isn't a source file in this project and nothing imports it.`);
  }
  const brokenImports = graph.unresolved.length;
  if (brokenImports > 0) {
    const examples = graph.unresolved
      .slice(0, 3)
      .map((u) => `"${u.specifier}" in ${u.from}`)
      .join(", ");
    warnings.push(
      `${brokenImports} local import${brokenImports === 1 ? "" : "s"} couldn't be resolved (e.g. ${examples}). ` +
        "Results may miss tests that depend on them.",
    );
  }
  if (result.graph.truncated) {
    warnings.push("The graph only shows the 150 closest files.");
  }

  return {
    ...result,
    summary: {
      totalFiles: graph.files.length,
      totalTests,
      selectedTests,
      skippedTests: totalTests - selectedTests,
      reductionPct: totalTests === 0 ? 0 : Math.round(((totalTests - selectedTests) / totalTests) * 100),
    },
    warnings,
  };
}

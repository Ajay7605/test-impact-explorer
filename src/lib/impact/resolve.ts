import { dirname, joinPath } from "./paths";

export const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

export const DEFAULT_ALIASES: Record<string, string> = { "@/": "src/", "~/": "src/" };

// TS projects using ESM write `./a.js` in source but the file on disk is `a.ts`.
const JS_TO_TS: Record<string, string[]> = {
  ".js": [".ts", ".tsx"],
  ".jsx": [".tsx"],
  ".mjs": [".mts"],
  ".cjs": [".cts"],
};

/**
 * Turn a specifier into the project-relative path it points at, before any
 * extension guessing. Returns null for bare package imports and for paths that
 * climb above the project root.
 */
export function specifierTarget(
  fromFile: string,
  specifier: string,
  aliases: Record<string, string> = DEFAULT_ALIASES,
): string | null {
  if (specifier === "." || specifier === ".." || specifier.startsWith("./") || specifier.startsWith("../")) {
    return joinPath(dirname(fromFile), specifier);
  }
  if (specifier.startsWith("/")) {
    return joinPath(specifier);
  }
  // Longest alias first, so "@/components/" wins over "@/".
  const alias = Object.keys(aliases)
    .sort((a, b) => b.length - a.length)
    .find((prefix) => specifier.startsWith(prefix));
  if (alias === undefined) return null;
  return joinPath(aliases[alias], specifier.slice(alias.length));
}

/** Every file path a target could refer to, in the order a bundler would try them. */
export function candidatePaths(target: string): string[] {
  const candidates = [target];
  for (const [jsExt, tsExts] of Object.entries(JS_TO_TS)) {
    if (target.endsWith(jsExt)) {
      const stem = target.slice(0, -jsExt.length);
      candidates.push(...tsExts.map((ext) => stem + ext));
    }
  }
  candidates.push(...SOURCE_EXTENSIONS.map((ext) => target + ext));
  candidates.push(...SOURCE_EXTENSIONS.map((ext) => `${target}/index${ext}`));
  return candidates;
}

export function resolveCandidates(candidates: string[], files: ReadonlySet<string>): string | null {
  return candidates.find((candidate) => files.has(candidate)) ?? null;
}

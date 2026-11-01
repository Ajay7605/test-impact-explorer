import { parseImports } from "./parseImports";
import { normalizePath } from "./paths";
import { candidatePaths, DEFAULT_ALIASES, resolveCandidates, specifierTarget } from "./resolve";
import { isTestFile } from "./tests";

export interface UnresolvedImport {
  from: string;
  specifier: string;
  /** Project path the specifier pointed at, before extension guessing. */
  target: string;
}

export interface DependencyGraph {
  /** All files in the snapshot, sorted. */
  files: string[];
  tests: string[];
  /** file → files it imports */
  dependencies: Map<string, Set<string>>;
  /** file → files that import it */
  dependents: Map<string, Set<string>>;
  /** Relative or aliased imports that point at a file not in the snapshot. */
  unresolved: UnresolvedImport[];
}

export interface GraphOptions {
  aliases?: Record<string, string>;
}

export function buildGraph(sources: Record<string, string>, options: GraphOptions = {}): DependencyGraph {
  const aliases = options.aliases ?? DEFAULT_ALIASES;

  const normalized = new Map<string, string>();
  for (const [rawPath, source] of Object.entries(sources)) {
    const path = normalizePath(rawPath);
    if (path) normalized.set(path, source);
  }

  const fileSet = new Set(normalized.keys());
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();
  for (const file of fileSet) {
    dependencies.set(file, new Set());
    dependents.set(file, new Set());
  }

  const unresolved: UnresolvedImport[] = [];

  for (const [file, source] of normalized) {
    for (const specifier of parseImports(source)) {
      const target = specifierTarget(file, specifier, aliases);
      if (target === null) continue; // package import or escapes the root

      const resolved = resolveCandidates(candidatePaths(target), fileSet);
      if (resolved === null) {
        unresolved.push({ from: file, specifier, target });
        continue;
      }
      if (resolved === file) continue;
      dependencies.get(file)!.add(resolved);
      dependents.get(resolved)!.add(file);
    }
  }

  const files = [...fileSet].sort();
  return {
    files,
    tests: files.filter(isTestFile),
    dependencies,
    dependents,
    unresolved,
  };
}

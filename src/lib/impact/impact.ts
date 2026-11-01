import type { FileChange } from "./diff";
import type { DependencyGraph } from "./graph";
import { candidatePaths } from "./resolve";
import { isTestFile } from "./tests";

export interface AffectedTest {
  file: string;
  /** Import hops from the nearest changed file. 0 means the test itself changed. */
  distance: number;
  /** Shortest path from a changed file to this test: [changed, …, test]. */
  chain: string[];
  /** Every changed file that reaches this test. */
  triggeredBy: string[];
}

export interface ChangeSummary extends FileChange {
  inProject: boolean;
  /** Files that import this one directly (for deleted files: files still importing it). */
  directDependents: number;
}

export type GraphNodeKind = "changed" | "impacted" | "test";

export interface ImpactGraph {
  nodes: { id: string; kind: GraphNodeKind; layer: number }[];
  /** Edges point in the direction impact flows: dependency → dependent. */
  edges: { from: string; to: string }[];
  truncated: boolean;
}

export interface ImpactResult {
  changes: ChangeSummary[];
  affectedTests: AffectedTest[];
  skippedTests: string[];
  /** Non-test files touched by the change, directly or transitively. */
  impactedFiles: string[];
  notFound: string[];
  graph: ImpactGraph;
}

export const MAX_GRAPH_NODES = 150;

/**
 * Direct dependents of a path. For a path that is no longer in the project
 * (deleted, or the old side of a rename) these are the files whose imports
 * still point at it.
 */
function directDependents(graph: DependencyGraph, path: string): string[] {
  const known = graph.dependents.get(path);
  if (known) return [...known];
  const importers = graph.unresolved
    .filter((u) => candidatePaths(u.target).includes(path))
    .map((u) => u.from);
  return [...new Set(importers)];
}

/** Breadth-first walk from one seed. Returns each reached node's parent. */
function walk(graph: DependencyGraph, seed: string): Map<string, string | null> {
  const parent = new Map<string, string | null>([[seed, null]]);
  const queue = [seed];
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    const next = node === seed ? directDependents(graph, seed) : [...(graph.dependents.get(node) ?? [])];
    for (const dependent of next.sort()) {
      if (parent.has(dependent)) continue;
      parent.set(dependent, node);
      queue.push(dependent);
    }
  }
  return parent;
}

function chainTo(parent: Map<string, string | null>, node: string): string[] {
  const chain = [node];
  let current = parent.get(node);
  while (current != null) {
    chain.push(current);
    current = parent.get(current);
  }
  return chain.reverse();
}

export function computeImpact(graph: DependencyGraph, changes: FileChange[]): ImpactResult {
  const inProject = new Set(graph.files);
  const affected = new Map<string, AffectedTest>();
  const layerOf = new Map<string, number>();
  const seeds = new Set<string>();
  const summaries: ChangeSummary[] = [];
  const notFound: string[] = [];

  for (const change of changes) {
    const seedPaths = [change.path];
    if (change.previousPath) seedPaths.push(change.previousPath);

    const dependents = new Set(seedPaths.flatMap((p) => directDependents(graph, p)));
    summaries.push({ ...change, inProject: inProject.has(change.path), directDependents: dependents.size });

    if (!inProject.has(change.path) && dependents.size === 0 && change.status !== "deleted") {
      notFound.push(change.path);
    }

    for (const seed of seedPaths) {
      if (!inProject.has(seed) && directDependents(graph, seed).length === 0) continue;
      seeds.add(seed);

      const parent = walk(graph, seed);
      for (const node of parent.keys()) {
        const chain = chainTo(parent, node);
        const distance = chain.length - 1;
        if (distance < (layerOf.get(node) ?? Infinity)) layerOf.set(node, distance);

        if (!inProject.has(node) || !isTestFile(node)) continue;
        const existing = affected.get(node);
        if (!existing) {
          affected.set(node, { file: node, distance, chain, triggeredBy: [change.path] });
        } else {
          if (!existing.triggeredBy.includes(change.path)) existing.triggeredBy.push(change.path);
          if (distance < existing.distance) {
            existing.distance = distance;
            existing.chain = chain;
          }
        }
      }
    }
  }

  const affectedTests = [...affected.values()].sort(
    (a, b) => a.distance - b.distance || a.file.localeCompare(b.file),
  );
  const skippedTests = graph.tests.filter((t) => !affected.has(t));
  const impactedFiles = [...layerOf.keys()]
    .filter((f) => inProject.has(f) && !isTestFile(f))
    .sort();

  return {
    changes: summaries,
    affectedTests,
    skippedTests,
    impactedFiles,
    notFound,
    graph: buildImpactGraph(graph, layerOf, seeds),
  };
}

function buildImpactGraph(
  graph: DependencyGraph,
  layerOf: Map<string, number>,
  seeds: Set<string>,
): ImpactGraph {
  const ordered = [...layerOf.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  const kept = ordered.slice(0, MAX_GRAPH_NODES);
  const ids = new Set(kept.map(([id]) => id));

  const nodes = kept.map(([id, layer]) => ({
    id,
    layer,
    kind: (seeds.has(id) ? "changed" : isTestFile(id) ? "test" : "impacted") as GraphNodeKind,
  }));

  const edges = new Map<string, { from: string; to: string }>();
  const addEdge = (from: string, to: string) => edges.set(`${from}\0${to}`, { from, to });

  for (const to of ids) {
    for (const from of graph.dependencies.get(to) ?? []) {
      if (ids.has(from)) addEdge(from, to);
    }
    // Files that still import a deleted seed have no resolved edge; draw it anyway.
    for (const u of graph.unresolved) {
      if (u.from !== to) continue;
      for (const seed of seeds) {
        if (ids.has(seed) && !graph.dependents.has(seed) && candidatePaths(u.target).includes(seed)) {
          addEdge(seed, to);
        }
      }
    }
  }

  return { nodes, edges: [...edges.values()], truncated: ordered.length > kept.length };
}

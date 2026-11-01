import type { GraphNodeKind, ImpactGraph as Graph } from "@/lib/impact/impact";
import { shortNames } from "@/lib/impact/paths";

const COL_GAP = 40;
const NODE_W = 156;
const NODE_H = 30;
const ROW_GAP = 12;
const PAD = 8;
const MAX_LABEL = 21;
/** Below this width the SVG scrolls sideways instead of shrinking further. */
const MIN_RENDER_WIDTH = 520;

const KIND_STYLE: Record<GraphNodeKind, string> = {
  changed: "fill-amber-100 stroke-amber-500 dark:fill-amber-950 dark:stroke-amber-400",
  impacted: "fill-sky-50 stroke-sky-400 dark:fill-sky-950 dark:stroke-sky-500",
  test: "fill-emerald-100 stroke-emerald-500 dark:fill-emerald-950 dark:stroke-emerald-400",
};

const KIND_ORDER: Record<GraphNodeKind, number> = { changed: 0, impacted: 1, test: 2 };

// Keep the end of long labels: the file name matters more than the folder.
const truncate = (label: string) => (label.length > MAX_LABEL ? `…${label.slice(-(MAX_LABEL - 1))}` : label);

/**
 * Columns by distance from the change; impact flows left to right.
 * Only forward edges are drawn. Every node's column comes from its shortest
 * path, which is always a forward edge, so backward and same-column edges
 * (cycles, files that also import a sibling) add clutter without explaining
 * anything.
 */
export function ImpactGraph({ graph }: { graph: Graph }) {
  const layers = new Map<number, Graph["nodes"]>();
  for (const node of graph.nodes) {
    layers.set(node.layer, [...(layers.get(node.layer) ?? []), node]);
  }
  for (const nodes of layers.values()) {
    nodes.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.id.localeCompare(b.id));
  }

  const layerIds = [...layers.keys()].sort((a, b) => a - b);
  const column = new Map(layerIds.map((layer, i) => [layer, i]));
  const position = new Map<string, { x: number; y: number; col: number }>();
  for (const [layer, nodes] of layers) {
    const col = column.get(layer)!;
    nodes.forEach((node, row) => {
      position.set(node.id, { x: PAD + col * (NODE_W + COL_GAP), y: PAD + row * (NODE_H + ROW_GAP), col });
    });
  }

  const labels = shortNames(graph.nodes.map((n) => n.id));
  const maxRows = Math.max(...[...layers.values()].map((n) => n.length));
  const width = PAD * 2 + layerIds.length * NODE_W + (layerIds.length - 1) * COL_GAP;
  const height = PAD * 2 + maxRows * NODE_H + (maxRows - 1) * ROW_GAP;

  const edges = graph.edges.filter(({ from, to }) => {
    const a = position.get(from);
    const b = position.get(to);
    return a && b && b.col > a.col;
  });

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Impact graph with ${graph.nodes.length} files`}
          className="h-auto w-full text-muted"
          style={{ minWidth: Math.min(width, MIN_RENDER_WIDTH), maxWidth: width }}
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-current" />
            </marker>
          </defs>
          {edges.map(({ from, to }) => {
            const a = position.get(from)!;
            const b = position.get(to)!;
            const x1 = a.x + NODE_W;
            const y1 = a.y + NODE_H / 2;
            const x2 = b.x;
            const y2 = b.y + NODE_H / 2;
            const bend = (x2 - x1) / 2;
            return (
              <path
                key={`${from}->${to}`}
                d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`}
                fill="none"
                className="stroke-current opacity-50"
                strokeWidth={1.25}
                markerEnd="url(#arrow)"
              />
            );
          })}
          {graph.nodes.map((node) => {
            const p = position.get(node.id)!;
            return (
              <g key={node.id} transform={`translate(${p.x} ${p.y})`} data-kind={node.kind}>
                <title>{node.id}</title>
                <rect width={NODE_W} height={NODE_H} rx={6} className={KIND_STYLE[node.kind]} strokeWidth={1.25} />
                <text x={10} y={NODE_H / 2} dominantBaseline="central" className="fill-foreground font-mono text-[11px]">
                  {truncate(labels.get(node.id)!)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <Legend kind="changed" text="Changed" />
        <Legend kind="impacted" text="Depends on a change" />
        <Legend kind="test" text="Test to run" />
        <span>Hover a box for the full path.</span>
        {width > MIN_RENDER_WIDTH && <span className="sm:hidden">Scroll sideways to see the whole graph.</span>}
      </div>
    </div>
  );
}

function Legend({ kind, text }: { kind: GraphNodeKind; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="12" height="12" aria-hidden>
        <rect x="0.5" y="0.5" width="11" height="11" rx="3" className={KIND_STYLE[kind]} />
      </svg>
      {text}
    </span>
  );
}

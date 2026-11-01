/**
 * Minimal POSIX-style path helpers. We avoid `node:path` so this code also runs
 * in the browser, and we always use forward slashes regardless of the OS that
 * produced the snapshot.
 */

/** Join segments and collapse `.`/`..`. Returns null if the path climbs above the root. */
export function joinPath(...segments: string[]): string | null {
  const out: string[] = [];
  for (const segment of segments) {
    for (const part of segment.replace(/\\/g, "/").split("/")) {
      if (part === "" || part === ".") continue;
      if (part === "..") {
        if (out.length === 0) return null;
        out.pop();
        continue;
      }
      out.push(part);
    }
  }
  return out.join("/");
}

/** Normalise a path from user input: forward slashes, no leading `./` or `/`. */
export function normalizePath(path: string): string {
  return joinPath(path.trim()) ?? "";
}

export function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * Shortest unique label for each path: the file name, plus as many parent
 * folders as needed to tell apart files that share a name
 * (`gateway.ts` vs `__tests__/gateway.ts`).
 */
export function shortNames(paths: string[]): Map<string, string> {
  const unique = [...new Set(paths)];
  const parts = new Map(unique.map((p) => [p, p.split("/")]));
  const depth = new Map(unique.map((p) => [p, 1]));
  const label = (p: string) => parts.get(p)!.slice(-depth.get(p)!).join("/");

  for (;;) {
    const byLabel = new Map<string, string[]>();
    for (const p of unique) byLabel.set(label(p), [...(byLabel.get(label(p)) ?? []), p]);

    let grew = false;
    for (const group of byLabel.values()) {
      if (group.length < 2) continue;
      for (const p of group) {
        if (depth.get(p)! < parts.get(p)!.length) {
          depth.set(p, depth.get(p)! + 1);
          grew = true;
        }
      }
    }
    if (!grew) break;
  }

  return new Map(unique.map((p) => [p, label(p)]));
}

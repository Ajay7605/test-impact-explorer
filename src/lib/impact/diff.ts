import { normalizePath } from "./paths";

export type ChangeStatus = "added" | "modified" | "deleted" | "renamed";

export interface FileChange {
  path: string;
  status: ChangeStatus;
  previousPath?: string;
}

const NAME_STATUS = /^([AMDRCT])\d*\t([^\t]+)(?:\t([^\t]+))?$/;
const NAME_STATUS_CODES: Record<string, ChangeStatus> = {
  A: "added",
  M: "modified",
  D: "deleted",
  R: "renamed",
  C: "added",
  T: "modified",
};

/**
 * Accepts a unified diff, `git diff --name-status` output, or a plain list of
 * paths (one per line) and returns the changed files.
 */
export function parseChanges(input: string): FileChange[] {
  if (/^diff --git /m.test(input) || /^--- .*\r?\n\+\+\+ /m.test(input)) {
    return parseUnifiedDiff(input);
  }

  const changes: FileChange[] = [];
  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const m = NAME_STATUS.exec(rawLine.trim());
    if (m) {
      const status = NAME_STATUS_CODES[m[1]];
      if (status === "renamed" && m[3]) {
        changes.push({ path: m[3], status, previousPath: m[2] });
      } else {
        changes.push({ path: m[3] ?? m[2], status });
      }
      continue;
    }
    changes.push({ path: line, status: "modified" });
  }
  return dedupe(changes);
}

/** Strip `a/` / `b/` prefixes and trailing timestamps. Null means /dev/null. */
function headerPath(raw: string): string | null {
  const path = raw.split("\t")[0].trim().replace(/^"(.*)"$/, "$1");
  if (path === "/dev/null") return null;
  return path.replace(/^[ab]\//, "");
}

export function parseUnifiedDiff(diff: string): FileChange[] {
  const lines = diff.split(/\r?\n/);
  const changes: FileChange[] = [];
  let current: FileChange | null = null;
  // True between a `diff --git` line and the first hunk, where metadata lines live.
  let inHeader = false;

  const flush = () => {
    if (current?.path) changes.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("diff --git ")) {
      flush();
      const m = /^diff --git "?a\/(.+?)"? "?b\/(.+?)"?$/.exec(line);
      current = { path: m ? m[2] : "", status: "modified" };
      inHeader = true;
      continue;
    }

    // A file header is a `---` line directly followed by a `+++` line. Checking
    // the pair stops a removed line like "--- comment" inside a hunk from
    // being mistaken for a new file.
    if (line.startsWith("--- ") && lines[i + 1]?.startsWith("+++ ")) {
      const oldPath = headerPath(line.slice(4));
      const newPath = headerPath(lines[i + 1].slice(4));
      if (!current || !inHeader) {
        flush();
        current = { path: "", status: "modified" };
      }
      const change: FileChange = current;
      if (oldPath === null && newPath !== null) {
        change.status = "added";
        change.path = newPath;
      } else if (newPath === null && oldPath !== null) {
        change.status = "deleted";
        change.path = oldPath;
      } else if (oldPath !== null && newPath !== null) {
        change.path = newPath;
        if (oldPath !== newPath && change.status === "modified") {
          change.status = "renamed";
          change.previousPath = oldPath;
        }
      }
      inHeader = false;
      i++;
      continue;
    }

    if (!current || !inHeader) continue;
    const change: FileChange = current;

    if (line.startsWith("new file mode")) {
      change.status = "added";
    } else if (line.startsWith("deleted file mode")) {
      change.status = "deleted";
    } else if (line.startsWith("rename from ")) {
      change.status = "renamed";
      change.previousPath = line.slice("rename from ".length);
    } else if (line.startsWith("rename to ")) {
      change.path = line.slice("rename to ".length);
    } else if (line.startsWith("@@")) {
      inHeader = false;
    }
  }
  flush();

  return dedupe(changes);
}

function dedupe(changes: FileChange[]): FileChange[] {
  const byPath = new Map<string, FileChange>();
  for (const change of changes) {
    const path = normalizePath(change.path);
    if (!path || byPath.has(path)) continue;
    const previousPath = change.previousPath ? normalizePath(change.previousPath) : undefined;
    byPath.set(path, previousPath ? { ...change, path, previousPath } : { path, status: change.status });
  }
  return [...byPath.values()];
}

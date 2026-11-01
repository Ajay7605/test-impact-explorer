const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/;
const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage", "out"]);

export const MAX_FILE_BYTES = 512 * 1024;

/**
 * Map a path from a folder upload (`my-repo/src/a.ts`) to a repo-relative path
 * (`src/a.ts`). Returns null for files the analyzer should skip.
 */
export function toProjectPath(relativePath: string): string | null {
  const parts = relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
  // Folder uploads prefix every path with the folder's own name.
  const inside = parts.length > 1 ? parts.slice(1) : parts;
  if (inside.slice(0, -1).some((dir) => IGNORED_DIRS.has(dir))) return null;
  const path = inside.join("/");
  if (!SOURCE_FILE.test(path) || path.endsWith(".d.ts")) return null;
  return path;
}

export interface LoadedProject {
  name: string;
  files: Record<string, string>;
  skippedLarge: number;
}

/** Read the source files out of a directory picker's FileList. */
export async function readProjectFolder(fileList: FileList | File[]): Promise<LoadedProject> {
  const files: Record<string, string> = {};
  let skippedLarge = 0;
  let name = "project";

  for (const file of Array.from(fileList)) {
    const relative = file.webkitRelativePath || file.name;
    name = relative.split("/")[0] || name;
    const path = toProjectPath(relative);
    if (path === null) continue;
    if (file.size > MAX_FILE_BYTES) {
      skippedLarge++;
      continue;
    }
    files[path] = await file.text();
  }

  return { name, files, skippedLarge };
}

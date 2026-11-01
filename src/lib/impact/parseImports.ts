/**
 * Replace comments with whitespace (keeping newlines) while leaving string
 * literals untouched, so commented-out imports don't become edges.
 */
export function stripComments(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;

  while (i < n) {
    const c = source[i];
    const next = source[i + 1];

    if (c === "/" && next === "/") {
      while (i < n && source[i] !== "\n") i++;
      continue;
    }

    if (c === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      out += source.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n && source[j] !== c) {
        if (source[j] === "\\") {
          j += 2;
          continue;
        }
        // An unterminated '…' or "…" string ends at the line break.
        if (source[j] === "\n" && c !== "`") break;
        j++;
      }
      out += source.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    out += c;
    i++;
  }

  return out;
}

// `from "x"` covers import/export … from; `import "x"` / `import("x")` covers
// side-effect and dynamic imports; `require("x")` covers CommonJS.
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'])([^"'\n]+)\1/g;

/** Return the unique module specifiers a file imports, in source order. */
export function parseImports(source: string): string[] {
  const code = stripComments(source);
  const found = new Set<string>();
  for (const match of code.matchAll(SPECIFIER)) {
    found.add(match[2]);
  }
  return [...found];
}

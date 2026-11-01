const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const TESTS_DIR = /(^|\/)__tests__\//;

/** Jest/Vitest conventions: `*.test.*`, `*.spec.*`, or anything under `__tests__/`. */
export function isTestFile(path: string): boolean {
  return TEST_FILE.test(path) || TESTS_DIR.test(path);
}

import { describe, expect, it } from "vitest";
import { joinPath, normalizePath, shortNames } from "./paths";

describe("joinPath / normalizePath", () => {
  it("collapses . and .. and converts backslashes", () => {
    expect(joinPath("src/cart", "../utils/./money")).toBe("src/utils/money");
    expect(normalizePath(".\\src\\a.ts")).toBe("src/a.ts");
  });

  it("refuses to climb above the root", () => {
    expect(joinPath("src", "../../x")).toBeNull();
    expect(normalizePath("../x.ts")).toBe("");
  });
});

describe("shortNames", () => {
  it("uses the bare file name when it's unique", () => {
    expect(shortNames(["src/utils/date.ts", "src/orders/history.ts"])).toEqual(
      new Map([
        ["src/utils/date.ts", "date.ts"],
        ["src/orders/history.ts", "history.ts"],
      ]),
    );
  });

  it("adds parent folders until names are unique", () => {
    const names = shortNames([
      "src/payments/gateway.ts",
      "src/payments/__tests__/gateway.ts",
      "src/a/index.ts",
      "src/b/index.ts",
    ]);
    expect(names.get("src/payments/gateway.ts")).toBe("payments/gateway.ts");
    expect(names.get("src/payments/__tests__/gateway.ts")).toBe("__tests__/gateway.ts");
    expect(names.get("src/a/index.ts")).toBe("a/index.ts");
    expect(names.get("src/b/index.ts")).toBe("b/index.ts");
  });

  it("stops at the full path when one path is a suffix of another", () => {
    const names = shortNames(["x.ts", "lib/x.ts"]);
    expect(names.get("x.ts")).toBe("x.ts");
    expect(names.get("lib/x.ts")).toBe("lib/x.ts");
  });
});

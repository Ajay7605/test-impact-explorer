import { add } from "./math";

export function formatSum(a: number, b: number): string {
  return `${a} + ${b} = ${add(a, b)}`;
}

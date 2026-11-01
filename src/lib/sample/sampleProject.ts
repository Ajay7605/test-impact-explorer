/**
 * A small online-shop codebase used as the default demo. It deliberately
 * includes the cases the analyzer has to handle: a barrel file
 * (pricing/index.ts), an `@/` alias, an ESM-style `.js` import that points at a
 * `.ts` file, an import cycle (cart ↔ cartEvents), a `__tests__` folder and
 * package imports that must be ignored.
 */
export const SAMPLE_PROJECT_NAME = "sample-shop";

export const SAMPLE_FILES: Record<string, string> = {
  "src/utils/money.ts": `export type Cents = number;

export function roundCents(value: number): Cents {
  return Math.round(value);
}

export function formatMoney(cents: Cents, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(cents / 100);
}
`,

  "src/utils/date.ts": `export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function isExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() < now.getTime();
}
`,

  "src/pricing/discount.ts": `import { roundCents, type Cents } from "../utils/money";

export interface Coupon {
  code: string;
  percentOff: number;
}

export function applyCoupon(subtotal: Cents, coupon?: Coupon): Cents {
  if (!coupon) return subtotal;
  return roundCents(subtotal * (1 - coupon.percentOff / 100));
}
`,

  "src/pricing/tax.ts": `import { roundCents, type Cents } from "../utils/money";

export const GST_RATE = 0.18;

export function addTax(amount: Cents): Cents {
  return roundCents(amount * (1 + GST_RATE));
}
`,

  "src/pricing/index.ts": `export * from "./discount";
export * from "./tax";
`,

  "src/cart/cart.ts": `import { addTax, applyCoupon, type Coupon } from "../pricing";
import { type Cents } from "@/utils/money";
import { emit } from "./cartEvents";

export interface CartItem {
  sku: string;
  price: Cents;
  quantity: number;
}

export class Cart {
  items: CartItem[] = [];
  coupon?: Coupon;

  add(item: CartItem) {
    this.items.push(item);
    emit("item-added", this);
  }

  total(): Cents {
    const subtotal = this.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    return addTax(applyCoupon(subtotal, this.coupon));
  }
}
`,

  "src/cart/cartEvents.ts": `import type { Cart } from "./cart";

type Listener = (cart: Cart) => void;
const listeners = new Map<string, Listener[]>();

export function on(event: string, listener: Listener) {
  listeners.set(event, [...(listeners.get(event) ?? []), listener]);
}

export function emit(event: string, cart: Cart) {
  for (const listener of listeners.get(event) ?? []) listener(cart);
}
`,

  "src/payments/gateway.ts": `import Stripe from "stripe";
import { addDays } from "../utils/date";

// import { legacyCharge } from "./legacyGateway";  (removed in v2)

export async function createPaymentIntent(client: Stripe, amount: number) {
  const expiresAt = addDays(new Date(), 1);
  return client.paymentIntents.create({ amount, currency: "inr", metadata: { expiresAt: expiresAt.toISOString() } });
}
`,

  "src/checkout/checkout.ts": `import Stripe from "stripe";
import { Cart } from "../cart/cart";
import { createPaymentIntent } from "../payments/gateway.js";

export async function checkout(cart: Cart, client: Stripe) {
  if (cart.items.length === 0) throw new Error("Cart is empty");
  return createPaymentIntent(client, cart.total());
}
`,

  "src/orders/history.ts": `import { isExpired } from "../utils/date";

export interface Order {
  id: string;
  returnBy: Date;
}

export function returnableOrders(orders: Order[], now = new Date()): Order[] {
  return orders.filter((order) => !isExpired(order.returnBy, now));
}
`,

  "src/ui/CartView.tsx": `import { useState } from "react";
import { Cart } from "../cart/cart";
import { formatMoney } from "../utils/money";

export function CartView({ cart }: { cart: Cart }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <section>
      <p>Total: {formatMoney(cart.total())}</p>
      <button onClick={() => setOpen(false)}>Hide</button>
    </section>
  );
}
`,

  "src/utils/money.test.ts": `import { describe, expect, it } from "vitest";
import { formatMoney, roundCents } from "./money";

describe("money", () => {
  it("rounds to whole cents", () => expect(roundCents(10.6)).toBe(11));
  it("formats rupees", () => expect(formatMoney(12345)).toContain("123.45"));
});
`,

  "src/pricing/discount.test.ts": `import { expect, it } from "vitest";
import { applyCoupon } from "./discount";

it("takes 10% off", () => expect(applyCoupon(1000, { code: "TEN", percentOff: 10 })).toBe(900));
`,

  "src/pricing/tax.test.ts": `import { expect, it } from "vitest";
import { addTax } from "./tax";

it("adds 18% GST", () => expect(addTax(1000)).toBe(1180));
`,

  "src/cart/cart.test.ts": `import { expect, it } from "vitest";
import { Cart } from "./cart";

it("totals items with tax", () => {
  const cart = new Cart();
  cart.add({ sku: "milk", price: 1000, quantity: 2 });
  expect(cart.total()).toBe(2360);
});
`,

  "src/checkout/checkout.spec.ts": `import { expect, it, vi } from "vitest";
import { Cart } from "../cart/cart";
import { checkout } from "./checkout";

it("refuses an empty cart", async () => {
  await expect(checkout(new Cart(), vi.fn() as never)).rejects.toThrow("Cart is empty");
});
`,

  "src/payments/__tests__/gateway.ts": `import { expect, it, vi } from "vitest";
import { createPaymentIntent } from "../gateway";

it("sets an expiry one day out", async () => {
  const create = vi.fn().mockResolvedValue({});
  await createPaymentIntent({ paymentIntents: { create } } as never, 500);
  expect(create).toHaveBeenCalledOnce();
});
`,

  "src/orders/history.test.ts": `import { expect, it } from "vitest";
import { returnableOrders } from "./history";

it("drops orders past their return window", () => {
  const now = new Date("2026-01-10");
  const orders = [{ id: "a", returnBy: new Date("2026-01-05") }, { id: "b", returnBy: new Date("2026-01-20") }];
  expect(returnableOrders(orders, now).map((o) => o.id)).toEqual(["b"]);
});
`,

  "src/ui/CartView.test.tsx": `import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Cart } from "../cart/cart";
import { CartView } from "./CartView";

it("shows the total", () => {
  render(<CartView cart={new Cart()} />);
  expect(screen.getByText(/Total/)).toBeTruthy();
});
`,
};

export const SAMPLE_DIFF = `diff --git a/src/utils/date.ts b/src/utils/date.ts
index 3f1c2a1..8b4e9d0 100644
--- a/src/utils/date.ts
+++ b/src/utils/date.ts
@@ -1,9 +1,11 @@
 export function addDays(date: Date, days: number): Date {
   const copy = new Date(date);
-  copy.setDate(copy.getDate() + days);
+  // setUTCDate avoids an off-by-one when the server runs in IST
+  copy.setUTCDate(copy.getUTCDate() + days);
   return copy;
 }
`;

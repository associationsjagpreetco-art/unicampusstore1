// Mock API (localStorage). Swap each function body for fetch("/api/...") when the Express backend is ready.
import type { Product, Coupon, Order } from "./types";
const P = (id: string, name: string, category: string, price: number, mrp: number, emoji: string, stock = 20): Product => ({ id, name, category, price: price * 100, mrp: mrp * 100, emoji, stock });
const products: Product[] = [
  P("1", "Classmate Notebook (6 pack)", "Stationery Essentials", 299, 360, "📓"),
  P("2", "Gel Pen Set (10)", "Stationery Essentials", 149, 200, "🖊️"),
  P("3", "Resistance Bands Set", "Gym Essentials", 449, 699, "🏋️"),
  P("4", "Shaker Bottle 700ml", "Gym Essentials", 249, 349, "🥤"),
  P("5", "Wireless Mouse", "Laptop Accessories", 599, 899, "🖱️"),
  P("6", "Laptop Stand (Foldable)", "Laptop Accessories", 799, 1199, "💻"),
  P("7", "Bucket & Mug Combo", "Hostel Essentials", 199, 280, "🪣"),
  P("8", "LED Study Lamp", "Hostel Essentials", 399, 599, "💡", 0),
];
const coupons: Coupon[] = [
  { code: "STUDENT10", type: "percent", value: 10, minOrder: 0 },
  { code: "FLAT50", type: "flat", value: 5000, minOrder: 29900 },
];
const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 250));
const read = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) || "") as T; } catch { return d; } };
export const api = {
  products: () => wait(products),
  async validateCoupon(code: string, subtotal: number) {
    const c = coupons.find((x) => x.code === code.trim().toUpperCase());
    if (!c) throw new Error("Invalid coupon code");
    if (subtotal < c.minOrder) throw new Error(`Minimum order ₹${c.minOrder / 100} required`);
    return wait({ code: c.code, discount: c.type === "percent" ? Math.round((subtotal * c.value) / 100) : c.value });
  },
  async placeOrder(o: Omit<Order, "id" | "date" | "status">) {
    const order: Order = { ...o, id: "UC" + Date.now().toString().slice(-6), date: new Date().toISOString(), status: "Placed" };
    localStorage.setItem("uc_orders", JSON.stringify([order, ...read<Order[]>("uc_orders", [])]));
    return wait(order);
  },
  orders: () => wait(read<Order[]>("uc_orders", [])),
};

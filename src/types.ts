export type Product = { id: string; name: string; category: string; price: number; mrp: number; stock: number; emoji: string; image?: string };
export type CartLine = { id: string; qty: number };
export type Coupon = { code: string; type: "percent" | "flat"; value: number; minOrder: number };
export type Order = { id: string; date: string; items: { name: string; qty: number; price: number }[]; total: number; discount: number; status: string; address: string };
export const rupees = (paise: number) => "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });

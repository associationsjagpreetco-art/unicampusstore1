import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { CartLine, Product } from "./types";
type Ctx = { lines: CartLine[]; count: number; add: (p: Product) => void; setQty: (id: string, q: number) => void; clear: () => void; open: boolean; setOpen: (b: boolean) => void };
const C = createContext<Ctx>(null!);
export const useCart = () => useContext(C);
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => { try { return JSON.parse(localStorage.getItem("uc_cart") || "[]"); } catch { return []; } });
  const [open, setOpen] = useState(false);
  useEffect(() => localStorage.setItem("uc_cart", JSON.stringify(lines)), [lines]);
  const v = useMemo<Ctx>(() => ({
    lines, open, setOpen, count: lines.reduce((s, l) => s + l.qty, 0),
    add: (p) => setLines((ls) => { const l = ls.find((x) => x.id === p.id); return l ? ls.map((x) => (x.id === p.id ? { ...x, qty: Math.min(p.stock, x.qty + 1) } : x)) : [...ls, { id: p.id, qty: 1 }]; }),
    setQty: (id, q) => setLines((ls) => (q <= 0 ? ls.filter((x) => x.id !== id) : ls.map((x) => (x.id === id ? { ...x, qty: q } : x)))),
    clear: () => setLines([]),
  }), [lines, open]);
  return <C.Provider value={v}>{children}</C.Provider>;
}

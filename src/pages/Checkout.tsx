import { FormEvent, useState } from "react";
import { Link } from "wouter";
import { api } from "../api";
import { useCart } from "../store";
import { Order, Product, rupees } from "../types";
export default function Checkout({ products }: { products: Product[] }) {
  const { lines, clear } = useCart();
  const items = lines.map((l) => ({ qty: l.qty, p: products.find((p) => p.id === l.id)! })).filter((i) => i.p);
  const sub = items.reduce((s, i) => s + i.p.price * i.qty, 0);
  const [code, setCode] = useState(""); const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [done, setDone] = useState<Order | null>(null);
  const [f, setF] = useState({ name: "", phone: "", hostel: "", room: "" });
  const discount = applied?.discount ?? 0; const delivery = sub - discount >= 49900 || sub === 0 ? 0 : 2900; const total = sub - discount + delivery;
  const apply = async () => { setErr(""); try { setApplied(await api.validateCoupon(code, sub)); } catch (e) { setApplied(null); setErr((e as Error).message); } };
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true);
    const o = await api.placeOrder({ items: items.map((i) => ({ name: i.p.name, qty: i.qty, price: i.p.price })), total, discount, address: `${f.name}, ${f.phone} · ${f.hostel}, Room ${f.room}` });
    clear(); setDone(o); setBusy(false); };
  if (done) return <div className="panel center"><h1>🎉 Order placed!</h1><p>Order <b>#{done.id}</b> · Pay <b>{rupees(done.total)}</b> on delivery.</p><Link href="/orders" className="btn">View orders</Link></div>;
  if (items.length === 0) return <p className="empty">Your cart is empty. <Link href="/">Browse products</Link></p>;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (<form className="checkout" onSubmit={submit}>
    <section className="panel"><h2>Delivery details</h2>
      <input required placeholder="Full name" autoComplete="name" value={f.name} onChange={set("name")} />
      <input required type="tel" inputMode="numeric" pattern="[0-9]{10}" placeholder="Phone (10 digits)" autoComplete="tel" value={f.phone} onChange={set("phone")} />
      <input required placeholder="Hostel / Block" value={f.hostel} onChange={set("hostel")} />
      <input required placeholder="Room number" value={f.room} onChange={set("room")} />
      <p className="note">💵 Payment: Cash on delivery</p></section>
    <section className="panel"><h2>Summary</h2>
      {items.map((i) => <div className="row" key={i.p.id}><span>{i.p.name} × {i.qty}</span><span>{rupees(i.p.price * i.qty)}</span></div>)}
      <div className="coupon"><input placeholder="Coupon code" value={code} onChange={(e) => setCode(e.target.value)} /><button type="button" className="btn ghost" onClick={apply} disabled={!code}>Apply</button></div>
      {err && <p className="err">{err}</p>}{applied && <p className="ok">✓ {applied.code} applied</p>}
      {discount > 0 && <div className="row ok"><span>Discount</span><span>−{rupees(discount)}</span></div>}
      <div className="row"><span>Delivery</span><span>{delivery ? rupees(delivery) : "Free"}</span></div>
      <div className="row tot"><span>Total</span><span>{rupees(total)}</span></div>
      <button className="btn" disabled={busy}>{busy ? "Placing…" : "Place order"}</button></section>
  </form>);
}

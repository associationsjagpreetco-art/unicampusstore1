import { useLocation } from "wouter";
import { useCart } from "../store";
import { Product, rupees } from "../types";
export default function CartDrawer({ products }: { products: Product[] }) {
  const { lines, open, setOpen, setQty } = useCart(); const [, nav] = useLocation();
  const items = lines.map((l) => ({ ...l, p: products.find((p) => p.id === l.id)! })).filter((i) => i.p);
  const sub = items.reduce((s, i) => s + i.p.price * i.qty, 0);
  return (<>
    <div className={open ? "scrim on" : "scrim"} onClick={() => setOpen(false)} />
    <aside className={open ? "drawer on" : "drawer"} aria-hidden={!open}>
      <div className="d-head"><h2>Your cart</h2><button className="x" aria-label="Close" onClick={() => setOpen(false)}>✕</button></div>
      <div className="d-body">{items.length === 0 ? <p className="empty">Your cart is empty.</p> : items.map(({ p, qty }) => (
        <div className="line" key={p.id}><span className="em">{p.emoji}</span>
          <div><h4>{p.name}</h4><b>{rupees(p.price * qty)}</b></div>
          <div className="qty"><button aria-label="Decrease" onClick={() => setQty(p.id, qty - 1)}>−</button><span>{qty}</span><button aria-label="Increase" disabled={qty >= p.stock} onClick={() => setQty(p.id, qty + 1)}>+</button></div></div>))}</div>
      {items.length > 0 && <div className="d-foot"><div className="row"><span>Subtotal</span><b>{rupees(sub)}</b></div>
        <button className="btn" onClick={() => { setOpen(false); nav("/checkout"); }}>Checkout</button></div>}
    </aside></>);
}

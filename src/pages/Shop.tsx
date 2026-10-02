import { useMemo, useState } from "react";
import { Product, rupees } from "../types";
import { useCart } from "../store";
export default function Shop({ products }: { products: Product[] | null }) {
  const [q, setQ] = useState(""); const [cat, setCat] = useState("All"); const { add, lines, setOpen } = useCart();
  const cats = useMemo(() => ["All", ...new Set((products ?? []).map((p) => p.category))], [products]);
  const list = (products ?? []).filter((p) => (cat === "All" || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase()));
  return (<>
    <section className="hero"><h1>Everything you need on campus.</h1><p>Stationery, gym, laptop &amp; hostel essentials — delivered to you.</p>
      <input className="search" type="search" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} /></section>
    <div className="chips">{cats.map((c) => <button key={c} className={c === cat ? "chip on" : "chip"} onClick={() => setCat(c)}>{c}</button>)}</div>
    {!products ? <div className="grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="card skel" />)}</div>
      : list.length === 0 ? <p className="empty">No products found.</p>
      : <div className="grid">{list.map((p) => {
          const off = Math.round(((p.mrp - p.price) / p.mrp) * 100); const out = p.stock === 0; const inCart = lines.find((l) => l.id === p.id);
          return (<article className="card" key={p.id}>
            <div className="img">{p.image ? <img src={p.image} alt={p.name} loading="lazy" /> : <span>{p.emoji}</span>}{off > 0 && <em>{off}% off</em>}</div>
            <small>{p.category}</small><h3>{p.name}</h3>
            <div className="price"><b>{rupees(p.price)}</b><s>{rupees(p.mrp)}</s></div>
            <button className="btn" disabled={out || inCart?.qty === p.stock} onClick={() => { add(p); if (!inCart) setOpen(true); }}>{out ? "Out of stock" : inCart ? `In cart (${inCart.qty}) · Add more` : "Add to cart"}</button>
          </article>);
        })}</div>}
  </>);
}

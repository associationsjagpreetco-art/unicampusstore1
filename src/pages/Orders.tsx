import { useEffect, useState } from "react";
import { api } from "../api";
import { Order, rupees } from "../types";
export default function Orders() {
  const [o, setO] = useState<Order[] | null>(null);
  useEffect(() => { api.orders().then(setO); }, []);
  if (!o) return <p className="empty">Loading…</p>;
  if (!o.length) return <p className="empty">No orders yet.</p>;
  return <div className="orders"><h1>Your orders</h1>{o.map((x) => (
    <div className="panel" key={x.id}><div className="row"><b>#{x.id}</b><span className="tag">{x.status}</span></div>
      <small>{new Date(x.date).toLocaleString("en-IN")}</small>
      {x.items.map((i, k) => <div className="row" key={k}><span>{i.name} × {i.qty}</span><span>{rupees(i.price * i.qty)}</span></div>)}
      <div className="row tot"><span>Total (COD)</span><span>{rupees(x.total)}</span></div></div>))}</div>;
}

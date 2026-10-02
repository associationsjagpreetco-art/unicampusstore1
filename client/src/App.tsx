import { createContext, lazy, Suspense, useContext, useEffect, useState, FormEvent } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { registerSchema, loginSchema, orderSchema, nextStatus } from "../../shared/schemas";

const api = async (p: string, o: any = {}) => {
  const r = await fetch("/api" + p, { credentials: "include", headers: { "Content-Type": "application/json" }, ...o, body: o.body && JSON.stringify(o.body) });
  const d = await r.json().catch(() => ({})); if (!r.ok) throw d; return d;
};
const rs = (p: number) => "₹" + (p / 100).toLocaleString("en-IN");
type Item = { productId: string; name: string; image: string; price: number; stock: number; qty: number };
const Ctx = createContext<any>(null); const useApp = () => useContext(Ctx);
const errs = (e: any) => (e?.fields ?? {}) as Record<string, string[]>;
const Field = ({ n, label, e, ...p }: any) => (<label className="block mb-3 text-sm">{label}<input name={n} className="inp mt-1" {...p} />{e?.[n] && <span className="text-red-600">{e[n][0]}</span>}</label>);

function Provider({ children }: any) {
  const qc = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [cart, setCartState] = useState<Item[]>(() => JSON.parse(localStorage.getItem("cart") || "[]"));
  const [toast, setToast] = useState("");
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2500); };
  const setCart = (c: Item[]) => { setCartState(c); localStorage.setItem("cart", JSON.stringify(c)); if (user) api("/cart", { method: "PUT", body: { items: c.map((i) => ({ productId: i.productId, qty: i.qty })) } }).catch(() => {}); };
  useEffect(() => { api("/auth/me").then(setUser).catch(() => {}); }, []);
  const afterLogin = async (u: any) => { setUser(u); const c = await api("/cart/merge", { method: "POST", body: { items: cart.map((i) => ({ productId: i.productId, qty: i.qty })) } }); setCartState(c); localStorage.setItem("cart", JSON.stringify(c)); qc.invalidateQueries(); };
  const logout = async () => { await api("/auth/logout", { method: "POST" }); setUser(null); setCartState([]); localStorage.removeItem("cart"); };
  const add = (p: any) => { const ex = cart.find((i) => i.productId === p._id);
    if (p.stock < 1 || (ex && ex.qty >= Math.min(20, p.stock))) return say("No more stock available");
    setCart(ex ? cart.map((i) => (i === ex ? { ...i, qty: i.qty + 1 } : i)) : [...cart, { productId: p._id, name: p.name, image: p.image, price: p.price, stock: p.stock, qty: 1 }]); say("Added to cart"); };
  return <Ctx.Provider value={{ user, cart, setCart, add, say, afterLogin, logout }}>{children}{toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#245f4b] text-white rounded-full px-4 py-2">{toast}</div>}</Ctx.Provider>;
}
function Header() {
  const { user, cart, logout } = useApp();
  return (<header className="flex items-center gap-3 p-3 flex-wrap"><Link href="/" className="logo bg-[#245f4b] text-white rounded-xl px-3 py-1 text-xl">UC</Link>
    <Link href="/track">Track</Link><span className="flex-1" />
    {user?.role === "admin" && <Link href="/admin">Admin</Link>}
    {user ? <><Link href="/orders">Orders</Link><button onClick={logout}>Logout</button></> : <Link href="/login">Login</Link>}
    <Link href="/cart" className="relative">🛒{cart.length > 0 && <b className="absolute -top-2 -right-3 bg-[#e67d5d] text-white rounded-full text-xs px-1.5">{cart.reduce((t: number, i: Item) => t + i.qty, 0)}</b>}</Link></header>);
}
const Skel = () => <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[...Array(8)].map((_, i) => <div key={i} className="card h-56 animate-pulse" />)}</div>;

function Shop() {
  const { add } = useApp(); const [q, setQ] = useState(""); const [category, setC] = useState(""); const [sort, setS] = useState("");
  const cats = useQuery({ queryKey: ["cats"], queryFn: () => api("/categories") });
  const ps = useQuery({ queryKey: ["p", q, category, sort], queryFn: () => api(`/products?${new URLSearchParams({ q, category, sort })}`) });
  return (<main className="p-3 max-w-6xl mx-auto"><h1 className="text-3xl font-extrabold mb-2">Campus essentials, delivered to your hostel</h1><p className="mb-3">Pay cash when your order arrives.</p>
    <input className="inp rounded-full mb-3" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
    <div className="flex gap-2 overflow-x-auto mb-3">{["", ...(cats.data ?? [])].map((c: string) => <button key={c} onClick={() => setC(c)} className={"btn2 whitespace-nowrap " + (c === category ? "bg-[#245f4b] text-white" : "")}>{c || "All"}</button>)}
      <select className="btn2" value={sort} onChange={(e) => setS(e.target.value)}><option value="">Recommended</option><option value="price-asc">Price low-high</option><option value="price-desc">Price high-low</option></select></div>
    {ps.isLoading ? <Skel /> : ps.isError ? <button className="btn" onClick={() => ps.refetch()}>Failed to load. Retry</button> : !ps.data.length ? <p>No products found.</p> :
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{ps.data.map((p: any) => (<div key={p._id} className="card flex flex-col">
        <Link href={`/p/${p._id}`}><img src={p.image} width={400} height={400} loading="lazy" className="rounded-xl w-full aspect-square object-cover" /><h3 className="font-bold text-sm mt-2">{p.name}</h3></Link>
        <div>{rs(p.price)} <s className="text-xs opacity-60">{rs(p.mrp)}</s></div><div className="text-xs mb-2">{p.stock === 0 ? "Out of stock" : p.stock < 6 ? `Only ${p.stock} left` : "In stock"}</div>
        <button className="btn mt-auto" disabled={!p.stock} onClick={() => add(p)}>Add to cart</button></div>))}</div>}</main>);
}
function Product({ params }: any) {
  const { add } = useApp(); const [, nav] = useLocation(); const p = useQuery({ queryKey: ["p", params.id], queryFn: () => api("/products/" + params.id) });
  if (p.isLoading) return <Skel />; if (p.isError) return <p className="p-3">Product not found.</p>; const d = p.data;
  return (<main className="p-3 max-w-3xl mx-auto pb-24"><img src={d.image} width={400} height={400} className="rounded-2xl w-full" /><h1 className="text-2xl font-extrabold mt-3">{d.name}</h1><p>{rs(d.price)} · ⭐ {d.rating.toFixed(1)} ({d.reviews})</p><p className="my-2">{d.description}</p>
    <div className="fixed bottom-0 inset-x-0 p-3 flex gap-2 bg-[var(--bg)]"><button className="btn flex-1" disabled={!d.stock} onClick={() => add(d)}>Add to cart</button><button className="btn flex-1 !bg-[#1f3445]" disabled={!d.stock} onClick={() => { add(d); nav("/cart"); }}>Buy now</button></div></main>);
}
function Cart() {
  const { cart, setCart, user, say } = useApp(); const [, nav] = useLocation(); const [e, setE] = useState<any>({}); const [busy, setBusy] = useState(false);
  const live = useQuery({ queryKey: ["live", cart.length], queryFn: () => Promise.all(cart.map((i: Item) => api("/products/" + i.productId))) });
  const price = (i: Item) => live.data?.find((p: any) => p._id === i.productId) ?? i;
  const total = cart.reduce((t: number, i: Item) => t + price(i).price * i.qty, 0);
  const changed = cart.some((i: Item) => price(i).price !== i.price || price(i).stock < i.qty);
  const submit = async (ev: FormEvent<HTMLFormElement>) => { ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.currentTarget)) as any;
    const body = { ...f, items: cart.map((i: Item) => ({ productId: i.productId, qty: i.qty })) }; const v = orderSchema.safeParse(body);
    if (!v.success) return setE(v.error.flatten().fieldErrors); setBusy(true);
    try { const o = await api("/orders", { method: "POST", body }); setCart([]); say("Order placed!"); nav(`/track?orderCode=${o.orderCode}&email=${encodeURIComponent(f.email)}`); }
    catch (x: any) { setE(errs(x)); say(x.error || "Failed"); } finally { setBusy(false); } };
  if (!cart.length) return <p className="p-3">Your cart is empty. <Link href="/" className="underline">Shop now</Link></p>;
  return (<main className="p-3 max-w-xl mx-auto">{cart.map((i: Item) => <div key={i.productId} className="card flex gap-2 mb-2 items-center"><img src={i.image} width={56} height={56} className="rounded-lg" /><div className="flex-1 text-sm">{i.name}<br />{rs(price(i).price)}</div>
    <button className="btn2" onClick={() => setCart(cart.map((x: Item) => x === i ? { ...x, qty: x.qty - 1 } : x).filter((x: Item) => x.qty > 0))}>−</button>{i.qty}
    <button className="btn2" onClick={() => i.qty < Math.min(20, price(i).stock) ? setCart(cart.map((x: Item) => x === i ? { ...x, qty: x.qty + 1 } : x)) : say("Stock limit reached")}>+</button></div>)}
    {changed && <p className="text-[#e67d5d]">Some prices or stock changed. Totals are recalculated at checkout.</p>}
    <p className="font-bold my-2">Total {rs(total)}</p><p className="card mb-3">💵 Pay cash when your order arrives.</p>
    <form onSubmit={submit}><Field n="name" label="Name" e={e} defaultValue={user?.name} /><Field n="email" label="Email" e={e} defaultValue={user?.email} /><Field n="phone" label="Phone" e={e} inputMode="numeric" />
      <Field n="hostel" label="Hostel / Block" e={e} /><Field n="room" label="Room" e={e} /><Field n="notes" label="Delivery notes" e={e} />{e.items && <p className="text-red-600">{e.items[0]}</p>}
      <button className="btn w-full" disabled={busy}>{busy ? "Placing..." : "Place order (Cash on delivery)"}</button></form></main>);
}
function Auth({ mode }: { mode: "login" | "register" }) {
  const { afterLogin } = useApp(); const [, nav] = useLocation(); const [e, setE] = useState<any>({}); const [msg, setMsg] = useState("");
  const submit = async (ev: FormEvent<HTMLFormElement>) => { ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.currentTarget));
    const v = (mode === "login" ? loginSchema : registerSchema).safeParse(f); if (!v.success) return setE(v.error.flatten().fieldErrors);
    try { await afterLogin(await api("/auth/" + mode, { method: "POST", body: f })); nav("/"); } catch (x: any) { setE(errs(x)); setMsg(x.error || "Failed"); } };
  return (<form onSubmit={submit} className="p-3 max-w-sm mx-auto"><h1 className="text-2xl font-extrabold mb-3">{mode === "login" ? "Login" : "Create account"}</h1>
    {mode === "register" && <><Field n="name" label="Name" e={e} /><Field n="phone" label="Phone" e={e} /></>}<Field n="email" label="Email" e={e} /><Field n="password" label="Password" type="password" e={e} />
    {msg && <p className="text-red-600 mb-2">{msg}</p>}<button className="btn w-full">{mode === "login" ? "Login" : "Register"}</button>
    <p className="mt-3 text-sm">{mode === "login" ? <Link href="/register" className="underline">New here? Register</Link> : <Link href="/login" className="underline">Have an account? Login</Link>}</p></form>);
}
const Timeline = ({ o }: any) => (<div className="card"><h2 className="font-bold">Order {o.orderCode} · {rs(o.total)} · Cash on delivery ({o.paymentStatus})</h2>{o.statusHistory.map((h: any, i: number) => <p key={i}>✅ {h.status} <small>{new Date(h.at).toLocaleString()}</small></p>)}</div>);
function Track() {
  const init = new URLSearchParams(location.search); const [f, setF] = useState({ orderCode: init.get("orderCode") ?? "", email: init.get("email") ?? "" });
  const [go, setGo] = useState(!!init.get("orderCode")); const o = useQuery({ queryKey: ["t", go, f], queryFn: () => api(`/orders/track?${new URLSearchParams(f)}`), enabled: go, retry: false });
  return (<main className="p-3 max-w-md mx-auto"><h1 className="text-2xl font-extrabold mb-3">Track your order</h1>
    <input className="inp mb-2" placeholder="Order code (UC-XXXXXX)" value={f.orderCode} onChange={(e) => setF({ ...f, orderCode: e.target.value.trim() })} />
    <input className="inp mb-2" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value.trim() })} /><button className="btn w-full mb-3" onClick={() => setGo(true)}>Track</button>
    {o.isError && <p className="text-red-600">Order not found.</p>}{o.data && <Timeline o={o.data} />}</main>);
}
function Orders() {
  const { say } = useApp(); const qc = useQueryClient(); const o = useQuery({ queryKey: ["mine"], queryFn: () => api("/account/orders") });
  if (o.isLoading) return <Skel />; if (o.isError) return <p className="p-3">Please login to see orders.</p>; if (!o.data.length) return <p className="p-3">No orders yet.</p>;
  return (<main className="p-3 max-w-xl mx-auto space-y-3">{o.data.map((x: any) => <div key={x._id}><Timeline o={x} />{x.status === "confirmed" && <button className="btn2 mt-1" onClick={async () => { try { await api(`/account/orders/${x._id}/cancel`, { method: "POST" }); say("Cancelled"); qc.invalidateQueries({ queryKey: ["mine"] }); } catch (e: any) { say(e.error); } }}>Cancel order</button>}</div>)}</main>);
}
function Admin() {
  const { user, say } = useApp(); const qc = useQueryClient(); const d = useQuery({ queryKey: ["dash"], queryFn: () => api("/admin/dashboard"), enabled: user?.role === "admin" });
  const os = useQuery({ queryKey: ["ao"], queryFn: () => api("/admin/orders"), enabled: user?.role === "admin" });
  const ps = useQuery({ queryKey: ["ap"], queryFn: () => api("/admin/products"), enabled: user?.role === "admin" });
  if (user?.role !== "admin") return <p className="p-3">Admins only.</p>;
  const act = async (p: string, body?: any) => { try { await api(p, { method: "PATCH", body }); qc.invalidateQueries(); } catch (e: any) { say(e.error); } };
  return (<main className="p-3 max-w-4xl mx-auto"><h1 className="text-2xl font-extrabold">Dashboard</h1>
    {d.data && <p className="my-2">Today: {d.data.todayOrders} · To collect {rs(d.data.cashToCollect)} · Collected {rs(d.data.cashCollected)} · Pending deliveries {d.data.pendingDeliveries}</p>}
    <h2 className="font-bold mt-3">Orders</h2>{os.data?.map((o: any) => <div key={o._id} className="card my-1 text-sm">{o.orderCode} · {o.customer.name} · {o.customer.hostel}/{o.customer.room} · {rs(o.total)} · {o.status} · {o.paymentStatus}
      {nextStatus(o.status) && <button className="btn2 ml-2" onClick={() => act(`/admin/orders/${o._id}/status`, { status: nextStatus(o.status) })}>→ {nextStatus(o.status)}</button>}
      {o.status === "delivered" && o.paymentStatus === "pending" && <button className="btn2 ml-2" onClick={() => act(`/admin/orders/${o._id}/collect`)}>Mark cash collected</button>}</div>)}
    <h2 className="font-bold mt-3">Products (low stock first)</h2>{ps.data?.slice().sort((a: any, b: any) => a.stock - b.stock).map((p: any) => <div key={p._id} className="card my-1 text-sm">{p.name} · stock {p.stock}
      <button className="btn2 ml-2" onClick={() => { const s = prompt("New stock", p.stock); if (s !== null) act(`/admin/products/${p._id}`, { stock: Number(s) }); }}>Edit stock</button></div>)}</main>);
}
export default function App() {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  return (<QueryClientProvider client={qc}><Provider><Header /><Switch><Route path="/" component={Shop} /><Route path="/p/:id" component={Product} /><Route path="/cart" component={Cart} />
    <Route path="/login">{() => <Auth mode="login" />}</Route><Route path="/register">{() => <Auth mode="register" />}</Route><Route path="/track" component={Track} /><Route path="/orders" component={Orders} />
    <Route path="/admin" component={Admin} /><Route>Not found</Route></Switch></Provider></QueryClientProvider>);
}

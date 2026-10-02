import { useEffect, useState } from "react";
import { Link, Route, Switch } from "wouter";
import { api } from "./api";
import { useCart } from "./store";
import { Product, rupees } from "./types";
import Shop from "./pages/Shop";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import CartDrawer from "./components/CartDrawer";

export default function App() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const { count, setOpen } = useCart();
  useEffect(() => { api.products().then(setProducts); }, []);
  return (
    <>
      <header className="nav"><div className="wrap nav-in">
        <Link href="/" className="logo">Uni<span>Campus</span></Link>
        <nav><Link href="/orders">Orders</Link>
          <button className="cart-btn" aria-label="Open cart" onClick={() => setOpen(true)}>🛒{count > 0 && <b>{count}</b>}</button></nav>
      </div></header>
      <main className="wrap">
        <Switch>
          <Route path="/"><Shop products={products} /></Route>
          <Route path="/checkout"><Checkout products={products ?? []} /></Route>
          <Route path="/orders"><Orders /></Route>
          <Route><p className="empty">Page not found. <Link href="/">Go to shop</Link></p></Route>
        </Switch>
      </main>
      <footer className="foot">Cash on delivery · Free campus delivery over {rupees(49900)}</footer>
      <CartDrawer products={products ?? []} />
    </>
  );
}

import express, { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { ZodSchema, z } from "zod";
import { User, Product, Order, Cart } from "./models.js";
import { registerSchema, loginSchema, orderSchema, statusSchema, nextStatus } from "../../shared/schemas.js";

const { JWT_SECRET = "", CLIENT_URL = "", MONGODB_URI = "", ADMIN_EMAILS = "", MAX_COD_PAISE = "500000" } = process.env;
if (!JWT_SECRET || !MONGODB_URI) throw new Error("JWT_SECRET and MONGODB_URI are required");
class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }
const wrap = (f: (req: Request, res: Response) => Promise<any>) => (req: Request, res: Response, n: NextFunction) => f(req, res).catch(n);

// strip $-keys and dotted keys (operator injection)
const strip = (v: any): any => Array.isArray(v) ? v.map(strip) : v && typeof v === "object"
  ? Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith("$") && !k.includes(".")).map(([k, x]) => [k, strip(x)])) : v;
const parse = <T>(s: ZodSchema<T>, data: unknown): T => {
  const r = s.safeParse(strip(data));
  if (!r.success) throw Object.assign(new HttpError(400, "Validation failed"), { fields: r.error.flatten().fieldErrors });
  return r.data;
};
const mw = (role?: "admin") => (req: Request, _res: Response, next: NextFunction) => (async () => {
  let id: string;
  try { id = (jwt.verify(req.cookies.token, JWT_SECRET) as any).id; } catch { throw new HttpError(401, "Please sign in"); }
  const u = await User.findById(id);
  if (!u) throw new HttpError(401, "Please sign in");
  if (role && u.role !== role) throw new HttpError(403, "Forbidden");
  (req as any).uid = id; (req as any).user = u;
})().then(() => next(), next);
const limiter = (max = 5) => rateLimit({ windowMs: 15 * 60_000, max, keyGenerator: (r) => `${r.ip}:${r.body?.email ?? ""}` });

const app = express();
app.set("trust proxy", 1);
app.use(helmet(), compression(), cors({ origin: CLIENT_URL, credentials: true }), express.json({ limit: "100kb" }), cookieParser());
const api = express.Router();
app.use("/api", api);

api.get("/health", (_q, r) => r.json({ ok: true }));
api.get("/categories", (_q, r) => r.json(["Stationery Essentials", "Gym Essentials", "Laptop Accessories", "Hostel Essentials"]));
api.get("/products", wrap(async (q, r) => {
  const { q: s, category, sort } = strip(q.query) as Record<string, string>;
  const f: any = { active: true };
  if (category) f.category = String(category);
  if (s) f.$text = { $search: String(s).slice(0, 80) };
  const order: any = sort === "price-asc" ? { price: 1 } : sort === "price-desc" ? { price: -1 } : { rating: -1 };
  r.json(await Product.find(f).sort(order).limit(100).lean());
}));
api.get("/products/:id", wrap(async (q, r) => {
  if (!mongoose.isValidObjectId(q.params.id)) throw new HttpError(400, "Invalid id");
  const p = await Product.findById(q.params.id).lean();
  if (!p) throw new HttpError(404, "Not found");
  r.json(p);
}));

const setCookie = (res: Response, id: string) =>
  res.cookie("token", jwt.sign({ id }, JWT_SECRET, { expiresIn: "7d" }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 864e5 });
api.post("/auth/register", limiter(), wrap(async (q, r) => {
  const d = parse(registerSchema, q.body);
  if (await User.exists({ email: d.email })) throw new HttpError(409, "Email already registered");
  const role = ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()).includes(d.email) ? "admin" : "student";
  const u = await User.create({ ...d, passwordHash: await bcrypt.hash(d.password, 12), role });
  setCookie(r, u.id); r.status(201).json({ id: u.id, name: u.name, role });
}));
api.post("/auth/login", limiter(), wrap(async (q, r) => {
  const d = parse(loginSchema, q.body);
  const u = await User.findOne({ email: d.email });
  if (u?.lockUntil && u.lockUntil > new Date()) throw new HttpError(429, "Too many attempts. Try again later");
  if (!u || !(await bcrypt.compare(d.password, u.passwordHash!))) {
    if (u) { u.failed += 1; if (u.failed >= 5) { u.lockUntil = new Date(Date.now() + 15 * 60_000); u.failed = 0; } await u.save(); }
    throw new HttpError(401, "Email or password is incorrect");
  }
  u.failed = 0; u.lockUntil = undefined; await u.save();
  setCookie(r, u.id); r.json({ id: u.id, name: u.name, role: u.role });
}));
api.post("/auth/logout", (_q, r) => r.clearCookie("token").json({ ok: true }));
api.get("/auth/me", mw(), (q, r) => { const u = (q as any).user; r.json({ id: u.id, name: u.name, email: u.email, role: u.role }); });

const optionalUid = (req: Request) => { try { return (jwt.verify(req.cookies.token, JWT_SECRET) as any).id; } catch { return undefined; } };
api.post("/orders", limiter(20), wrap(async (q, r) => {
  const d = parse(orderSchema, q.body);
  const session = await mongoose.startSession();
  try {
    let order: any;
    await session.withTransaction(async () => {
      const items = []; let total = 0;
      for (const it of d.items) {
        // atomic conditional decrement: overselling impossible
        const p = await Product.findOneAndUpdate({ _id: it.productId, active: true, stock: { $gte: it.qty } },
          { $inc: { stock: -it.qty } }, { session, new: true });
        if (!p) throw new HttpError(409, "An item is out of stock or unavailable");
        items.push({ productId: p._id, name: p.name, image: p.image, price: p.price, qty: it.qty });
        total += p.price! * it.qty;
      }
      if (total > Number(MAX_COD_PAISE)) throw new HttpError(400, "Order exceeds the cash-on-delivery limit");
      [order] = await Order.create([{
        orderCode: "UC-" + crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase(), userId: optionalUid(q), email: d.email,
        customer: { name: d.name, phone: d.phone, hostel: d.hostel, room: d.room, notes: d.notes },
        items, total, statusHistory: [{ status: "confirmed", at: new Date() }],
      }], { session });
    });
    r.status(201).json(order);
  } finally { await session.endSession(); }
}));
api.get("/orders/track", wrap(async (q, r) => {
  const { orderCode, email } = strip(q.query) as Record<string, string>;
  const o = await Order.findOne({ orderCode: String(orderCode), email: String(email).toLowerCase() }).lean();
  if (!o) throw new HttpError(404, "Order not found");
  r.json(o);
}));
api.get("/account/orders", mw(), wrap(async (q, r) => r.json(await Order.find({ userId: (q as any).uid }).sort({ createdAt: -1 }).lean())));

export async function cancelOrder(id: string, filter: object) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const o = await Order.findOneAndUpdate({ _id: id, status: "confirmed", ...filter },
        { status: "cancelled", $push: { statusHistory: { status: "cancelled", at: new Date() } } }, { session });
      if (!o) throw new HttpError(409, "Order can no longer be cancelled");
      for (const it of o.items) await Product.updateOne({ _id: it.productId }, { $inc: { stock: it.qty } }, { session });
    });
  } finally { await session.endSession(); }
}
api.post("/account/orders/:id/cancel", mw(), wrap(async (q, r) => {
  if (!mongoose.isValidObjectId(q.params.id)) throw new HttpError(400, "Invalid id");
  await cancelOrder(q.params.id, { userId: (q as any).uid }); r.json({ ok: true });
}));

api.patch("/admin/orders/:id/status", mw("admin"), wrap(async (q, r) => {
  const { status } = parse(statusSchema, q.body);
  const o = await Order.findById(q.params.id);
  if (!o) throw new HttpError(404, "Not found");
  if (status === "cancelled") { await cancelOrder(o.id, {}); return r.json({ ok: true }); }
  if (nextStatus(o.status!) !== status) throw new HttpError(409, `Cannot move from ${o.status} to ${status}`);
  o.status = status; o.statusHistory.push({ status, at: new Date() } as any); await o.save(); r.json(o);
}));
api.patch("/admin/orders/:id/collect", mw("admin"), wrap(async (q, r) => {
  const o = await Order.findOneAndUpdate({ _id: q.params.id, status: "delivered", paymentStatus: "pending" },
    { paymentStatus: "collected", collectedAt: new Date() }, { new: true });
  if (!o) throw new HttpError(409, "Order must be delivered and unpaid");
  r.json(o);
}));

const cartSchema = z.object({ items: z.array(z.object({ productId: z.string().regex(/^[a-f\d]{24}$/i), qty: z.number().int().min(1).max(20) })).max(50) });
const cartView = async (uid: string) => {
  const c = await Cart.findOne({ userId: uid }).lean(); const items = c?.items ?? [];
  const ps = await Product.find({ _id: { $in: items.map((i) => i.productId) }, active: true }).lean();
  return items.flatMap((i) => { const p = ps.find((x) => String(x._id) === String(i.productId)); if (!p) return [];
    const qty = Math.min(i.qty!, p.stock as number); return qty > 0 ? [{ productId: String(p._id), name: p.name, image: p.image, price: p.price, stock: p.stock, qty }] : []; });
};
api.get("/cart", mw(), wrap(async (q, r) => r.json(await cartView((q as any).uid))));
api.put("/cart", mw(), wrap(async (q, r) => {
  const d = parse(cartSchema, q.body); await Cart.updateOne({ userId: (q as any).uid }, { items: d.items }, { upsert: true }); r.json(await cartView((q as any).uid));
}));
api.post("/cart/merge", mw(), wrap(async (q, r) => {
  const d = parse(cartSchema, q.body); const c = await Cart.findOne({ userId: (q as any).uid }); const m = new Map<string, number>();
  for (const i of [...(c?.items ?? []), ...d.items]) m.set(String(i.productId), Math.min(20, (m.get(String(i.productId)) ?? 0) + i.qty!));
  await Cart.updateOne({ userId: (q as any).uid }, { items: [...m].map(([productId, qty]) => ({ productId, qty })) }, { upsert: true }); r.json(await cartView((q as any).uid));
}));
const addrSchema = z.object({ hostel: z.string().trim().min(1).max(60), room: z.string().trim().min(1).max(60) });
api.get("/account/addresses", mw(), (q, r) => r.json((q as any).user.addresses));
api.post("/account/addresses", mw(), wrap(async (q, r) => { const u = (q as any).user; u.addresses.push(parse(addrSchema, q.body)); await u.save(); r.status(201).json(u.addresses); }));
api.delete("/account/addresses/:id", mw(), wrap(async (q, r) => { const u = (q as any).user; u.addresses.pull(q.params.id); await u.save(); r.json(u.addresses); }));

api.get("/admin/orders", mw("admin"), wrap(async (q, r) => {
  const { status } = strip(q.query) as Record<string, string>; r.json(await Order.find(status ? { status: String(status) } : {}).sort({ createdAt: -1 }).limit(200).lean());
}));
api.get("/admin/dashboard", mw("admin"), wrap(async (_q, r) => {
  const day = new Date(); day.setHours(0, 0, 0, 0); const os = await Order.find({ status: { $ne: "cancelled" } }).lean();
  const sum = (a: any[]) => a.reduce((t, o) => t + o.total, 0);
  r.json({ todayOrders: os.filter((o: any) => o.createdAt >= day).length, cashToCollect: sum(os.filter((o) => o.paymentStatus === "pending")),
    cashCollected: sum(os.filter((o) => o.paymentStatus === "collected")), pendingDeliveries: os.filter((o) => o.status !== "delivered").length,
    lowStock: await Product.find({ stock: { $lte: 5 } }).select("name stock").lean() });
}));
const prodSchema = z.object({ name: z.string().trim().min(2).max(120), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/), description: z.string().max(1000).default(""),
  category: z.enum(["Stationery Essentials", "Gym Essentials", "Laptop Accessories", "Hostel Essentials"]), price: z.number().int().min(1), mrp: z.number().int().min(1),
  stock: z.number().int().min(0), image: z.string().url(), badge: z.string().max(30).optional(), active: z.boolean().optional() });
api.get("/admin/products", mw("admin"), wrap(async (_q, r) => r.json(await Product.find().sort({ name: 1 }).lean())));
api.post("/admin/products", mw("admin"), wrap(async (q, r) => r.status(201).json(await Product.create({ rating: 4.5, reviews: 0, ...parse(prodSchema, q.body) }))));
api.patch("/admin/products/:id", mw("admin"), wrap(async (q, r) => r.json(await Product.findByIdAndUpdate(q.params.id, parse(prodSchema.partial(), q.body), { new: true }))));
api.delete("/admin/products/:id", mw("admin"), wrap(async (q, r) => { await Product.findByIdAndDelete(q.params.id); r.json({ ok: true }); }));

app.use((e: any, _q: Request, r: Response, _n: NextFunction) => {
  const status = e.status ?? 500;
  if (status === 500) console.error(e.message); // never log bodies or secrets
  r.status(status).json({ error: status === 500 ? "Something went wrong" : e.message, fields: e.fields });
});
if (process.env.NODE_ENV !== "test") mongoose.connect(MONGODB_URI).then(() => app.listen(Number(process.env.PORT) || 4000));
export default app;

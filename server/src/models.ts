import mongoose, { Schema } from "mongoose";
export const User = mongoose.model("User", new Schema({
  name: String, email: { type: String, unique: true, lowercase: true }, phone: String, passwordHash: String,
  role: { type: String, enum: ["student", "admin"], default: "student" },
  addresses: [{ hostel: String, room: String }], verified: { type: Boolean, default: false }, failed: { type: Number, default: 0 }, lockUntil: Date,
}, { timestamps: true }));
const p = new Schema({
  name: String, slug: { type: String, unique: true }, description: String, category: { type: String, index: true },
  price: Number, mrp: Number, stock: { type: Number, min: 0 }, image: String, badge: String,
  rating: Number, reviews: Number, active: { type: Boolean, default: true },
});
p.index({ name: "text", description: "text" });
export const Product = mongoose.model("Product", p);
export const Order = mongoose.model("Order", new Schema({
  orderCode: { type: String, unique: true }, userId: { type: Schema.Types.ObjectId, index: true }, email: { type: String, index: true },
  customer: { name: String, phone: String, hostel: String, room: String, notes: String },
  items: [{ productId: Schema.Types.ObjectId, name: String, image: String, price: Number, qty: Number }],
  total: Number, paymentMethod: { type: String, default: "cash-on-delivery" },
  paymentStatus: { type: String, enum: ["pending", "collected"], default: "pending" }, collectedAt: Date,
  status: { type: String, default: "confirmed" },
  statusHistory: [{ status: String, at: Date }],
}, { timestamps: true }));
export const Cart = mongoose.model("Cart", new Schema({ userId: { type: Schema.Types.ObjectId, unique: true }, items: [{ productId: Schema.Types.ObjectId, qty: Number }] }));

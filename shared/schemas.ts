import { z } from "zod";
const clean = (s: string) => s.replace(/<[^>]*>/g, "").trim();
const txt = (min: number, max: number) => z.string().transform(clean).pipe(z.string().min(min).max(max));
const email = z.string().trim().toLowerCase().email("Enter a valid email");
const phone = z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");
export const registerSchema = z.object({
  name: txt(2, 60), email, phone,
  password: z.string().min(8, "Min 8 characters").regex(/[A-Za-z]/, "Add a letter").regex(/\d/, "Add a number"),
});
export const loginSchema = z.object({ email, password: z.string().min(1) });
export const orderSchema = z.object({
  name: txt(2, 60), email, phone, hostel: txt(1, 60), room: txt(1, 60),
  notes: txt(0, 300).optional().default(""),
  items: z.array(z.object({
    productId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid product"),
    qty: z.number().int().min(1).max(20),
  })).min(1),
});
export const STATUS_FLOW = ["confirmed", "packed", "out-for-delivery", "delivered"] as const;
export const nextStatus = (s: string) => STATUS_FLOW[STATUS_FLOW.indexOf(s as any) + 1];
export const statusSchema = z.object({ status: z.enum([...STATUS_FLOW, "cancelled"]) });

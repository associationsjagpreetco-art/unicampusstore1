import mongoose from "mongoose";
import { Product } from "./models.js";
const data: Record<string, [string, number][]> = {
  "Stationery Essentials": [["A4 Ruled Notebook (Pack of 4)", 249], ["Gel Pens (Pack of 10)", 129], ["Highlighters (Set of 5)", 149], ["Spiral Sketchbook", 199], ["Sticky Notes Combo", 99], ["Geometry Box", 179], ["Stapler with Pins", 119], ["Desk Organizer", 299]],
  "Gym Essentials": [["Resistance Bands Set", 399], ["Shaker Bottle 700ml", 249], ["Gym Gloves", 349], ["Skipping Rope", 199], ["Yoga Mat 6mm", 599], ["Hand Gripper Pair", 179], ["Sports Towel", 229], ["Gym Duffel Bag", 799]],
  "Laptop Accessories": [["Laptop Stand (Aluminium)", 899], ["Wireless Mouse", 499], ["USB-C Hub 6-in-1", 1299], ["Laptop Sleeve 15.6in", 599], ["Cooling Pad", 999], ["Wired Earphones with Mic", 299], ["Webcam Cover (Pack of 3)", 79], ["Cable Organizer", 149]],
  "Hostel Essentials": [["Extension Board 4-Socket", 449], ["Study Lamp (Rechargeable)", 649], ["Bedsheet Single Cotton", 549], ["Steel Water Bottle 1L", 349], ["Laundry Bag", 199], ["Clothes Hanger (Pack of 12)", 179], ["Electric Kettle 1L", 799], ["Storage Bin Foldable", 399]],
};
const badges = ["Bestseller", "New", "", "Value pick"];
await mongoose.connect(process.env.MONGODB_URI!);
await Product.deleteMany({});
let n = 0;
await Product.insertMany(Object.entries(data).flatMap(([category, list]) => list.map(([name, rs]) => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); n++;
  return { name, slug, category, description: `${name} for everyday campus life. Delivered to your hostel, pay cash on delivery.`, price: rs * 100,
    mrp: Math.round(rs * 1.25) * 100, stock: 10 + (n * 7) % 40, image: `https://picsum.photos/seed/${slug}/400/400`, badge: badges[n % 4],
    rating: 4 + (n % 10) / 10, reviews: 12 + n * 9, active: true };
})));
console.log(`Seeded ${n} products`); await mongoose.disconnect();

import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { ROLES, ORDER_STATUS } from "../utils/constants.js";

const sampleProducts = [
  ["Farm Tomatoes", "Fresh red tomatoes", 48, 45, "Produce", "1 kg"],
  ["Alphonso Mangoes", "Seasonal sweet mangoes", 260, 18, "Produce", "1 dozen"],
  ["Organic Spinach", "Washed leafy spinach", 35, 50, "Produce", "1 bunch"],
  ["Amul Toned Milk", "Pasteurised toned milk", 29, 80, "Dairy", "500 ml"],
  ["Farm Eggs", "Country eggs", 96, 55, "Dairy", "6 pack"],
  ["Paneer", "Fresh soft paneer", 89, 28, "Dairy", "200 g"],
  ["Basmati Rice", "Aged long grain rice", 145, 65, "Staples", "1 kg"],
  ["Toor Dal", "Unpolished pigeon pea lentils", 132, 42, "Staples", "1 kg"],
  ["Atta", "Whole wheat flour", 58, 70, "Staples", "1 kg"],
  ["Poha", "Thick flattened rice", 48, 34, "Staples", "500 g"],
  ["Cooking Oil", "Sunflower cooking oil", 154, 38, "Staples", "1 L"],
  ["Jaggery", "Natural cane jaggery", 72, 24, "Staples", "500 g"],
  ["Bananas", "Naturally ripened bananas", 42, 64, "Produce", "1 dozen"],
  ["Onions", "Red onions", 38, 90, "Produce", "1 kg"],
  ["Potatoes", "Table potatoes", 32, 88, "Produce", "1 kg"],
  ["Green Chillies", "Fresh green chillies", 22, 30, "Produce", "250 g"],
  ["Curd", "Set curd", 35, 36, "Dairy", "400 g"],
  ["Butter", "Salted table butter", 58, 27, "Dairy", "100 g"],
  ["Masala Chai", "Assam tea with warming spices", 110, 42, "Beverages", "250 g"],
  ["Filter Coffee", "South Indian filter coffee blend", 165, 32, "Beverages", "200 g"],
  ["Roasted Peanuts", "Lightly salted peanuts", 54, 39, "Snacks", "250 g"],
  ["Murukku", "Crunchy rice flour snack", 75, 22, "Snacks", "200 g"],
  ["Dish Soap", "Lemon dishwashing liquid", 99, 29, "Household", "500 ml"],
  ["Laundry Detergent", "Front-load detergent powder", 185, 19, "Household", "1 kg"],
];

const ensureAdminAndPartners = async () => {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return;
  if (!await User.exists({ email: adminEmail })) {
    await User.create({ name: process.env.SEED_ADMIN_NAME || "Admin", email: adminEmail, password: adminPassword, role: ROLES.ADMIN });
  }
  const emails = (process.env.SEED_DELIVERY_PARTNERS || "").split(",").map((email) => email.trim()).filter(Boolean);
  const password = process.env.SEED_DELIVERY_PARTNER_PASSWORD;
  if (!emails.length || !password) return;
  for (const email of emails) {
    if (!await User.exists({ email })) await User.create({ name: email.split("@")[0], email, password, role: ROLES.DELIVERY_PARTNER });
  }
};

const ensureSampleProducts = async () => {
  for (const [name, description, price, stock, category, unit] of sampleProducts) {
    if (!await Product.exists({ name })) await Product.create({ name, description, price, stock, category, unit, isActive: true });
  }
};

const ensureDemoCustomers = async () => {
  const password = process.env.SEED_CUSTOMER_PASSWORD;
  const emails = (process.env.SEED_CUSTOMER_EMAILS || "").split(",").map((email) => email.trim()).filter(Boolean);
  if (!password || !emails.length) return [];
  const customers = [];
  for (const email of emails) {
    let customer = await User.findOne({ email });
    if (!customer) customer = await User.create({ name: email.split("@")[0], email, password, role: ROLES.CUSTOMER });
    if (customer.role === ROLES.CUSTOMER) customers.push(customer);
  }
  return customers;
};

const ensureDemoHistory = async (customers) => {
  if (!customers.length) return;
  const products = await Product.find({ isActive: true }).sort({ createdAt: 1 }).limit(20).lean();
  const partners = await User.find({ role: ROLES.DELIVERY_PARTNER }).select("_id").lean();
  if (products.length < 3) return;
  const now = Date.now();
  const operations = [];
  for (const [customerIndex, customer] of customers.entries()) {
    for (let day = 2; day <= 58; day += 3) {
      const date = new Date(now - day * 86400000);
      const start = (customerIndex * 5 + day) % products.length;
      const selected = [products[start], products[(start + 3) % products.length], products[(start + 7) % products.length]];
      const items = selected.map((product, index) => ({ product: product._id, name: product.name, price: product.price, quantity: 1 + ((day + index + customerIndex) % 3) }));
      const demoSeedKey = `demo-history-${customer._id}-${day}`;
      const order = {
        customer: customer._id,
        deliveryPartner: partners.length ? partners[(day + customerIndex) % partners.length]._id : null,
        items,
        totalAmount: items.reduce((total, item) => total + item.price * item.quantity, 0),
        status: ORDER_STATUS.DELIVERED,
        address: `Demo delivery block ${1 + (day % 12)}, Bengaluru`,
        demoSeedKey,
        createdAt: date,
        updatedAt: date,
      };
      operations.push({ updateOne: { filter: { demoSeedKey }, update: { $setOnInsert: order }, upsert: true } });
    }
  }
  // The synthetic order timestamps intentionally reflect historical purchase dates.
  // Disable Mongoose's bulkWrite timestamp injection to avoid conflicting with
  // updatedAt already present in each $setOnInsert document.
  if (operations.length) await Order.bulkWrite(operations, { ordered: false, timestamps: false });
};

export default async function seedAll() {
  if (process.env.SEED_ON_START !== "true" && process.env.SEED_DEMO_DATA !== "true") return;
  if (process.env.SEED_ON_START === "true") await ensureAdminAndPartners();
  await ensureSampleProducts();
  if (process.env.SEED_DEMO_DATA === "true") {
    const customers = await ensureDemoCustomers();
    await ensureDemoHistory(customers);
  }
  console.log("Seed check complete (catalogue and optional synthetic history ensured).");
}

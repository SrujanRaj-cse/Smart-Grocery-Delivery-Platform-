import User from "../models/User.js";
import Product from "../models/Product.js";
import { ROLES, ORDER_STATUS } from "../utils/constants.js";

const ensureAdminAndPartners = async () => {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  // Only seed if env is present (safer for production deployments).
  if (!adminEmail || !adminPassword) return;

  const adminExists = await User.findOne({ email: adminEmail });
  if (!adminExists) {
    await User.create({
      name: process.env.SEED_ADMIN_NAME || "Admin",
      email: adminEmail,
      password: adminPassword,
      role: ROLES.ADMIN,
    });
  }

  const deliveryPartnerEmails = (process.env.SEED_DELIVERY_PARTNERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const deliveryPartnerPassword = process.env.SEED_DELIVERY_PARTNER_PASSWORD;
  if (deliveryPartnerEmails.length === 0 || !deliveryPartnerPassword) return;

  for (const email of deliveryPartnerEmails) {
    const existing = await User.findOne({ email });
    if (!existing) {
      await User.create({
        name: email.split("@")[0],
        email,
        password: deliveryPartnerPassword,
        role: ROLES.DELIVERY_PARTNER,
      });
    }
  }
};

const ensureSampleProducts = async () => {
  const sample = [
    {
      name: "Fresh Tomatoes",
      description: "Farm-fresh tomatoes",
      price: 2.49,
      stock: 8,
      imageUrl:
        "https://www.istockphoto.com/photos/ripe-tomato",
    },
    {
      name: "Sweet Mangoes",
      description: "Juicy mangoes (seasonal)",
      price: 3.99,
      stock: 60,
      imageUrl:
        "https://images.unsplash.com/photo-1605027990121-cbae9f9f6c3b?auto=format&fit=crop&w=900&q=80",
    },
    {
      name: "Organic Spinach",
      description: "Washed and ready to cook",
      price: 1.79,
      stock: 120,
      imageUrl:
        "https://images.unsplash.com/photo-1572441713132-51c75654db73?auto=format&fit=crop&w=900&q=80",
    },
  ];

  for (const p of sample) {
    const existing = await Product.findOne({ name: p.name });
    if (!existing) {
      await Product.create(p);
      continue;
    }

    // Keep it idempotent but ensure images/prices/stocks are present.
    existing.description = p.description;
    existing.price = p.price;
    existing.stock = p.stock;
    existing.imageUrl = p.imageUrl;
    existing.isActive = true;
    await existing.save();
  }
};

// Keeping this seed intentionally small and idempotent:
// it only runs when the collections are empty.
export default async function seedAll() {
  const seedOnStart = process.env.SEED_ON_START === "true";
  if (!seedOnStart) return;

  await ensureAdminAndPartners();
  await ensureSampleProducts();

  // Useful when testing locally: lets you know seeding actually happened.
  console.log("Seed check complete (admin/users/products ensured).");
}


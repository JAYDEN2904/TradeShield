/**
 * Idempotent demo seed for TradeShield. Safe to re-run — checks phone
 * numbers before inserting so it never duplicates rows.
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, productsTable, ordersTable } from "@workspace/db";

const DEMO_PASSWORD = "demo12345";

async function ensureUser(input: {
  phone: string;
  role: "buyer" | "supplier" | "both";
  businessName: string;
  location: string;
  category?: string;
  payoutMomoNumber?: string;
  isAdmin?: boolean;
}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, input.phone));

  if (existing) {
    await db
      .update(usersTable)
      .set({ passwordHash })
      .where(eq(usersTable.id, existing.id));
    return existing;
  }

  const [created] = await db
    .insert(usersTable)
    .values({ ...input, passwordHash })
    .returning();
  if (!created) throw new Error(`Failed to create user ${input.phone}`);
  return created;
}

async function main() {
  const supplier1 = await ensureUser({
    phone: "+233200000001",
    role: "supplier",
    businessName: "Accra Wholesale Foods",
    location: "Accra, Greater Accra",
    category: "Groceries",
    payoutMomoNumber: "0200000001",
  });

  const supplier2 = await ensureUser({
    phone: "+233200000002",
    role: "supplier",
    businessName: "Kumasi Textile Traders",
    location: "Kumasi, Ashanti",
    category: "Textiles",
    payoutMomoNumber: "0200000002",
  });

  const buyer1 = await ensureUser({
    phone: "+233200000003",
    role: "buyer",
    businessName: "Tema Retail Mart",
    location: "Tema, Greater Accra",
    category: "Retail",
  });

  await ensureUser({
    phone: "+233200000099",
    role: "both",
    businessName: "TradeShield Admin",
    location: "Accra, Greater Accra",
    isAdmin: true,
    payoutMomoNumber: "0200000099",
  });

  const existingProducts = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.supplierId, supplier1.id));

  let riceProduct = existingProducts[0];
  if (!riceProduct) {
    const [created] = await db
      .insert(productsTable)
      .values({
        supplierId: supplier1.id,
        name: "50kg Bag of Rice",
        category: "Groceries",
        unitPrice: "450.00",
        moq: 5,
        unit: "bag",
        stockQty: 200,
        isActive: true,
      })
      .returning();
    if (created) riceProduct = created;
  }

  const existingTextiles = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.supplierId, supplier2.id));

  if (existingTextiles.length === 0) {
    await db.insert(productsTable).values({
      supplierId: supplier2.id,
      name: "Ankara Fabric Bundle (12 yards)",
      category: "Textiles",
      unitPrice: "180.00",
      moq: 10,
      unit: "bundle",
      stockQty: 150,
      isActive: true,
    });
  }

  if (riceProduct) {
    const existingOrders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.buyerId, buyer1.id));

    if (existingOrders.length === 0) {
      await db.insert(ordersTable).values({
        buyerId: buyer1.id,
        supplierId: supplier1.id,
        productId: riceProduct.id,
        quantity: 10,
        totalAmount: "4500.00",
        platformFee: "90.00",
        status: "pending_supplier_confirmation",
        deliveryLocation: "Tema Community 4, Greater Accra",
        preferredDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }
  }

  console.log("TradeShield seed complete.");
  console.log(`Demo password for all seed users: ${DEMO_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

/**
 * One-off: wipe transactional data (orders, expenses, daily summaries) so the
 * restaurant starts clean at go-live. KEEPS users, menu items, and settings.
 *
 * Guarded — you must pass CONFIRM_RESET=yes. Run against the target DB via
 * DATABASE_URL, e.g.:
 *   CONFIRM_RESET=yes npx tsx scripts/reset-data.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.CONFIRM_RESET !== "yes") {
    console.error("Refusing to run. Set CONFIRM_RESET=yes to wipe transactional data.");
    process.exit(1);
  }
  // Children first (order items reference orders).
  const [items, orders, expenses, summaries] = await prisma.$transaction([
    prisma.orderItem.deleteMany({}),
    prisma.order.deleteMany({}),
    prisma.expense.deleteMany({}),
    prisma.dailySummary.deleteMany({}),
  ]);
  console.log(
    `Deleted → ${items.count} order items, ${orders.count} orders, ` +
      `${expenses.count} expenses, ${summaries.count} daily summaries.`
  );
  console.log("Kept → users, menu items, settings.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

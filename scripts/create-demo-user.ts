/**
 * One-off: create (or reset) a demo STAFF login for showing the app off.
 *
 * Staff can take orders and view today's orders, but CANNOT see the owner's
 * dashboard, expenses, or menu editing (those are owner-only, API-blocked with
 * 403) — so it's safe to share without exposing finances.
 *
 * Run against the target DB with DATABASE_URL set, e.g.:
 *   DEMO_EMAIL="demo@samratchinese.local" DEMO_PASSWORD="demo1234" \
 *     npx tsx scripts/create-demo-user.ts
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.DEMO_EMAIL ?? "demo@samratchinese.local";
  const password = process.env.DEMO_PASSWORD ?? "demo1234";
  const name = process.env.DEMO_NAME ?? "Demo (Staff)";

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role: Role.staff, password: hash },
    create: { email, name, role: Role.staff, password: hash },
  });

  console.log(`✓ Demo staff login ready:`);
  console.log(`   email:    ${user.email}`);
  console.log(`   password: ${password}`);
  console.log(`   role:     ${user.role}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

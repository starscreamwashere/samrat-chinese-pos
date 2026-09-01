/**
 * One-off: set (or reset) a user's password. There's no in-app password change,
 * so use this to give the owner the password they want before handover.
 *
 * Run against the target DB (e.g. production) with the connection string in
 * DATABASE_URL, e.g.:
 *   OWNER_EMAIL="owner@samratchinese.local" NEW_OWNER_PASSWORD="theirNewPass" \
 *     npx tsx scripts/set-owner-password.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.OWNER_EMAIL ?? process.env.SEED_OWNER_EMAIL;
  const password = process.env.NEW_OWNER_PASSWORD;
  if (!email || !password) {
    console.error(
      "Set OWNER_EMAIL (or SEED_OWNER_EMAIL) and NEW_OWNER_PASSWORD env vars."
    );
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({
    where: { email },
    data: { password: hash },
  });
  console.log(`✓ Password updated for ${user.email} (role: ${user.role}).`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

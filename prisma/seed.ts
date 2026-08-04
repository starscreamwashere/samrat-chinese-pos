/**
 * Seed script — creates the owner account and the full Samrat Chinese menu.
 * Run with:  npm run db:seed   (after DATABASE_URL points at a real DB and
 * migrations have been applied).
 *
 * Price rules for the transcribed board:
 *   - `null` half + `null` full  -> item skipped (no usable price on the board).
 *   - full present               -> seeded ACTIVE with the given half/full.
 *   - full missing, half present -> seeded INACTIVE (needs owner confirmation);
 *     the known number is stored as a placeholder so the owner can fix + enable
 *     it from the Menu screen. See the "Verify before launch" note in the docs.
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type Row = { name: string; half: number | null; full: number | null };

const MENU: Record<string, Row[]> = {
  "Non-Veg Soup": [
    { name: "Chicken Clear Soup", half: null, full: 120 },
    { name: "Chicken Manchow Soup", half: null, full: 120 },
    { name: "Chicken Manchurian Soup", half: null, full: 120 },
    { name: "Chicken Hot & Sour Soup", half: null, full: 130 },
    { name: "Chicken Royal Soup", half: null, full: 130 },
    { name: "Chicken Sweet Corn Soup", half: null, full: 120 },
    { name: "Chicken Noodles Soup", half: null, full: 120 },
    { name: "Chicken Burnt Garlic Soup", half: null, full: 120 },
    { name: "Chicken Ginger Soup", half: null, full: 120 },
    { name: "Chicken Tomato Soup", half: null, full: 140 },
    { name: "Chicken Cream Soup", half: null, full: 130 },
    { name: "Chicken Lung Fung Soup", half: null, full: 130 },
  ],
  "Non-Veg Starters": [
    { name: "Chicken Chilly Dry", half: 140, full: 220 },
    { name: "Chicken Manchurian Dry", half: 130, full: 210 },
    { name: "Chicken Crispy Dry", half: 140, full: 230 },
    { name: "Chicken Hong Kong Dry", half: 140, full: 220 },
    { name: "Chicken Garlic Dry", half: 130, full: 220 },
    { name: "Chicken Dragon Dry", half: 140, full: 240 },
    { name: "Chicken Singapore Dry", half: 140, full: 240 },
    { name: "Chicken 65", half: 150, full: 240 },
    { name: "Chicken Hunan", half: 150, full: 250 },
    { name: "Chicken Chinese Bhel", half: 110, full: 160 },
    { name: "Lollypop Masala Dry", half: 150, full: 240 },
    { name: "Lollypop Oil Fry", half: 140, full: 230 },
    { name: "Black Pepper Chicken", half: 140, full: 230 },
    { name: "Chicken Burnt Garlic Chicken", half: 140, full: 220 },
    { name: "Chicken Basa Billy", half: 140, full: 300 },
    { name: "Egg Lollypop Fry", half: 150, full: 220 },
    { name: "Kung Pao Chicken", half: 140, full: 240 },
  ],
  "Non-Veg Rice": [
    { name: "Chicken Fried Rice", half: 100, full: 160 },
    { name: "Chicken Sch. Fried Rice", half: 110, full: 170 },
    { name: "Chicken Singapore Rice", half: 110, full: 180 },
    { name: "Chicken Hong Kong Rice", half: 110, full: 180 },
    { name: "Chicken Burnt Garlic Rice", half: 110, full: null }, // full smudged
    { name: "Chicken Manchurian Rice", half: 150, full: 210 },
    { name: "Chicken Sch. Combination Rice", half: 150, full: 220 },
    { name: "Chicken Triple Rice", half: null, full: null }, // no price -> skipped
    { name: "Chicken Schezwan Triple Rice", half: 160, full: 240 },
    { name: "Chicken Chopper Rice", half: 140, full: 250 },
    { name: "Chicken Dragon Rice", half: 150, full: 250 },
    { name: "Chicken Chilly Rice", half: 150, full: 250 },
    { name: "Chicken Lolly Rice", half: 160, full: 220 },
    { name: "Chicken Sherpa Rice", half: 150, full: 260 },
    { name: "Chicken Boxer Rice", half: 150, full: 270 },
    { name: "Chicken Packing Rice", half: 160, full: 270 },
    { name: "Chicken 1000 Rice", half: 170, full: 380 },
    { name: "Egg Fried Rice", half: 100, full: 150 },
    { name: "Egg Schezwan Fried Rice", half: 110, full: 160 },
  ],
  "Non-Veg Noodles": [
    { name: "Chicken Noodles", half: 100, full: 160 },
    { name: "Chicken Sch. Noodles", half: 110, full: 170 },
    { name: "Chicken Singapore Noodles", half: 110, full: 180 },
    { name: "Chicken Hong Kong Noodles", half: 110, full: 180 },
    { name: "Chicken Burnt Garlic Noodles", half: 110, full: null }, // full smudged
    { name: "Chicken Manchurian Noodles", half: 150, full: 210 },
    { name: "Chicken Sch. Combination Noodles", half: 150, full: 220 },
    { name: "Chicken Triple Noodles", half: 150, full: 230 },
    { name: "Chicken Sch. Triple Noodles", half: 160, full: 240 },
    { name: "Chicken Chopper Noodles", half: 140, full: 250 },
    { name: "Chicken Dragon Noodles", half: 150, full: 250 },
    { name: "Chicken Chilly Noodles", half: 150, full: 250 },
    { name: "Chicken Lolly Noodles", half: 160, full: 220 },
    { name: "Chicken Sherpa Noodles", half: 150, full: 260 },
    { name: "Chicken Boxer Noodles", half: 150, full: 270 },
    { name: "Chicken Packing Noodles", half: 160, full: 270 },
    { name: "Chicken 1000 Noodles", half: null, full: 380 }, // half smudged
    { name: "Egg Fried Noodles", half: 100, full: 150 },
    { name: "Egg Schezwan Fried Noodles", half: 110, full: 160 },
  ],
  "Veg Soup": [
    { name: "Clear Soup", half: null, full: 100 },
    { name: "Manchow Soup", half: null, full: 110 },
    { name: "Manchurian Soup", half: null, full: 110 },
    { name: "Veg Hot & Sour Soup", half: null, full: 120 },
    { name: "Veg Burnt Garlic Soup", half: null, full: 110 },
    { name: "Veg Sweet Corn Soup", half: null, full: 120 },
    { name: "Veg Noodles Soup", half: null, full: 110 },
    { name: "Veg Royal Soup", half: null, full: 120 },
    { name: "Veg Tomato Soup", half: null, full: 110 },
    { name: "Veg Talumein Soup", half: null, full: 110 },
  ],
  "Veg Starters": [
    { name: "Veg Chilly Dry", half: 100, full: 160 },
    { name: "Veg Manchurian Dry", half: 100, full: 150 },
    { name: "Veg Crispy Dry", half: 120, full: 180 },
    { name: "Veg Hong Kong Dry", half: 120, full: 180 },
    { name: "Paneer Chilly Dry", half: 140, full: 220 },
    { name: "Paneer Crispy Dry", half: 140, full: 230 },
    { name: "Paneer Manchurian Dry", half: 140, full: 210 },
    { name: "Paneer Schezwan Dry", half: 140, full: 220 },
    { name: "Paneer Garlic Dry", half: 140, full: 220 },
    { name: "Paneer Hunan Dry", half: 160, full: 240 },
  ],
  "Veg Rice": [
    { name: "Veg Fried Rice", half: 100, full: 150 },
    { name: "Veg Schezwan Fried Rice", half: 110, full: 160 },
    { name: "Veg Schezwan Combination Rice", half: 120, full: 180 },
    { name: "Veg Manchurian Rice", half: 120, full: 210 },
    { name: "Veg Singapore Rice", half: 110, full: 170 },
    { name: "Veg Hong Kong Rice", half: 110, full: 160 },
    { name: "Veg Burnt Garlic Rice", half: 100, full: 150 },
    { name: "Veg Triple Rice", half: 120, full: 210 },
    { name: "Veg Sch. Triple Rice", half: 130, full: 220 },
    { name: "Veg Chopper Rice", half: 140, full: 250 },
    { name: "Veg Dragon Rice", half: 140, full: 250 },
    { name: "Veg Chilly Rice", half: 130, full: 220 },
    { name: "Veg Sherpa Rice", half: 150, full: 220 },
    { name: "Paneer Chilly Rice", half: 150, full: 220 },
    { name: "Paneer Chopper Rice", half: 150, full: 260 },
    { name: "Paneer Fried Rice", half: null, full: 210 }, // half smudged
    { name: "Paneer Schezwan Rice", half: 130, full: 220 },
    { name: "Paneer Schezwan Triple Rice", half: 150, full: 230 },
    { name: "Veg 1000 Rice", half: null, full: 270 }, // half smudged
  ],
  "Veg Noodles": [
    { name: "Veg Noodles", half: 100, full: 150 },
    { name: "Veg Sch. Noodles", half: 110, full: 160 },
    { name: "Veg Sch. Combination Noodles", half: 120, full: 180 },
    { name: "Veg Manchurian Noodles", half: 120, full: 210 },
    { name: "Veg Singapore Noodles", half: 110, full: 170 },
    { name: "Veg Hong Kong Noodles", half: 110, full: 160 },
    { name: "Veg Burnt Garlic Noodles", half: 100, full: 150 },
    { name: "Veg Triple Noodles", half: 120, full: 210 },
    { name: "Veg Sch. Triple Noodles", half: 130, full: 220 },
    { name: "Veg Chopper Noodles", half: 140, full: 250 },
    { name: "Veg Dragon Noodles", half: 140, full: 250 },
    { name: "Veg Chilly Noodles", half: 130, full: 220 },
    { name: "Veg Sherpa Noodles", half: 150, full: 220 },
    { name: "Paneer Chilly Noodles", half: 150, full: 220 },
    { name: "Paneer Chopper Noodles", half: 150, full: 260 },
    { name: "Paneer Hakka Noodles", half: null, full: 210 }, // half smudged
    { name: "Paneer Schezwan Noodles", half: null, full: 220 }, // half smudged
    { name: "Paneer Schezwan Triple Noodles", half: 150, full: 230 },
    { name: "Veg 1000 Noodles", half: null, full: 270 }, // half smudged
  ],
};

async function main() {
  const email = process.env.SEED_OWNER_EMAIL ?? "owner@samratchinese.local";
  const password = process.env.SEED_OWNER_PASSWORD ?? "change-me-before-launch";
  const name = process.env.SEED_OWNER_NAME ?? "Samrat Owner";

  // --- Owner account -------------------------------------------------------
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    update: { name, role: Role.owner },
    create: { email, name, password: passwordHash, role: Role.owner },
  });
  console.log(`✓ Owner account ready: ${email}`);

  // --- Menu ----------------------------------------------------------------
  let created = 0;
  let inactive = 0;
  let skipped = 0;

  for (const [category, rows] of Object.entries(MENU)) {
    for (const row of rows) {
      if (row.full === null && row.half === null) {
        skipped++;
        console.log(`  ⚠ Skipped (no price on board): ${row.name}`);
        continue;
      }

      const hasFull = row.full !== null;
      const fullPrice = (row.full ?? row.half) as number; // guaranteed non-null
      const halfPrice = hasFull ? row.half : null;
      const isActive = hasFull;

      // Idempotent-ish: only create if an item with this name doesn't exist.
      const existing = await prisma.menuItem.findFirst({
        where: { name: row.name },
      });
      if (existing) continue;

      await prisma.menuItem.create({
        data: { name: row.name, category, halfPrice, fullPrice, isActive },
      });
      created++;
      if (!isActive) {
        inactive++;
        console.log(`  ⚠ Inactive (confirm price): ${row.name}`);
      }
    }
  }

  console.log(
    `✓ Menu seeded: ${created} items created ` +
      `(${inactive} inactive pending price confirmation, ${skipped} skipped).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { prisma } from "@/lib/prisma";

const TABLE_COUNT_KEY = "table_count";

/** Number of tables the owner has configured (0 = not set up yet). */
export async function getTableCount(): Promise<number> {
  const row = await prisma.setting.findUnique({
    where: { key: TABLE_COUNT_KEY },
  });
  if (!row) return 0;
  const n = parseInt(row.value, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function setTableCount(count: number): Promise<number> {
  const value = String(Math.max(0, Math.floor(count)));
  await prisma.setting.upsert({
    where: { key: TABLE_COUNT_KEY },
    update: { value },
    create: { key: TABLE_COUNT_KEY, value },
  });
  return parseInt(value, 10);
}

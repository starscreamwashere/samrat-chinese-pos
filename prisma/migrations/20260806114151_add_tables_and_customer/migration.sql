-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "customer_name" TEXT,
ADD COLUMN     "customer_phone" TEXT,
ADD COLUMN     "table_no" INTEGER;

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

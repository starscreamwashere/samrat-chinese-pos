import { z } from "zod";

export const orderItemSchema = z.object({
  menuItemId: z.string().uuid().nullable().optional(),
  itemName: z.string().min(1),
  unitPrice: z.number().nonnegative(),
  quantity: z.number().int().positive(),
});

// Shared optional fields for who/where an order is (dine-in table, phone customer).
const orderMetaShape = {
  tableNo: z.number().int().positive().nullable().optional(),
  customerName: z.string().max(120).nullable().optional(),
  customerPhone: z.string().max(20).nullable().optional(),
};

export const createOrderSchema = z.object({
  orderType: z.enum(["dine_in", "phone"]).default("dine_in"),
  items: z.array(orderItemSchema).min(1, "An order needs at least one item"),
  ...orderMetaShape,
});

// PATCH may change the order type and/or its table/customer metadata.
export const updateOrderSchema = z
  .object({
    orderType: z.enum(["dine_in", "phone"]).optional(),
    ...orderMetaShape,
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "No fields to update",
  });

export const settingsSchema = z.object({
  tableCount: z.number().int().min(0).max(100),
});

export const menuItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  halfPrice: z.number().nonnegative().nullable().optional(),
  fullPrice: z.number().nonnegative(),
  isActive: z.boolean().default(true),
});

export const menuItemUpdateSchema = menuItemSchema.partial();

export const expenseSchema = z.object({
  type: z.enum(["rent", "salary", "capital", "other"]),
  amount: z.number().positive(),
  note: z.string().max(500).optional().default(""),
  spentOn: z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
    message: "Invalid date",
  }),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type MenuItemInput = z.infer<typeof menuItemSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;

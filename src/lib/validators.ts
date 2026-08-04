import { z } from "zod";

export const orderItemSchema = z.object({
  menuItemId: z.string().uuid().nullable().optional(),
  itemName: z.string().min(1),
  unitPrice: z.number().nonnegative(),
  quantity: z.number().int().positive(),
});

export const createOrderSchema = z.object({
  orderType: z.enum(["dine_in", "phone"]).default("dine_in"),
  items: z.array(orderItemSchema).min(1, "An order needs at least one item"),
});

export const updateOrderSchema = z.object({
  orderType: z.enum(["dine_in", "phone"]),
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

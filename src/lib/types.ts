export type MenuItem = {
  id: string;
  name: string;
  category: string;
  halfPrice: number | null;
  fullPrice: number | null;
  isActive: boolean;
};

export type Size = "half" | "full" | "single";

// A line in the in-progress order cart.
export type CartLine = {
  key: string; // menuItemId + size + gravy — identifies a mergeable line
  menuItemId: string;
  baseName: string;
  size: Size;
  gravy: boolean;
  unitPrice: number;
  quantity: number;
};

export type OrderType = "dine_in" | "phone";

// Shape sent to the API when saving/appending order items.
export type PayloadItem = {
  menuItemId: string | null;
  itemName: string;
  unitPrice: number;
  quantity: number;
};

export function isStarter(category: string): boolean {
  return category.toLowerCase().includes("starter");
}

/** Display name for a cart line, including size + gravy annotations. */
export function lineName(line: Pick<CartLine, "baseName" | "size" | "gravy">) {
  const size =
    line.size === "half" ? " (Half)" : line.size === "full" ? " (Full)" : "";
  const gravy = line.gravy ? " + Gravy" : "";
  return `${line.baseName}${size}${gravy}`;
}

/**
 * inventory.ts
 * Shared type definitions (the "shapes" of data) used across the program.
 * Interfaces describe objects; type aliases describe a fixed set of allowed values.
 * TypeScript checks every use of these types when the program is compiled.
 */

/** The label and CSS class used to draw a stock status badge, e.g. "Low Stock". */
export interface ItemStatus {
  label: string;      // text shown to the user
  cssClass: string;   // CSS class that colours the badge
}

/** A furniture category such as "Bedroom" and the prefix used for its SKU codes. */
export interface Category {
  name: string;       // display name, e.g. "Dining Room"
  prefix: string;     // SKU prefix, e.g. "MW-DIN"
}

/**
 * The two kinds of furniture item the store handles.
 * LARGE items (sofas, beds, tables) are bulky and slow to reorder.
 * STANDARD items (chairs, stools, lamps) are smaller and sell in higher volumes.
 */
export type FurnitureType = 'LARGE' | 'STANDARD';

/** The three stages an order allocation can be in. */
export type AllocationStatus = 'ACTIVE' | 'DISPATCHED' | 'CANCELLED';

/** One row of the category breakdown in the valuation report. */
export interface CategoryStat {
  category: string;   // category name
  skuCount: number;   // how many different products are in this category
  onHand: number;     // physical units in the warehouse
  allocated: number;  // units reserved for customer orders
  available: number;  // units free to sell (onHand - allocated)
  valuation: number;  // value of units on hand, in AED
}

/** The full valuation report produced by InventoryManager.generateStockReport(). */
export interface StockReport {
  totalSkus: number;
  totalUnitsOnHand: number;
  totalAllocatedUnits: number;
  totalAvailableUnits: number;
  totalValuation: number;
  categoryBreakdown: CategoryStat[];
  generatedDate: string;
}

/**
 * The result returned by actions that can succeed or fail (allocate, restock...).
 * The index signature lets an action attach extra data, such as the new allocation.
 */
export interface OperationResult {
  success: boolean;
  message: string;
  [key: string]: unknown;
}

/** How a furniture item is saved in browser storage (plain data, no methods). */
export interface StoredItem {
  itemCode: string;
  name: string;
  category: string;
  type: FurnitureType;
  stockLevel: number;
  unitPrice: number;
  dateAdded: string;
}

/** How an order allocation is saved in browser storage. */
export interface StoredAllocation {
  id: string;
  itemCode: string;
  customerRef: string;
  orderNumber: string;
  quantity: number;
  date: string;
  status: AllocationStatus;
}

/** The four styles of pop-up notification the interface can show. */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

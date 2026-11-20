import { FurnitureItem } from '../models/FurnitureItem';
import { createFurnitureItem } from '../models/FurnitureTypes';
import { OrderAllocation } from '../models/OrderAllocation';
import {
  Category,
  CategoryStat,
  FurnitureType,
  OperationResult,
  StockReport,
  StoredAllocation,
  StoredItem
} from '../types/inventory';

/** One line of the reorder suggestion list shown on the report page. */
export interface ReorderSuggestion {
  itemCode: string;
  name: string;
  typeLabel: string;
  available: number;
  threshold: number;
  suggestedQty: number;
}

/**
 * InventoryManager holds all the store's data and every business rule.
 * The user interface never changes stock itself; it asks this class to,
 * and this class checks the request is valid first.
 *
 * Encapsulation: the three collections are private. Other classes read them
 * through getItem(), getAllItems() and getAllocations().
 */
export class InventoryManager {
  // Keys used to save data in the browser's localStorage.
  // "v6" is new: data saved by the old version is ignored and rebuilt.
  private readonly storageKeyItems = 'mazbay_wood_items_v6';
  private readonly storageKeyAllocations = 'mazbay_wood_allocations_v6';
  private readonly storageKeyCategories = 'mazbay_wood_categories_v6';

  private items: Map<string, FurnitureItem>;   // SKU code -> item, for fast lookup
  private allocations: OrderAllocation[];      // every order reservation, newest first
  private categories: Category[];              // furniture categories

  constructor() {
    this.items = new Map();
    this.allocations = [];
    this.categories = [];
    this.loadFromStorage();
  }

  // ===================================================================
  // Read-only access for other classes
  // ===================================================================

  /** Returns the item with this SKU, or undefined if it does not exist. */
  getItem(itemCode: string): FurnitureItem | undefined {
    return this.items.get(itemCode);
  }

  /** True if an item with this SKU exists. */
  hasItem(itemCode: string): boolean {
    return this.items.has(itemCode);
  }

  /** All items as a new array (changing the array does not change the stock). */
  getAllItems(): FurnitureItem[] {
    return Array.from(this.items.values());
  }

  /** All allocations, newest first, as a new array. */
  getAllocations(): OrderAllocation[] {
    return [...this.allocations];
  }

  /** All categories as a new array. */
  getCategories(): Category[] {
    return [...this.categories];
  }

  // ===================================================================
  // Saving and loading
  // ===================================================================

  /**
   * Loads saved data from localStorage, or creates the starting data on the
   * first run. Each item's reserved count is then REBUILT from the active
   * orders, so the two can never disagree (this fixes test T01).
   */
  loadFromStorage(): void {
    try {
      const storedCategories = localStorage.getItem(this.storageKeyCategories);
      const storedItems = localStorage.getItem(this.storageKeyItems);
      const storedAllocations = localStorage.getItem(this.storageKeyAllocations);

      // Nothing saved yet: this is the first run, so load the sample data.
      if (!storedCategories || !storedItems || !storedAllocations) {
        this.seedSampleData();
        return;
      }

      this.categories = JSON.parse(storedCategories) as Category[];

      // Rebuild each item as the right subclass using the factory.
      (JSON.parse(storedItems) as StoredItem[]).forEach(data => {
        const item = createFurnitureItem(
          data.type,
          data.itemCode,
          data.name,
          data.category,
          data.stockLevel,
          data.unitPrice,
          data.dateAdded
        );
        this.items.set(item.itemCode, item);
      });

      // Rebuild the order records.
      this.allocations = (JSON.parse(storedAllocations) as StoredAllocation[]).map(
        a => new OrderAllocation(a.id, a.itemCode, a.customerRef, a.orderNumber, a.quantity, a.date, a.status)
      );

      this.reconcileReservations();
    } catch (err) {
      // Saved data is damaged: start again from the sample data.
      console.error('Error loading inventory data, restoring sample data:', err);
      this.items = new Map();
      this.allocations = [];
      this.seedSampleData();
    }
  }

  /**
   * Re-applies every ACTIVE order to its item. Because reserved counts are
   * always calculated from the order records, a reservation can never exist
   * without an order behind it.
   */
  private reconcileReservations(): void {
    this.allocations
      .filter(a => a.isActive())
      .forEach(a => {
        const item = this.items.get(a.itemCode);
        if (!item || !item.allocate(a.quantity)) {
          console.warn(`Order ${a.orderNumber} could not be re-applied to ${a.itemCode}.`);
        }
      });
  }

  /** Writes all data to localStorage. Each object's toJSON() decides what is saved. */
  saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKeyItems, JSON.stringify(this.getAllItems()));
      localStorage.setItem(this.storageKeyAllocations, JSON.stringify(this.allocations));
      localStorage.setItem(this.storageKeyCategories, JSON.stringify(this.categories));
    } catch (err) {
      console.error('Error saving inventory data:', err);
    }
  }

  /**
   * Creates the sample categories, products and orders used on first launch.
   * Every reserved unit has a matching order record (the old version did not).
   */
  private seedSampleData(): void {
    this.categories = [
      { name: 'Living Room', prefix: 'MW-LIV' },
      { name: 'Dining Room', prefix: 'MW-DIN' },
      { name: 'Bedroom', prefix: 'MW-BED' },
      { name: 'Home Office', prefix: 'MW-OFF' },
      { name: 'Storage & Accents', prefix: 'MW-ACC' },
      { name: 'Outdoor & Patio', prefix: 'MW-OUT' }
    ];

    // [type, SKU, name, category, units on hand, price in AED]
    const products: [FurnitureType, string, string, string, number, number][] = [
      ['LARGE', 'MW-DIN-001', 'Dining Table', 'Dining Room', 12, 3200],
      ['LARGE', 'MW-LIV-002', 'TV Console Cabinet', 'Living Room', 8, 4250],
      ['STANDARD', 'MW-LIV-003', 'Lounge Armchair', 'Living Room', 15, 1850],
      ['LARGE', 'MW-BED-004', 'Queen Bed Frame', 'Bedroom', 6, 3600],
      ['LARGE', 'MW-OFF-005', 'Office Study Desk', 'Home Office', 10, 2150],
      ['LARGE', 'MW-ACC-006', '5-Tier Bookshelf', 'Storage & Accents', 5, 2650],
      ['STANDARD', 'MW-DIN-007', 'Dining Chairs (Set of 2)', 'Dining Room', 18, 1200],
      ['STANDARD', 'MW-BED-008', 'Bedside Nightstand', 'Bedroom', 3, 890]
    ];
    products.forEach(([type, code, name, category, qty, price]) => {
      this.items.set(code, createFurnitureItem(type, code, name, category, qty, price));
    });

    // [SKU, customer, order number, quantity, days ago]
    const orders: [string, string, string, number, number][] = [
      ['MW-DIN-001', 'Tariq Al-Mansoor', 'SO-7841', 2, 6],
      ['MW-LIV-003', 'Hassan Bin Rashid', 'SO-7845', 2, 5],
      ['MW-DIN-001', 'Mariam Al-Suwaidi', 'SO-7850', 1, 5],
      ['MW-LIV-002', 'Khalid Al-Falasi', 'SO-7852', 2, 4],
      ['MW-LIV-003', 'Noura Hamdan', 'SO-7856', 2, 3],
      ['MW-BED-004', 'Rashid Al-Ketbi', 'SO-7860', 1, 3],
      ['MW-OFF-005', 'Fatima Al-Zahra', 'SO-7863', 2, 2],
      ['MW-DIN-007', 'Saeed Al-Mazrouei', 'SO-7867', 6, 1],
      ['MW-BED-008', 'Layla Haddad', 'SO-7871', 2, 1]
    ];
    orders.forEach(([code, customer, order, qty, daysAgo], i) => {
      const date = new Date(Date.now() - daysAgo * 86400000).toISOString();
      this.allocations.unshift(new OrderAllocation(`ALC-${1001 + i}`, code, customer, order, qty, date));
    });

    this.reconcileReservations();
    this.saveToStorage();
  }

  // ===================================================================
  // Categories
  // ===================================================================

  /**
   * Adds a category. The SKU prefix is made from the name if left blank.
   * Rejects blank names, duplicate names, duplicate prefixes and prefixes
   * that are not 2 to 6 letters.
   */
  addCategory(categoryName: string, customPrefix = ''): Category {
    const name = categoryName.trim();
    if (!name) {
      throw new Error('Category name cannot be empty.');
    }
    if (this.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`Category "${name}" already exists.`);
    }

    // Use the typed prefix, or the first three letters of the name.
    let letters = customPrefix.trim().toUpperCase().replace(/^MW-/, '');
    if (!letters) {
      letters = name.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3) || 'GEN';
    }
    if (!/^[A-Z]{2,6}$/.test(letters)) {
      throw new Error('SKU prefix must be 2 to 6 letters, for example KID or LGT.');
    }
    const prefix = `MW-${letters}`;
    if (this.categories.some(c => c.prefix === prefix)) {
      throw new Error(`Prefix ${prefix} is already used by another category.`);
    }

    const newCat: Category = { name, prefix };
    this.categories.push(newCat);
    this.saveToStorage();
    return newCat;
  }

  /** Deletes a category, but only if no items still belong to it. */
  deleteCategory(categoryName: string): boolean {
    const count = this.getAllItems().filter(item => item.category === categoryName).length;
    if (count > 0) {
      throw new Error(
        `Cannot delete "${categoryName}" because ${count} inventory item(s) are currently categorized under it. Please reassign or delete these items first.`
      );
    }
    const before = this.categories.length;
    this.categories = this.categories.filter(c => c.name !== categoryName);
    if (this.categories.length === before) {
      throw new Error(`Category "${categoryName}" was not found.`);
    }
    this.saveToStorage();
    return true;
  }

  /**
   * Makes the next free SKU for a category, e.g. MW-LIV-009.
   * Starts from the number of items in the category and counts up
   * until it finds a code that is not taken.
   */
  generateSku(category: string): string {
    const catObj = this.categories.find(c => c.name === category);
    const prefix = catObj ? catObj.prefix : 'MW-GEN';
    let count = this.getAllItems().filter(item => item.category === category).length + 1;
    let candidate = `${prefix}-${String(count).padStart(3, '0')}`;
    while (this.items.has(candidate)) {
      count++;
      candidate = `${prefix}-${String(count).padStart(3, '0')}`;
    }
    return candidate;
  }

  // ===================================================================
  // Stock actions
  // ===================================================================

  /**
   * Registers a new product. Every input is checked here, not only in the
   * form, so bad data is refused however it reaches the class (tests L01-L04).
   */
  addStock(
    name: string,
    category: string,
    initialQuantity: number | string,
    unitPrice: number | string,
    customCode = '',
    type: FurnitureType = 'STANDARD'
  ): FurnitureItem {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Item name cannot be empty.');
    }
    if (!this.categories.some(c => c.name === category)) {
      throw new Error('Please choose a category from the list.');
    }
    const qty = Number(initialQuantity);
    if (!FurnitureItem.isWholeNumber(qty) || qty < 0) {
      throw new Error('Initial quantity must be a whole number of 0 or more.');
    }
    const price = Number(unitPrice);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error('Unit price must be more than 0 AED.');
    }

    // Use the typed SKU if there is one, otherwise generate the next one.
    const code = customCode.trim() ? customCode.trim().toUpperCase() : this.generateSku(category);
    if (this.items.has(code)) {
      throw new Error(`SKU Code "${code}" already exists in the system.`);
    }

    const newItem = createFurnitureItem(type, code, trimmedName, category, qty, price);
    this.items.set(code, newItem);
    this.saveToStorage();
    return newItem;
  }

  /**
   * Reserves stock for a customer order.
   * Order of checks: item exists -> whole positive quantity -> order number
   * and customer filled in -> enough stock (overselling guard).
   */
  allocateStock(
    itemCode: string,
    quantity: number | string,
    orderNumber: string,
    customerRef: string
  ): OperationResult {
    const item = this.items.get(itemCode);
    if (!item) {
      return { success: false, message: `Item code ${itemCode} was not found.` };
    }

    const qty = Number(quantity);
    if (!FurnitureItem.isWholeNumber(qty) || qty <= 0) {
      return { success: false, message: 'Allocation quantity must be a whole number greater than zero.' };
    }

    const order = orderNumber.trim();
    const customer = customerRef.trim();
    if (!order || !customer) {
      return { success: false, message: 'Please enter both a customer name and an order number.' };
    }

    // Overselling guard: never reserve more than is free to sell.
    const available = item.getAvailableStock();
    if (qty > available) {
      return {
        success: false,
        message: `Overselling Prevented: Order requires ${qty} unit(s) of "${item.name}", but only ${available} unit(s) are currently available in stock.`
      };
    }
    if (!item.allocate(qty)) {
      return { success: false, message: 'Could not allocate stock due to balance constraints.' };
    }

    const newAllocation = new OrderAllocation(this.nextAllocationId(), item.itemCode, customer, order, qty);
    this.allocations.unshift(newAllocation); // newest first
    this.saveToStorage();

    return {
      success: true,
      message: `Successfully allocated ${qty} unit(s) of "${item.name}" to Order #${order}. ${item.getHandlingNote()}`,
      allocation: newAllocation
    };
  }

  /**
   * Gives the next allocation ID in sequence (ALC-1001, ALC-1002 ...).
   * The old version used a random number, which repeated (test L09).
   */
  private nextAllocationId(): string {
    const highest = this.allocations.reduce((max, a) => {
      const n = Number(a.id.replace('ALC-', ''));
      return Number.isFinite(n) && n > max ? n : max;
    }, 1000);
    return `ALC-${highest + 1}`;
  }

  /** Cancels an active order and returns its units to available stock. */
  cancelAllocation(allocationId: string): OperationResult {
    const alloc = this.allocations.find(a => a.id === allocationId);
    if (!alloc || !alloc.isActive()) {
      return { success: false, message: 'Allocation record not eligible for cancellation.' };
    }
    this.items.get(alloc.itemCode)?.deallocate(alloc.quantity);
    alloc.markCancelled();
    this.saveToStorage();
    return { success: true, message: `Allocation ${allocationId} cancelled and stock returned to available balance.` };
  }

  /** Marks an active order as shipped: its units leave the warehouse. */
  dispatchAllocation(allocationId: string): OperationResult {
    const alloc = this.allocations.find(a => a.id === allocationId);
    if (!alloc || !alloc.isActive()) {
      return { success: false, message: 'Allocation record not active.' };
    }
    this.items.get(alloc.itemCode)?.dispatch(alloc.quantity);
    alloc.markDispatched();
    this.saveToStorage();
    return { success: true, message: `Order #${alloc.orderNumber} marked as dispatched. Stock levels deducted.` };
  }

  /** Adds a delivery of new units to an item. */
  restockItem(itemCode: string, quantity: number | string): OperationResult {
    const item = this.items.get(itemCode);
    if (!item) {
      return { success: false, message: 'Item not found.' };
    }
    try {
      item.restock(Number(quantity)); // the item checks the quantity itself
      this.saveToStorage();
      return { success: true, message: `Added ${quantity} units to "${item.name}". New on-hand balance: ${item.stockLevel}.` };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : 'Restock failed.' };
    }
  }

  /** Sets the on-hand count after a physical stock check. */
  editStock(itemCode: string, newStockLevel: number | string): OperationResult {
    const item = this.items.get(itemCode);
    if (!item) {
      return { success: false, message: 'Item not found.' };
    }
    try {
      item.setStockLevel(Number(newStockLevel)); // refuses values below reserved units
      this.saveToStorage();
      return {
        success: true,
        message: `Updated "${item.name}" stock level to ${item.stockLevel} units. Current available for sale: ${item.getAvailableStock()} units.`
      };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : 'Stock adjustment failed.' };
    }
  }

  /** Units free to sell for one SKU (0 if the SKU does not exist). */
  calculateAvailableBalance(itemCode: string): number {
    return this.items.get(itemCode)?.getAvailableStock() ?? 0;
  }

  // ===================================================================
  // Reports
  // ===================================================================

  /**
   * Builds the valuation report: store-wide totals plus one row per category.
   * Loops through every item once, adding to both the totals and its category row.
   */
  generateStockReport(): StockReport {
    const items = this.getAllItems();
    let totalUnitsOnHand = 0;
    let totalAllocatedUnits = 0;
    let totalAvailableUnits = 0;
    let totalValuation = 0;

    // Start every known category at zero so empty categories still appear.
    const categoryStats: Record<string, CategoryStat> = {};
    const emptyStat = (category: string): CategoryStat => ({
      category, skuCount: 0, onHand: 0, allocated: 0, available: 0, valuation: 0
    });
    this.categories.forEach(cat => { categoryStats[cat.name] = emptyStat(cat.name); });

    items.forEach(item => {
      totalUnitsOnHand += item.stockLevel;
      totalAllocatedUnits += item.allocatedCount;
      totalAvailableUnits += item.getAvailableStock();
      totalValuation += item.getTotalValuation();

      const cat = categoryStats[item.category] ?? (categoryStats[item.category] = emptyStat(item.category));
      cat.skuCount += 1;
      cat.onHand += item.stockLevel;
      cat.allocated += item.allocatedCount;
      cat.available += item.getAvailableStock();
      cat.valuation += item.getTotalValuation();
    });

    // Date and time the report was produced, e.g. "Mon, Nov 16, 2026 at 06:30:00 PM".
    const now = new Date();
    const generatedDate =
      now.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) +
      ' at ' +
      now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return {
      totalSkus: items.length,
      totalUnitsOnHand,
      totalAllocatedUnits,
      totalAvailableUnits,
      totalValuation,
      categoryBreakdown: Object.values(categoryStats),
      generatedDate
    };
  }

  /**
   * Lists items that are at or below their low-stock level and suggests how
   * many to order from the manufacturer. The target is three times the item's
   * own threshold, so large and standard items get different suggestions
   * (polymorphism: getLowStockThreshold() differs by subclass).
   */
  getReorderSuggestions(): ReorderSuggestion[] {
    return this.getAllItems()
      .filter(item => item.getAvailableStock() <= item.getLowStockThreshold())
      .map(item => {
        const threshold = item.getLowStockThreshold();
        const available = item.getAvailableStock();
        return {
          itemCode: item.itemCode,
          name: item.name,
          typeLabel: item.getTypeLabel(),
          available,
          threshold,
          suggestedQty: threshold * 3 - available
        };
      })
      .sort((a, b) => a.available - b.available); // most urgent first
  }

  /**
   * Returns the items that match the search text, category and stock status.
   * An item must pass all three checks to be shown.
   */
  filterItems(query = '', category = 'ALL', stockStatus = 'ALL'): FurnitureItem[] {
    const q = query.trim().toLowerCase();
    const statusLabels: Record<string, string> = {
      IN_STOCK: 'In Stock',
      LOW_STOCK: 'Low Stock',
      OUT_OF_STOCK: 'Out of Stock'
    };
    return this.getAllItems().filter(item => {
      const matchesQuery = !q || item.name.toLowerCase().includes(q) || item.itemCode.toLowerCase().includes(q);
      const matchesCategory = category === 'ALL' || item.category === category;
      // Uses each item's own getStatus(), so the type-specific thresholds apply.
      const matchesStatus = stockStatus === 'ALL' || item.getStatus().label === statusLabels[stockStatus];
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }
}

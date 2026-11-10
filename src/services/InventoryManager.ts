import { FurnitureItem } from '../models/FurnitureItem';
import { OrderAllocation } from '../models/OrderAllocation';
import {
  Category,
  CategoryStat,
  StockReport,
  OperationResult
} from '../types/inventory';

/**
 * InventoryManager handles stock calculations, allocations, categories, and persistence.
 */
export class InventoryManager {
  private readonly storageKeyItems = 'mazbay_wood_items_aed_v5';
  private readonly storageKeyAllocations = 'mazbay_wood_allocations_aed_v5';
  private readonly storageKeyCategories = 'mazbay_wood_categories_v5';

  items: Map<string, FurnitureItem>;
  allocations: OrderAllocation[];
  categories: Category[];

  constructor() {
    this.items = new Map();
    this.allocations = [];
    this.categories = [];

    this.loadFromStorage();
  }

  /**
   * Load data from localStorage or initialize with seed data.
   */
  loadFromStorage(): void {
    try {
      const storedCategories = localStorage.getItem(this.storageKeyCategories);
      const storedItems = localStorage.getItem(this.storageKeyItems);
      const storedAllocations = localStorage.getItem(this.storageKeyAllocations);

      if (storedCategories) {
        this.categories = JSON.parse(storedCategories);
      } else {
        this.seedInitialCategories();
      }

      if (storedItems) {
        const raw = JSON.parse(storedItems);
        raw.forEach((data: {
          itemCode: string;
          name: string;
          category: string;
          stockLevel: number;
          allocatedCount: number;
          unitPrice: number;
          dateAdded: string;
        }) => {
          const item = new FurnitureItem(
            data.itemCode,
            data.name,
            data.category,
            data.stockLevel,
            data.allocatedCount,
            data.unitPrice,
            data.dateAdded
          );
          this.items.set(item.itemCode, item);
        });
      } else {
        this.seedInitialInventory();
      }

      if (storedAllocations) {
        const rawAlloc = JSON.parse(storedAllocations);
        this.allocations = rawAlloc.map((a: {
          id: string;
          itemCode: string;
          customerRef: string;
          orderNumber: string;
          quantity: number;
          date: string;
          status: 'ACTIVE' | 'DISPATCHED' | 'CANCELLED';
        }) => new OrderAllocation(
          a.id,
          a.itemCode,
          a.customerRef,
          a.orderNumber,
          a.quantity,
          a.date,
          a.status
        ));
      } else {
        this.seedInitialAllocations();
      }
    } catch (err) {
      console.error('Error loading inventory data:', err);
      this.seedInitialCategories();
      this.seedInitialInventory();
    }
  }

  /**
   * Persist current state to localStorage.
   */
  saveToStorage(): void {
    try {
      const itemsArray = Array.from(this.items.values());
      localStorage.setItem(this.storageKeyItems, JSON.stringify(itemsArray));
      localStorage.setItem(this.storageKeyAllocations, JSON.stringify(this.allocations));
      localStorage.setItem(this.storageKeyCategories, JSON.stringify(this.categories));
    } catch (err) {
      console.error('Error saving inventory data:', err);
    }
  }

  /**
   * Seed baseline furniture categories.
   */
  seedInitialCategories(): void {
    this.categories = [
      { name: 'Living Room', prefix: 'MW-LIV' },
      { name: 'Dining Room', prefix: 'MW-DIN' },
      { name: 'Bedroom', prefix: 'MW-BED' },
      { name: 'Home Office', prefix: 'MW-OFF' },
      { name: 'Storage & Accents', prefix: 'MW-ACC' },
      { name: 'Outdoor & Patio', prefix: 'MW-OUT' }
    ];
    this.saveToStorage();
  }

  /**
   * Seed initial showroom items priced in AED.
   */
  seedInitialInventory(): void {
    const seedData = [
      new FurnitureItem('MW-DIN-001', 'Dining Table', 'Dining Room', 12, 3, 3200.00),
      new FurnitureItem('MW-LIV-002', 'TV Console Cabinet', 'Living Room', 8, 2, 4250.00),
      new FurnitureItem('MW-LIV-003', 'Lounge Armchair', 'Living Room', 15, 4, 1850.00),
      new FurnitureItem('MW-BED-004', 'Queen Bed Frame', 'Bedroom', 6, 1, 3600.00),
      new FurnitureItem('MW-OFF-005', 'Office Study Desk', 'Home Office', 10, 2, 2150.00),
      new FurnitureItem('MW-ACC-006', '5-Tier Bookshelf', 'Storage & Accents', 5, 0, 2650.00),
      new FurnitureItem('MW-DIN-007', 'Dining Chairs (Set of 2)', 'Dining Room', 18, 6, 1200.00),
      new FurnitureItem('MW-BED-008', 'Bedside Nightstand', 'Bedroom', 3, 2, 890.00)
    ];
    seedData.forEach(item => this.items.set(item.itemCode, item));
    this.saveToStorage();
  }

  /**
   * Seed sample customer order reservations.
   */
  seedInitialAllocations(): void {
    this.allocations = [
      new OrderAllocation(
        'ALC-1001',
        'MW-DIN-001',
        'Tariq Al-Mansoor',
        'SO-7841',
        2,
        new Date(Date.now() - 86400000).toISOString(),
        'ACTIVE'
      ),
      new OrderAllocation(
        'ALC-1002',
        'MW-LIV-003',
        'Hassan Bin Rashid',
        'SO-7845',
        2,
        new Date(Date.now() - 43200000).toISOString(),
        'ACTIVE'
      )
    ];
    this.saveToStorage();
  }

  /**
   * Add a new category with unique name and prefix validation.
   */
  addCategory(categoryName: string, customPrefix = ''): Category {
    const name = categoryName.trim();
    if (!name) {
      throw new Error('Category name cannot be empty.');
    }

    const exists = this.categories.some(c => c.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      throw new Error(`Category "${name}" already exists.`);
    }

    let prefix = customPrefix.trim().toUpperCase();
    if (!prefix) {
      const clean = name.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3);
      prefix = `MW-${clean || 'GEN'}`;
    } else if (!prefix.startsWith('MW-')) {
      prefix = `MW-${prefix}`;
    }

    const newCat: Category = { name, prefix };
    this.categories.push(newCat);
    this.saveToStorage();
    return newCat;
  }

  /**
   * Delete an existing category if no active inventory is attached.
   */
  deleteCategory(categoryName: string): boolean {
    const associatedItems = Array.from(this.items.values()).filter(item => item.category === categoryName);
    if (associatedItems.length > 0) {
      throw new Error(
        `Cannot delete "${categoryName}" because ${associatedItems.length} inventory item(s) are currently categorized under it. Please reassign or delete these items first.`
      );
    }

    const initialCount = this.categories.length;
    this.categories = this.categories.filter(c => c.name !== categoryName);
    if (this.categories.length === initialCount) {
      throw new Error(`Category "${categoryName}" was not found.`);
    }

    this.saveToStorage();
    return true;
  }

  /**
   * Returns list of all categories.
   */
  getCategories(): Category[] {
    return this.categories;
  }

  /**
   * Generates a sequential SKU code based on category prefix.
   */
  generateSku(category: string): string {
    const catObj = this.categories.find(c => c.name === category);
    const prefix = catObj ? catObj.prefix : 'MW-GEN';

    let count = 1;
    this.items.forEach(item => {
      if (item.category === category) count++;
    });
    let candidate = `${prefix}-${String(count).padStart(3, '0')}`;
    while (this.items.has(candidate)) {
      count++;
      candidate = `${prefix}-${String(count).padStart(3, '0')}`;
    }
    return candidate;
  }

  /**
   * Register a new furniture item in stock.
   */
  addStock(
    name: string,
    category: string,
    initialQuantity: number | string,
    unitPrice: number | string,
    customCode = ''
  ): FurnitureItem {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Item name cannot be empty.');
    }
    const qty = Number(initialQuantity);
    if (isNaN(qty) || qty < 0) {
      throw new Error('Initial quantity must be a non-negative number.');
    }
    const price = Number(unitPrice);
    if (isNaN(price) || price < 0) {
      throw new Error('Unit price must be a valid positive amount in AED.');
    }

    const code = (customCode && customCode.trim())
      ? customCode.trim().toUpperCase()
      : this.generateSku(category);

    if (this.items.has(code)) {
      throw new Error(`SKU Code "${code}" already exists in the system.`);
    }

    const newItem = new FurnitureItem(code, trimmedName, category, qty, 0, price);
    this.items.set(code, newItem);
    this.saveToStorage();
    return newItem;
  }

  /**
   * Reserve units for a customer order with overselling prevention.
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
    if (isNaN(qty) || qty <= 0) {
      return { success: false, message: 'Allocation quantity must be greater than zero.' };
    }

    const available = item.getAvailableStock();
    if (qty > available) {
      return {
        success: false,
        message: `Overselling Prevented: Order requires ${qty} unit(s) of "${item.name}", but only ${available} unit(s) are currently available in stock.`
      };
    }

    const allocatedOk = item.allocate(qty);
    if (!allocatedOk) {
      return { success: false, message: 'Could not allocate stock due to balance constraints.' };
    }

    const allocId = 'ALC-' + Math.floor(1000 + Math.random() * 9000);
    const newAllocation = new OrderAllocation(
      allocId,
      item.itemCode,
      customerRef.trim(),
      orderNumber.trim(),
      qty
    );
    this.allocations.unshift(newAllocation);
    this.saveToStorage();

    return {
      success: true,
      message: `Successfully allocated ${qty} unit(s) of "${item.name}" to Order #${orderNumber}.`,
      allocation: newAllocation
    };
  }

  /**
   * Cancel an active order allocation and restore available stock.
   */
  cancelAllocation(allocationId: string): OperationResult {
    const alloc = this.allocations.find(a => a.id === allocationId);
    if (!alloc || alloc.status !== 'ACTIVE') {
      return { success: false, message: 'Allocation record not eligible for cancellation.' };
    }

    const item = this.items.get(alloc.itemCode);
    if (item) {
      item.deallocate(alloc.quantity);
    }
    alloc.status = 'CANCELLED';
    this.saveToStorage();
    return {
      success: true,
      message: `Allocation ${allocationId} cancelled and stock returned to available balance.`
    };
  }

  /**
   * Mark an allocation as dispatched, finalizing the stock deduction.
   */
  dispatchAllocation(allocationId: string): OperationResult {
    const alloc = this.allocations.find(a => a.id === allocationId);
    if (!alloc || alloc.status !== 'ACTIVE') {
      return { success: false, message: 'Allocation record not active.' };
    }

    const item = this.items.get(alloc.itemCode);
    if (item) {
      item.dispatch(alloc.quantity);
    }
    alloc.status = 'DISPATCHED';
    this.saveToStorage();
    return {
      success: true,
      message: `Order #${alloc.orderNumber} marked as dispatched. Stock levels deducted.`
    };
  }

  /**
   * Increase physical stock for an item.
   */
  restockItem(itemCode: string, quantity: number | string): OperationResult {
    const item = this.items.get(itemCode);
    if (!item) {
      return { success: false, message: 'Item not found.' };
    }
    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      return { success: false, message: 'Restock quantity must be positive.' };
    }
    item.restock(qty);
    this.saveToStorage();
    return {
      success: true,
      message: `Added ${qty} units to "${item.name}". New on-hand balance: ${item.stockLevel}.`
    };
  }

  /**
   * Set physical on-hand stock count with reservation validation.
   */
  editStock(itemCode: string, newStockLevel: number | string): OperationResult {
    const item = this.items.get(itemCode);
    if (!item) {
      return { success: false, message: 'Item not found.' };
    }
    try {
      item.setStockLevel(Number(newStockLevel));
      this.saveToStorage();
      return {
        success: true,
        message: `Updated "${item.name}" stock level to ${item.stockLevel} units. Current available for sale: ${item.getAvailableStock()} units.`
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Stock adjustment failed.';
      return { success: false, message: msg };
    }
  }

  /**
   * Get available stock balance for a specific item SKU.
   */
  calculateAvailableBalance(itemCode: string): number {
    const item = this.items.get(itemCode);
    return item ? item.getAvailableStock() : 0;
  }

  /**
   * Generate comprehensive stock report and category valuations in AED.
   */
  generateStockReport(): StockReport {
    const items = Array.from(this.items.values());
    let totalUnitsOnHand = 0;
    let totalAllocatedUnits = 0;
    let totalAvailableUnits = 0;
    let totalValuation = 0;

    const categoryStats: Record<string, CategoryStat> = {};

    this.categories.forEach(cat => {
      categoryStats[cat.name] = {
        category: cat.name,
        skuCount: 0,
        onHand: 0,
        allocated: 0,
        available: 0,
        valuation: 0
      };
    });

    items.forEach(item => {
      totalUnitsOnHand += item.stockLevel;
      totalAllocatedUnits += item.allocatedCount;
      totalAvailableUnits += item.getAvailableStock();
      totalValuation += item.getTotalValuation();

      if (!categoryStats[item.category]) {
        categoryStats[item.category] = {
          category: item.category,
          skuCount: 0,
          onHand: 0,
          allocated: 0,
          available: 0,
          valuation: 0
        };
      }
      const cat = categoryStats[item.category];
      cat.skuCount += 1;
      cat.onHand += item.stockLevel;
      cat.allocated += item.allocatedCount;
      cat.available += item.getAvailableStock();
      cat.valuation += item.getTotalValuation();
    });

    const reportDate = new Date();
    const formattedDate =
      reportDate.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) +
      ' at ' +
      reportDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

    return {
      totalSkus: items.length,
      totalUnitsOnHand,
      totalAllocatedUnits,
      totalAvailableUnits,
      totalValuation,
      categoryBreakdown: Object.values(categoryStats),
      generatedDate: formattedDate
    };
  }

  /**
   * Search and filter items by search query, category, and stock status.
   */
  filterItems(query = '', category = 'ALL', stockStatus = 'ALL'): FurnitureItem[] {
    const q = query.trim().toLowerCase();
    return Array.from(this.items.values()).filter(item => {
      const matchesQuery =
        !q || item.name.toLowerCase().includes(q) || item.itemCode.toLowerCase().includes(q);
      const matchesCategory = category === 'ALL' || item.category === category;
      let matchesStatus = true;
      const available = item.getAvailableStock();

      if (stockStatus === 'IN_STOCK') {
        matchesStatus = available > 3;
      } else if (stockStatus === 'LOW_STOCK') {
        matchesStatus = available > 0 && available <= 3;
      } else if (stockStatus === 'OUT_OF_STOCK') {
        matchesStatus = available === 0;
      }

      return matchesQuery && matchesCategory && matchesStatus;
    });
  }
}

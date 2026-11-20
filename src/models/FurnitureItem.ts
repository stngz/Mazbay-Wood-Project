import { FurnitureType, ItemStatus, StoredItem } from '../types/inventory';

/**
 * FurnitureItem is the ABSTRACT BASE CLASS for every product the store sells.
 *
 * OOP features shown in this file:
 *  - Encapsulation: the stock figures are `private`. Outside code can only READ
 *    them through getters, and can only CHANGE them through methods such as
 *    allocate() and restock(), which check the change is valid first.
 *  - Inheritance: LargeFurnitureItem and StandardFurnitureItem (FurnitureTypes.ts)
 *    extend this class and inherit all of its fields and methods.
 *  - Polymorphism: getLowStockThreshold(), getTypeLabel() and getHandlingNote()
 *    are `abstract`. Each subclass gives its own version, and getStatus() calls
 *    whichever version belongs to the object it is working on.
 *
 * `abstract` means you cannot create a plain FurnitureItem; you must create
 * one of the subclasses.
 */
export abstract class FurnitureItem {
  // ---- Private data (encapsulation) ----
  // `readonly` values are set once in the constructor and never change.
  private readonly _itemCode: string;    // unique SKU, e.g. "MW-DIN-001"
  private readonly _name: string;        // product name shown to staff
  private readonly _category: string;    // category name, e.g. "Dining Room"
  private readonly _dateAdded: string;   // ISO date the item was registered
  private _stockLevel: number;           // physical units in the warehouse
  private _allocatedCount: number;       // units reserved for customer orders
  private _unitPrice: number;            // selling price of one unit in AED

  /**
   * Creates a furniture item. Called by the subclasses through super(...).
   * @param itemCode   unique SKU code
   * @param name       product name
   * @param category   category name
   * @param stockLevel units on hand (whole number, 0 or more)
   * @param unitPrice  price per unit in AED (more than 0)
   * @param dateAdded  optional ISO date; defaults to now
   */
  protected constructor(
    itemCode: string,
    name: string,
    category: string,
    stockLevel: number,
    unitPrice: number,
    dateAdded: string | null = null
  ) {
    // Validate before storing, so an item can never exist in an invalid state.
    if (!FurnitureItem.isWholeNumber(stockLevel) || stockLevel < 0) {
      throw new Error('Stock level must be a whole number of 0 or more.');
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new Error('Unit price must be more than 0 AED.');
    }
    this._itemCode = itemCode;
    this._name = name;
    this._category = category;
    this._stockLevel = stockLevel;
    this._allocatedCount = 0; // reservations are added later through allocate()
    this._unitPrice = unitPrice;
    this._dateAdded = dateAdded || new Date().toISOString();
  }

  // ---- Abstract methods: each subclass must supply its own version (polymorphism) ----

  /** Available units at or below this number count as "Low Stock". */
  abstract getLowStockThreshold(): number;

  /** Short label for the kind of item, e.g. "Large". */
  abstract getTypeLabel(): string;

  /** Delivery instruction shown when this item is allocated to an order. */
  abstract getHandlingNote(): string;

  /** The type code saved to storage so the right subclass is rebuilt on load. */
  abstract getType(): FurnitureType;

  // ---- Getters: read-only access to the private data ----
  get itemCode(): string { return this._itemCode; }
  get name(): string { return this._name; }
  get category(): string { return this._category; }
  get dateAdded(): string { return this._dateAdded; }
  get stockLevel(): number { return this._stockLevel; }
  get allocatedCount(): number { return this._allocatedCount; }
  get unitPrice(): number { return this._unitPrice; }

  /** Returns true when value is a whole number (no decimals, not NaN). */
  static isWholeNumber(value: number): boolean {
    return Number.isInteger(value);
  }

  /** Units free to sell: on hand minus reserved, never below 0. */
  getAvailableStock(): number {
    return Math.max(0, this._stockLevel - this._allocatedCount);
  }

  /** True if qty is a positive whole number that fits within available stock. */
  canAllocate(qty: number): boolean {
    return FurnitureItem.isWholeNumber(qty) && qty > 0 && qty <= this.getAvailableStock();
  }

  /**
   * Reserves qty units for an order.
   * Returns false (and changes nothing) if that would oversell the item.
   */
  allocate(qty: number): boolean {
    if (!this.canAllocate(qty)) {
      return false;
    }
    this._allocatedCount += qty;
    return true;
  }

  /** Releases qty reserved units back to available stock (used when an order is cancelled). */
  deallocate(qty: number): void {
    this._allocatedCount = Math.max(0, this._allocatedCount - qty);
  }

  /** Ships qty units: they leave the reservation AND the warehouse. */
  dispatch(qty: number): void {
    this._allocatedCount = Math.max(0, this._allocatedCount - qty);
    this._stockLevel = Math.max(0, this._stockLevel - qty);
  }

  /** Adds newly delivered units to the warehouse count. */
  restock(qty: number): void {
    if (!FurnitureItem.isWholeNumber(qty) || qty <= 0) {
      throw new Error('Restock quantity must be a whole number greater than 0.');
    }
    this._stockLevel += qty;
  }

  /**
   * Replaces the on-hand count after a physical stock check.
   * Refuses any number below the units already promised to customers.
   */
  setStockLevel(newLevel: number): void {
    if (!FurnitureItem.isWholeNumber(newLevel) || newLevel < 0) {
      throw new Error('Stock level must be a whole number of 0 or more.');
    }
    if (newLevel < this._allocatedCount) {
      throw new Error(
        `Cannot set stock below ${this._allocatedCount} units, because ${this._allocatedCount} unit(s) are actively reserved for existing customer orders.`
      );
    }
    this._stockLevel = newLevel;
  }

  /** Value of every unit on hand: stock x price. */
  getTotalValuation(): number {
    return this._stockLevel * this._unitPrice;
  }

  /** Value of the units reserved for orders. */
  getAllocatedValuation(): number {
    return this._allocatedCount * this._unitPrice;
  }

  /** Value of the units still free to sell. */
  getAvailableValuation(): number {
    return this.getAvailableStock() * this._unitPrice;
  }

  /**
   * Works out the stock badge. This method is written once here, but the
   * threshold it compares against comes from the subclass (polymorphism),
   * so a large item and a standard item with the same stock can get
   * different badges.
   */
  getStatus(): ItemStatus {
    const available = this.getAvailableStock();
    if (available === 0) {
      return { label: 'Out of Stock', cssClass: 'badge-out-of-stock' };
    }
    if (available <= this.getLowStockThreshold()) {
      return { label: 'Low Stock', cssClass: 'badge-low-stock' };
    }
    return { label: 'In Stock', cssClass: 'badge-in-stock' };
  }

  /**
   * Called automatically by JSON.stringify when saving.
   * Saves plain data only; allocatedCount is not saved because it is
   * rebuilt from the order records each time the program loads.
   */
  toJSON(): StoredItem {
    return {
      itemCode: this._itemCode,
      name: this._name,
      category: this._category,
      type: this.getType(),
      stockLevel: this._stockLevel,
      unitPrice: this._unitPrice,
      dateAdded: this._dateAdded
    };
  }
}

import { ItemStatus } from '../types/inventory';

/**
 * FurnitureItem represents an individual furniture SKU with stock balances and valuation metrics in AED.
 */
export class FurnitureItem {
  itemCode: string;
  name: string;
  category: string;
  stockLevel: number;
  allocatedCount: number;
  unitPrice: number;
  dateAdded: string;

  constructor(
    itemCode: string,
    name: string,
    category: string,
    stockLevel: number,
    allocatedCount = 0,
    unitPrice = 0,
    dateAdded: string | null = null
  ) {
    this.itemCode = itemCode;
    this.name = name;
    this.category = category;
    this.stockLevel = Number(stockLevel) || 0;
    this.allocatedCount = Number(allocatedCount) || 0;
    this.unitPrice = Number(unitPrice) || 0;
    this.dateAdded = dateAdded || new Date().toISOString();
  }

  /**
   * Returns the quantity of units currently available for sale.
   */
  getAvailableStock(): number {
    return Math.max(0, this.stockLevel - this.allocatedCount);
  }

  /**
   * Checks whether a requested quantity can be allocated without overselling.
   */
  canAllocate(requestedQty: number): boolean {
    const qty = Number(requestedQty);
    return qty > 0 && qty <= this.getAvailableStock();
  }

  /**
   * Allocates units to an order if sufficient stock is available.
   */
  allocate(qty: number): boolean {
    const count = Number(qty);
    if (!this.canAllocate(count)) {
      return false;
    }
    this.allocatedCount += count;
    return true;
  }

  /**
   * Releases previously allocated units back into general available inventory.
   */
  deallocate(qty: number): void {
    const count = Number(qty);
    this.allocatedCount = Math.max(0, this.allocatedCount - count);
  }

  /**
   * Dispatches units for fulfillment, deducting from both allocated and on-hand counts.
   */
  dispatch(qty: number): void {
    const count = Number(qty);
    this.allocatedCount = Math.max(0, this.allocatedCount - count);
    this.stockLevel = Math.max(0, this.stockLevel - count);
  }

  /**
   * Increases on-hand stock count with newly received inventory.
   */
  restock(qty: number): void {
    const count = Number(qty);
    if (count > 0) {
      this.stockLevel += count;
    }
  }

  /**
   * Sets the total physical on-hand stock level while protecting existing reservations.
   */
  setStockLevel(newLevel: number): void {
    const target = Number(newLevel);
    if (isNaN(target) || target < 0) {
      throw new Error('Stock level must be a non-negative number.');
    }
    if (target < this.allocatedCount) {
      throw new Error(
        `Cannot set stock below ${this.allocatedCount} units, because ${this.allocatedCount} unit(s) are actively reserved for existing customer orders.`
      );
    }
    this.stockLevel = target;
  }

  /**
   * Calculates total valuation (AED) for all physical units on hand.
   */
  getTotalValuation(): number {
    return this.stockLevel * this.unitPrice;
  }

  /**
   * Calculates valuation (AED) of units currently reserved for customer orders.
   */
  getAllocatedValuation(): number {
    return this.allocatedCount * this.unitPrice;
  }

  /**
   * Calculates valuation (AED) of units available for immediate sale.
   */
  getAvailableValuation(): number {
    return this.getAvailableStock() * this.unitPrice;
  }

  /**
   * Returns current stock availability status badge descriptor.
   */
  getStatus(): ItemStatus {
    const available = this.getAvailableStock();
    if (this.stockLevel === 0 || available === 0) {
      return { label: 'Out of Stock', cssClass: 'badge-out-of-stock' };
    }
    if (available <= 3) {
      return { label: 'Low Stock', cssClass: 'badge-low-stock' };
    }
    return { label: 'In Stock', cssClass: 'badge-in-stock' };
  }
}

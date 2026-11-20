import { AllocationStatus, StoredAllocation } from '../types/inventory';

/**
 * OrderAllocation records units of one item reserved for one customer order.
 *
 * Encapsulation: the status is private. It can only move forward through
 * markDispatched() or markCancelled(), and only from ACTIVE, so an order
 * can never be dispatched twice or "un-cancelled".
 */
export class OrderAllocation {
  private readonly _id: string;            // e.g. "ALC-1007"
  private readonly _itemCode: string;      // SKU of the reserved item
  private readonly _customerRef: string;   // customer name or reference
  private readonly _orderNumber: string;   // sales order number, e.g. "SO-9001"
  private readonly _quantity: number;      // units reserved
  private readonly _date: string;          // ISO date of the reservation
  private _status: AllocationStatus;       // ACTIVE, DISPATCHED or CANCELLED

  constructor(
    id: string,
    itemCode: string,
    customerRef: string,
    orderNumber: string,
    quantity: number,
    date: string | null = null,
    status: AllocationStatus = 'ACTIVE'
  ) {
    this._id = id;
    this._itemCode = itemCode;
    this._customerRef = customerRef;
    this._orderNumber = orderNumber;
    this._quantity = quantity;
    this._date = date || new Date().toISOString();
    this._status = status;
  }

  // ---- Getters (read-only access) ----
  get id(): string { return this._id; }
  get itemCode(): string { return this._itemCode; }
  get customerRef(): string { return this._customerRef; }
  get orderNumber(): string { return this._orderNumber; }
  get quantity(): number { return this._quantity; }
  get date(): string { return this._date; }
  get status(): AllocationStatus { return this._status; }

  /** True while the units are still reserved and waiting to ship. */
  isActive(): boolean {
    return this._status === 'ACTIVE';
  }

  /** Moves an ACTIVE allocation to DISPATCHED. Returns false if not allowed. */
  markDispatched(): boolean {
    if (!this.isActive()) return false;
    this._status = 'DISPATCHED';
    return true;
  }

  /** Moves an ACTIVE allocation to CANCELLED. Returns false if not allowed. */
  markCancelled(): boolean {
    if (!this.isActive()) return false;
    this._status = 'CANCELLED';
    return true;
  }

  /** Plain data for saving to browser storage. */
  toJSON(): StoredAllocation {
    return {
      id: this._id,
      itemCode: this._itemCode,
      customerRef: this._customerRef,
      orderNumber: this._orderNumber,
      quantity: this._quantity,
      date: this._date,
      status: this._status
    };
  }
}

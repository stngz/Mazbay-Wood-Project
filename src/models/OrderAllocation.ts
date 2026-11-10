import { AllocationStatus } from '../types/inventory';

/**
 * OrderAllocation represents a reserved customer order allocation against stock.
 */
export class OrderAllocation {
  id: string;
  itemCode: string;
  customerRef: string;
  orderNumber: string;
  quantity: number;
  date: string;
  status: AllocationStatus;

  constructor(
    id: string,
    itemCode: string,
    customerRef: string,
    orderNumber: string,
    quantity: number,
    date: string | null = null,
    status: AllocationStatus = 'ACTIVE'
  ) {
    this.id = id;
    this.itemCode = itemCode;
    this.customerRef = customerRef;
    this.orderNumber = orderNumber;
    this.quantity = Number(quantity);
    this.date = date || new Date().toISOString();
    this.status = status;
  }
}

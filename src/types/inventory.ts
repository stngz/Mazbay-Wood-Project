export interface ItemStatus {
  label: string;
  cssClass: string;
}

export interface Category {
  name: string;
  prefix: string;
}

export type AllocationStatus = 'ACTIVE' | 'DISPATCHED' | 'CANCELLED';

export interface CategoryStat {
  category: string;
  skuCount: number;
  onHand: number;
  allocated: number;
  available: number;
  valuation: number;
}

export interface StockReport {
  totalSkus: number;
  totalUnitsOnHand: number;
  totalAllocatedUnits: number;
  totalAvailableUnits: number;
  totalValuation: number;
  categoryBreakdown: CategoryStat[];
  generatedDate: string;
}

export interface OperationResult {
  success: boolean;
  message: string;
  [key: string]: unknown;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';

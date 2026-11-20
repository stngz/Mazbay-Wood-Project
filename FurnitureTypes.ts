import { FurnitureItem } from './FurnitureItem';
import { FurnitureType } from '../types/inventory';

/**
 * FurnitureTypes.ts
 * The two concrete kinds of furniture. Both INHERIT from FurnitureItem
 * (`extends`), so they get every field and method of the base class for free,
 * and each OVERRIDES the abstract methods with its own rules (polymorphism).
 */

/**
 * Bulky items such as sofas, beds, wardrobes and dining tables.
 * They take weeks to reorder, so stock is flagged as low when 2 or fewer remain.
 */
export class LargeFurnitureItem extends FurnitureItem {
  constructor(
    itemCode: string,
    name: string,
    category: string,
    stockLevel: number,
    unitPrice: number,
    dateAdded: string | null = null
  ) {
    // super(...) runs the FurnitureItem constructor, including its validation.
    super(itemCode, name, category, stockLevel, unitPrice, dateAdded);
  }

  /** Override: large items are low at 2 or fewer available. */
  getLowStockThreshold(): number {
    return 2;
  }

  /** Override: label shown under the item name. */
  getTypeLabel(): string {
    return 'Large';
  }

  /** Override: large items need a two-person team. */
  getHandlingNote(): string {
    return 'Two-person delivery and in-home assembly required.';
  }

  getType(): FurnitureType {
    return 'LARGE';
  }
}

/**
 * Smaller items such as chairs, stools, nightstands and lamps.
 * They sell faster, so stock is flagged as low when 5 or fewer remain.
 */
export class StandardFurnitureItem extends FurnitureItem {
  constructor(
    itemCode: string,
    name: string,
    category: string,
    stockLevel: number,
    unitPrice: number,
    dateAdded: string | null = null
  ) {
    super(itemCode, name, category, stockLevel, unitPrice, dateAdded);
  }

  /** Override: standard items are low at 5 or fewer available. */
  getLowStockThreshold(): number {
    return 5;
  }

  getTypeLabel(): string {
    return 'Standard';
  }

  getHandlingNote(): string {
    return 'Standard courier delivery.';
  }

  getType(): FurnitureType {
    return 'STANDARD';
  }
}

/**
 * Factory function: builds the correct subclass from a type code.
 * The rest of the program calls this instead of choosing a class itself,
 * and then treats the result simply as a FurnitureItem.
 */
export function createFurnitureItem(
  type: FurnitureType,
  itemCode: string,
  name: string,
  category: string,
  stockLevel: number,
  unitPrice: number,
  dateAdded: string | null = null
): FurnitureItem {
  if (type === 'LARGE') {
    return new LargeFurnitureItem(itemCode, name, category, stockLevel, unitPrice, dateAdded);
  }
  return new StandardFurnitureItem(itemCode, name, category, stockLevel, unitPrice, dateAdded);
}

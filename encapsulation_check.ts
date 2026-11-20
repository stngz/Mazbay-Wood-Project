/**
 * Encapsulation check (test L11).
 * This file tries to change an item's reserved count directly, skipping every
 * stock rule. Because allocatedCount is a read-only getter over a private field,
 * the TypeScript compiler must REFUSE this file.
 *
 * Run:  npm run check:encapsulation
 * Expected result: error TS2540: Cannot assign to 'allocatedCount' because it is a read-only property.
 */
import { InventoryManager } from '../src/services/InventoryManager';

const manager = new InventoryManager();
const item = manager.getItem('MW-DIN-001')!;
item.allocatedCount = 999; // direct write that skips every stock check

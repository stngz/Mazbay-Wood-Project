import './style.css';
import { InventoryManager } from './services/InventoryManager';
import { UIManager } from './ui/UIManager';

declare global {
  interface Window {
    inventoryManager: InventoryManager;
    ui: UIManager;
  }
}

let inventoryManager: InventoryManager;
let ui: UIManager;

document.addEventListener('DOMContentLoaded', () => {
  inventoryManager = new InventoryManager();
  ui = new UIManager(inventoryManager);

  window.inventoryManager = inventoryManager;
  window.ui = ui;
});

export { inventoryManager, ui };

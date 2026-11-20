/**
 * main.ts
 * The program's starting point. Vite loads this file from index.html.
 * It waits for the page to finish loading, then creates the two main objects:
 *  - InventoryManager: holds the data and the business rules
 *  - UIManager: draws the screen and responds to the user
 */
import './style.css';
import { InventoryManager } from './services/InventoryManager';
import { UIManager } from './ui/UIManager';

// DOMContentLoaded fires once all the HTML elements exist, so UIManager
// can safely find the forms and tables it needs.
document.addEventListener('DOMContentLoaded', () => {
  const inventoryManager = new InventoryManager(); // loads saved data or sample data
  new UIManager(inventoryManager);                 // connects the page to the manager
});

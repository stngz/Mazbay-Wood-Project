import { InventoryManager } from '../services/InventoryManager';
import { FurnitureType, ToastType } from '../types/inventory';

/**
 * Converts text typed by a user into safe HTML by replacing the characters
 * that HTML treats as code. Without this, a name such as "<b>Sofa</b>" was
 * drawn in bold, and a name containing a script could run code (test T04).
 */
function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Shortcut: finds an element by id and treats it as the given element type. */
function el<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/** Shortcut: reads the current value of an input or select box. */
function valueOf(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value ?? '';
}

/**
 * UIManager connects the web page to InventoryManager.
 * It reads what the user types, asks InventoryManager to act, then redraws
 * the tables and shows a message. It contains no stock rules of its own.
 */
export class UIManager {
  private readonly manager: InventoryManager;   // the business logic object
  private currentTab: string;                   // id of the tab on screen

  constructor(inventoryManager: InventoryManager) {
    this.manager = inventoryManager;
    this.currentTab = 'tab-inventory';
    this.init();
  }

  /** Connects every button, form and filter, then draws the first screen. */
  private init(): void {
    this.setupNavigation();
    this.setupForms();
    this.setupModals();
    this.setupFilters();
    this.setupTableActions();
    this.startClock();
    this.renderAll();
  }

  // ===================================================================
  // Setup: event listeners
  // ===================================================================

  /** Updates the clock in the header once a second. */
  private startClock(): void {
    const update = () => {
      const now = new Date();
      const clock = el('liveClockText');
      if (clock) {
        clock.textContent =
          now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
          ' - ' +
          now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    };
    update();
    setInterval(update, 1000); // repeat every 1000 milliseconds
  }

  /** Makes the tabs switch panels, and refreshes a panel's data when it opens. */
  private setupNavigation(): void {
    const tabs = document.querySelectorAll<HTMLButtonElement>('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.dataset.tab;
        if (!targetId) return;

        // Highlight the clicked tab only.
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Show the matching panel and hide the rest.
        document.querySelectorAll<HTMLElement>('.tab-panel').forEach(panel => {
          panel.style.display = panel.id === targetId ? 'block' : 'none';
        });
        this.currentTab = targetId;

        // Some panels need fresh numbers each time they are opened.
        if (targetId === 'tab-report') {
          this.renderReportView();
        } else if (targetId === 'tab-allocation') {
          this.populateAllocationDropdown();
          this.renderAllocationsTable();
        } else if (targetId === 'tab-categories') {
          this.renderCategoriesTable();
        }
      });
    });
  }

  /** Handles the submit button of each main form. */
  private setupForms(): void {
    // ---- Add New Stock form ----
    const addForm = el<HTMLFormElement>('addStockForm');
    addForm?.addEventListener('submit', (e: Event) => {
      e.preventDefault(); // stop the browser reloading the page
      try {
        const newItem = this.manager.addStock(
          valueOf('newItemName'),
          valueOf('newItemCategory'),
          valueOf('newItemQuantity'),
          valueOf('newItemPrice'),
          valueOf('newItemCustomSku'),
          (valueOf('newItemType') || 'STANDARD') as FurnitureType
        );
        this.showToast(
          'success',
          'Stock Added',
          `Registered "${newItem.name}" (${newItem.getTypeLabel()}) under SKU [${newItem.itemCode}] at ${this.formatCurrency(newItem.unitPrice)}.`
        );
        addForm.reset();
        this.renderAll();
        // Jump back to the stock list so the user sees the new row.
        document.querySelector<HTMLButtonElement>('[data-tab="tab-inventory"]')?.click();
      } catch (err: unknown) {
        // addStock() throws an Error with a readable message when input is invalid.
        this.showToast('error', 'Registration Error', err instanceof Error ? err.message : 'Registration error');
      }
    });

    // ---- Add Category form ----
    const addCatForm = el<HTMLFormElement>('addCategoryForm');
    addCatForm?.addEventListener('submit', (e: Event) => {
      e.preventDefault();
      try {
        const newCat = this.manager.addCategory(valueOf('newCategoryName'), valueOf('newCategorySkuPrefix'));
        this.showToast('success', 'Category Created', `Added category "${newCat.name}" with prefix [${newCat.prefix}]. Selection dropdowns have been updated.`);
        addCatForm.reset();
        this.renderAll();
      } catch (err: unknown) {
        this.showToast('error', 'Category Error', err instanceof Error ? err.message : 'Category error');
      }
    });

    // ---- Order Allocation form ----
    const allocForm = el<HTMLFormElement>('allocateStockForm');
    allocForm?.addEventListener('submit', (e: Event) => {
      e.preventDefault();
      const itemCode = valueOf('allocItemSelect');
      if (!itemCode) {
        this.showToast('warning', 'Selection Required', 'Please select an item to allocate.');
        return;
      }
      const result = this.manager.allocateStock(
        itemCode,
        valueOf('allocQuantity'),
        valueOf('allocOrderNumber'),
        valueOf('allocCustomerRef')
      );
      if (result.success) {
        this.showToast('success', 'Stock Allocated', result.message);
        allocForm.reset();
        this.updateAllocItemHint();
        this.renderAll();
      } else {
        this.showToast('error', 'Allocation Rejected', result.message);
      }
    });
    el('allocItemSelect')?.addEventListener('change', () => this.updateAllocItemHint());

    // ---- Report buttons ----
    // "Download PDF" opens the print dialog, where the user can choose "Save as PDF".
    el('downloadPdfReportBtn')?.addEventListener('click', () => window.print());
    el('printReportBtn')?.addEventListener('click', () => window.print());
    el('refreshReportBtn')?.addEventListener('click', () => {
      this.renderReportView();
      this.showToast('info', 'Report Updated', 'Calculated latest inventory valuation in AED.');
    });
  }

  /**
   * One click listener per table (event delegation) instead of an onclick
   * written into every button. Each button carries data-action and the code
   * it acts on, read safely from the dataset. The old inline onclick broke
   * when a category name contained an apostrophe (test T14).
   */
  private setupTableActions(): void {
    // Stock Master buttons: Allocate / Adjust Stock / Restock
    el('inventoryTableBody')?.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
      const code = btn?.dataset.code;
      if (!btn || !code) return;
      if (btn.dataset.action === 'allocate') this.openQuickAllocateModal(code);
      if (btn.dataset.action === 'adjust') this.openAdjustStockModal(code);
      if (btn.dataset.action === 'restock') this.openRestockModal(code);
    });

    // Order log buttons: Dispatch / Cancel
    el('allocationsTableBody')?.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
      const id = btn?.dataset.id;
      if (!btn || !id) return;
      if (btn.dataset.action === 'dispatch') this.dispatchAllocation(id);
      if (btn.dataset.action === 'cancel') this.cancelAllocation(id);
    });

    // Category table: Delete
    el('categoriesTableBody')?.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action="delete-category"]');
      const name = btn?.dataset.category;
      if (name) this.handleDeleteCategory(name);
    });
  }

  /** Shows how many units of the chosen item are free, under the item box. */
  private updateAllocItemHint(): void {
    const hint = el('allocItemAvailableHint');
    if (!hint) return;
    const item = this.manager.getItem(valueOf('allocItemSelect'));
    if (!item) {
      hint.textContent = 'Select an item to see current available stock balance.';
      return;
    }
    hint.innerHTML = `Available stock for this item: <strong>${item.getAvailableStock()}</strong> unit(s) (Total On Hand: ${item.stockLevel}, Allocated: ${item.allocatedCount}, Unit Price: ${escapeHtml(this.formatCurrency(item.unitPrice))}).`;
  }

  /** Redraws the stock table whenever the search box or a filter changes. */
  private setupFilters(): void {
    const redraw = () => this.renderInventoryTable();
    el('inventorySearchInput')?.addEventListener('input', redraw);
    el('categoryFilterSelect')?.addEventListener('change', redraw);
    el('stockStatusFilterSelect')?.addEventListener('change', redraw);
  }

  /** Handles the three pop-up forms (restock, adjust stock, quick allocate). */
  private setupModals(): void {
    // Any button with data-close-modal closes the pop-up it names.
    document.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.closeModal;
        if (modalId) this.closeModal(modalId);
      });
    });

    // ---- Restock pop-up ----
    el<HTMLFormElement>('restockModalForm')?.addEventListener('submit', (e: Event) => {
      e.preventDefault();
      const res = this.manager.restockItem(valueOf('modalRestockItemCode'), valueOf('modalRestockQty'));
      if (res.success) {
        this.showToast('success', 'Inventory Restocked', res.message);
        this.closeModal('restockModal');
        this.renderAll();
      } else {
        this.showToast('error', 'Restock Failed', res.message);
      }
    });

    // ---- Adjust stock pop-up ----
    el<HTMLFormElement>('adjustStockModalForm')?.addEventListener('submit', (e: Event) => {
      e.preventDefault();
      const res = this.manager.editStock(valueOf('modalAdjustItemCode'), valueOf('modalAdjustNewTotal'));
      if (res.success) {
        this.showToast('success', 'Stock Balance Updated', res.message);
        this.closeModal('adjustStockModal');
        this.renderAll();
      } else {
        this.showToast('error', 'Stock Adjustment Rejected', res.message);
      }
    });

    // Live preview: as the user types a new total, show what will be left to sell.
    const inputNewTotal = el<HTMLInputElement>('modalAdjustNewTotal');
    inputNewTotal?.addEventListener('input', () => {
      const item = this.manager.getItem(valueOf('modalAdjustItemCode'));
      if (!item) return;
      const projected = Math.max(0, (Number(inputNewTotal.value) || 0) - item.allocatedCount);
      const projectedEl = el('modalAdjustProjectedAvailable');
      if (projectedEl) projectedEl.textContent = String(projected);
    });

    // ---- Quick allocate pop-up ----
    const quickAllocForm = el<HTMLFormElement>('quickAllocateModalForm');
    quickAllocForm?.addEventListener('submit', (e: Event) => {
      e.preventDefault();
      const res = this.manager.allocateStock(
        valueOf('modalAllocItemCode'),
        valueOf('modalAllocQty'),
        valueOf('modalAllocOrder'),
        valueOf('modalAllocCustomer')
      );
      if (res.success) {
        this.showToast('success', 'Order Allocated', res.message);
        this.closeModal('quickAllocateModal');
        quickAllocForm.reset();
        this.renderAll();
      } else {
        this.showToast('error', 'Allocation Rejected', res.message);
      }
    });
  }

  // ===================================================================
  // Pop-ups and messages
  // ===================================================================

  /** Shows a pop-up by adding the "open" CSS class. */
  private openModal(modalId: string): void {
    el(modalId)?.classList.add('open');
  }

  /** Hides a pop-up. */
  private closeModal(modalId: string): void {
    el(modalId)?.classList.remove('open');
  }

  /** Fills and opens the Restock pop-up for one item. */
  private openRestockModal(itemCode: string): void {
    const item = this.manager.getItem(itemCode);
    if (!item) return;
    el<HTMLInputElement>('modalRestockItemCode')!.value = item.itemCode;
    el('modalRestockItemName')!.textContent = item.name;   // textContent never runs HTML
    el('modalRestockItemSku')!.textContent = item.itemCode;
    el<HTMLInputElement>('modalRestockQty')!.value = '5';
    this.openModal('restockModal');
  }

  /** Fills and opens the Adjust Stock pop-up for one item. */
  private openAdjustStockModal(itemCode: string): void {
    const item = this.manager.getItem(itemCode);
    if (!item) return;
    el<HTMLInputElement>('modalAdjustItemCode')!.value = item.itemCode;
    el('modalAdjustItemName')!.textContent = item.name;
    el('modalAdjustItemSku')!.textContent = item.itemCode;
    el('modalAdjustCurrentOnHand')!.textContent = String(item.stockLevel);
    el('modalAdjustCurrentAllocated')!.textContent = String(item.allocatedCount);

    const inputNewTotal = el<HTMLInputElement>('modalAdjustNewTotal')!;
    inputNewTotal.value = String(item.stockLevel);
    inputNewTotal.min = String(item.allocatedCount); // the browser also blocks lower values

    const minWarning = el('modalAdjustMinWarning');
    if (minWarning) minWarning.textContent = `Minimum allowed is ${item.allocatedCount} unit(s) to honor active customer orders.`;
    const projected = el('modalAdjustProjectedAvailable');
    if (projected) projected.textContent = String(item.getAvailableStock());

    this.openModal('adjustStockModal');
  }

  /** Fills and opens the Quick Allocate pop-up for one item. */
  private openQuickAllocateModal(itemCode: string): void {
    const item = this.manager.getItem(itemCode);
    if (!item) return;
    el<HTMLInputElement>('modalAllocItemCode')!.value = item.itemCode;
    el('modalAllocItemName')!.textContent = item.name;
    el('modalAllocAvailableCount')!.textContent = String(item.getAvailableStock());
    const qtyInput = el<HTMLInputElement>('modalAllocQty')!;
    qtyInput.value = '1';
    qtyInput.max = String(item.getAvailableStock());
    this.openModal('quickAllocateModal');
  }

  /**
   * Shows a message in the corner for 4 seconds.
   * Built with textContent, so names inside messages are shown as plain text.
   */
  private showToast(type: ToastType, title: string, message: string): void {
    const container = el('toastContainer');
    if (!container) return;

    const iconMap: Record<ToastType, string> = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' };

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    const iconBox = document.createElement('div');
    iconBox.className = 'toast-icon';
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.textContent = iconMap[type];
    iconBox.appendChild(icon);

    const content = document.createElement('div');
    content.className = 'toast-content';
    const titleEl = document.createElement('div');
    titleEl.className = 'toast-title';
    titleEl.textContent = title;
    const msgEl = document.createElement('div');
    msgEl.className = 'toast-msg';
    msgEl.textContent = message;
    content.append(titleEl, msgEl);

    toast.append(iconBox, content);
    container.appendChild(toast);

    // Fade out after 4 seconds, then remove from the page.
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease-out';
      setTimeout(() => toast.remove(), 200);
    }, 4000);
  }

  /** Formats a number as money, e.g. 1250 -> "AED 1,250.00". */
  private formatCurrency(val: number): string {
    return 'AED ' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ===================================================================
  // Drawing tables
  // ===================================================================

  /** Refills every category drop-down, keeping the user's current choice. */
  private populateCategoryDropdowns(): void {
    const categories = this.manager.getCategories();
    const options = categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');

    const filterSelect = el<HTMLSelectElement>('categoryFilterSelect');
    if (filterSelect) {
      const current = filterSelect.value;
      filterSelect.innerHTML = '<option value="ALL">All Categories</option>' + options;
      if (current === 'ALL' || categories.some(c => c.name === current)) filterSelect.value = current;
    }

    const itemCatSelect = el<HTMLSelectElement>('newItemCategory');
    if (itemCatSelect) {
      const current = itemCatSelect.value;
      itemCatSelect.innerHTML = '<option value="">Select Category...</option>' + options;
      if (categories.some(c => c.name === current)) itemCatSelect.value = current;
    }
  }

  /** Draws the category list with item counts and values. */
  private renderCategoriesTable(): void {
    const tbody = el('categoriesTableBody');
    if (!tbody) return;
    const items = this.manager.getAllItems();

    tbody.innerHTML = this.manager
      .getCategories()
      .map(cat => {
        const catItems = items.filter(i => i.category === cat.name);
        const totalUnits = catItems.reduce((sum, item) => sum + item.stockLevel, 0);
        const totalVal = catItems.reduce((sum, item) => sum + item.getTotalValuation(), 0);
        return `
          <tr>
            <td style="font-weight: 700; color: #0f172a;">${escapeHtml(cat.name)}</td>
            <td><span class="sku-code">${escapeHtml(cat.prefix)}</span></td>
            <td style="text-align: center; font-weight: 600;">${catItems.length}</td>
            <td style="text-align: center;">${totalUnits}</td>
            <td style="text-align: right; font-weight: 600;">${this.formatCurrency(totalVal)}</td>
            <td style="text-align: center;">
              <button class="btn btn-danger btn-sm" data-action="delete-category" data-category="${escapeHtml(cat.name)}">Delete</button>
            </td>
          </tr>`;
      })
      .join('');
  }

  /** Deletes a category, or explains why it cannot be deleted. */
  private handleDeleteCategory(categoryName: string): void {
    try {
      this.manager.deleteCategory(categoryName);
      this.showToast('info', 'Category Removed', `Category "${categoryName}" deleted. Dropdowns updated.`);
      this.renderAll();
    } catch (err: unknown) {
      this.showToast('error', 'Cannot Delete Category', err instanceof Error ? err.message : 'Cannot delete category');
    }
  }

  /** Updates the five summary cards at the top of the page. */
  private renderMetricsBar(): void {
    const report = this.manager.generateStockReport();
    const set = (id: string, text: string) => { const e = el(id); if (e) e.textContent = text; };
    set('kpiTotalValuation', this.formatCurrency(report.totalValuation));
    set('kpiTotalSkus', String(report.totalSkus));
    set('kpiTotalOnHand', String(report.totalUnitsOnHand));
    set('kpiTotalAllocated', String(report.totalAllocatedUnits));
    set('kpiTotalAvailable', String(report.totalAvailableUnits));
  }

  /** Draws the main stock table using the current search text and filters. */
  private renderInventoryTable(): void {
    const tbody = el('inventoryTableBody');
    if (!tbody) return;

    const filtered = this.manager.filterItems(
      valueOf('inventorySearchInput'),
      valueOf('categoryFilterSelect') || 'ALL',
      valueOf('stockStatusFilterSelect') || 'ALL'
    );

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="10">
          <div class="empty-state">
            <div class="empty-title">No Matching Furniture Items</div>
            <div class="empty-desc">Try clearing the search query or adjusting the category filters.</div>
          </div>
        </td></tr>`;
      return;
    }

    // One table row per item. Every value typed by a user goes through escapeHtml().
    tbody.innerHTML = filtered
      .map(item => {
        const status = item.getStatus();            // polymorphic: depends on the item's subclass
        const available = item.getAvailableStock();
        const code = escapeHtml(item.itemCode);
        return `
          <tr>
            <td><span class="sku-code">${code}</span></td>
            <td style="font-weight: 600;">${escapeHtml(item.name)}<div class="item-type-label">${escapeHtml(item.getTypeLabel())} item</div></td>
            <td style="color: #64748b;">${escapeHtml(item.category)}</td>
            <td style="text-align: right; font-weight: 600;">${this.formatCurrency(item.unitPrice)}</td>
            <td style="text-align: center; font-weight: 600;">${item.stockLevel}</td>
            <td style="text-align: center; color: #475569;">${item.allocatedCount}</td>
            <td style="text-align: center; font-weight: 700; color: ${available > 0 ? '#166534' : '#991b1b'};">${available}</td>
            <td style="text-align: right; font-weight: 600;">${this.formatCurrency(item.getTotalValuation())}</td>
            <td><span class="badge ${status.cssClass}">${status.label}</span></td>
            <td style="text-align: center; white-space: nowrap;">
              <button class="btn btn-secondary btn-sm" data-action="allocate" data-code="${code}">Allocate</button>
              <button class="btn btn-secondary btn-sm" data-action="adjust" data-code="${code}" style="margin-left: 4px;">Adjust Stock</button>
              <button class="btn btn-secondary btn-sm" data-action="restock" data-code="${code}" style="margin-left: 4px;">Restock</button>
            </td>
          </tr>`;
      })
      .join('');
  }

  /** Refills the item drop-down on the Order Allocation form. */
  private populateAllocationDropdown(): void {
    const select = el<HTMLSelectElement>('allocItemSelect');
    if (!select) return;
    const current = select.value;
    select.innerHTML =
      '<option value="">Select an item to allocate...</option>' +
      this.manager
        .getAllItems()
        .map(item => `<option value="${escapeHtml(item.itemCode)}">[${escapeHtml(item.itemCode)}] ${escapeHtml(item.name)} (${this.formatCurrency(item.unitPrice)} | Available: ${item.getAvailableStock()})</option>`)
        .join('');
    if (this.manager.hasItem(current)) select.value = current;
  }

  /** Draws the order log with Dispatch and Cancel buttons for active orders. */
  private renderAllocationsTable(): void {
    const tbody = el('allocationsTableBody');
    if (!tbody) return;
    const allocs = this.manager.getAllocations();

    if (allocs.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="8">
          <div class="empty-state">
            <div class="empty-title">No Order Allocations Logged</div>
            <div class="empty-desc">Allocate stock using the form above to reserve items for customer orders.</div>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = allocs
      .map(alloc => {
        const item = this.manager.getItem(alloc.itemCode);
        const itemName = item ? item.name : 'Unknown Item';
        const allocDate = new Date(alloc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const id = escapeHtml(alloc.id);

        // The badge and buttons depend on the order's status.
        let statusBadge: string;
        let actionButtons: string;
        if (alloc.status === 'ACTIVE') {
          statusBadge = '<span class="badge badge-allocated">Active Reservation</span>';
          actionButtons = `
            <button class="btn btn-secondary btn-sm" data-action="dispatch" data-id="${id}">Dispatch</button>
            <button class="btn btn-danger btn-sm" data-action="cancel" data-id="${id}" style="margin-left: 4px;">Cancel</button>`;
        } else if (alloc.status === 'DISPATCHED') {
          statusBadge = '<span class="badge badge-in-stock">Dispatched</span>';
          actionButtons = '<span style="font-size: 12px; color: #64748b;">Completed</span>';
        } else {
          statusBadge = '<span class="badge badge-out-of-stock">Cancelled</span>';
          actionButtons = '<span style="font-size: 12px; color: #64748b;">Returned to Stock</span>';
        }

        return `
          <tr>
            <td><span class="sku-code">${id}</span></td>
            <td style="font-weight: 600;">${escapeHtml(alloc.orderNumber)}</td>
            <td>${escapeHtml(alloc.customerRef)}</td>
            <td>
              <div style="font-weight: 600;">${escapeHtml(itemName)}</div>
              <div class="sku-code" style="display: inline-block; font-size: 11px;">${escapeHtml(alloc.itemCode)}</div>
            </td>
            <td style="text-align: center; font-weight: 700;">${alloc.quantity}</td>
            <td style="color: #64748b;">${allocDate}</td>
            <td>${statusBadge}</td>
            <td style="text-align: center; white-space: nowrap;">${actionButtons}</td>
          </tr>`;
      })
      .join('');
  }

  /** Dispatch button: ships the order and refreshes the screen. */
  private dispatchAllocation(allocId: string): void {
    const res = this.manager.dispatchAllocation(allocId);
    this.showToast(res.success ? 'success' : 'error', res.success ? 'Order Dispatched' : 'Action Failed', res.message);
    if (res.success) this.renderAll();
  }

  /** Cancel button: releases the reserved units and refreshes the screen. */
  private cancelAllocation(allocId: string): void {
    const res = this.manager.cancelAllocation(allocId);
    this.showToast(res.success ? 'info' : 'error', res.success ? 'Allocation Cancelled' : 'Action Failed', res.message);
    if (res.success) this.renderAll();
  }

  /** Draws the valuation report and the reorder suggestions. */
  private renderReportView(): void {
    const report = this.manager.generateStockReport();
    const set = (id: string, text: string) => { const e = el(id); if (e) e.textContent = text; };

    set('reportGeneratedTimestamp', report.generatedDate);
    set('rptTotalSkus', String(report.totalSkus));
    set('rptTotalOnHand', String(report.totalUnitsOnHand));
    set('rptTotalAllocated', String(report.totalAllocatedUnits));
    set('rptTotalAvailable', String(report.totalAvailableUnits));
    set('rptTotalValuation', this.formatCurrency(report.totalValuation));

    // Category breakdown table
    const catTbody = el('reportCategoryTableBody');
    if (catTbody) {
      catTbody.innerHTML = report.categoryBreakdown
        .map(cat => `
          <tr>
            <td style="font-weight: 600;">${escapeHtml(cat.category)}</td>
            <td style="text-align: center;">${cat.skuCount}</td>
            <td style="text-align: center;">${cat.onHand}</td>
            <td style="text-align: center; color: #475569;">${cat.allocated}</td>
            <td style="text-align: center; font-weight: 700; color: #166534;">${cat.available}</td>
            <td style="text-align: right; font-weight: 600;">${this.formatCurrency(cat.valuation)}</td>
          </tr>`)
        .join('');
    }

    // Reorder suggestions table (items at or below their own low-stock level)
    const reorderTbody = el('reorderTableBody');
    if (reorderTbody) {
      const suggestions = this.manager.getReorderSuggestions();
      reorderTbody.innerHTML = suggestions.length
        ? suggestions
            .map(s => `
              <tr>
                <td><span class="sku-code">${escapeHtml(s.itemCode)}</span></td>
                <td style="font-weight: 600;">${escapeHtml(s.name)}</td>
                <td>${escapeHtml(s.typeLabel)}</td>
                <td style="text-align: center;">${s.available}</td>
                <td style="text-align: center;">${s.threshold}</td>
                <td style="text-align: center; font-weight: 700;">${s.suggestedQty}</td>
              </tr>`)
            .join('')
        : '<tr><td colspan="6" style="text-align: center; color: #64748b;">No items need reordering.</td></tr>';
    }
  }

  /** Redraws everything after any change. */
  private renderAll(): void {
    this.populateCategoryDropdowns();
    this.renderMetricsBar();
    this.renderInventoryTable();
    this.populateAllocationDropdown();
    this.renderAllocationsTable();
    this.renderCategoriesTable();
    if (this.currentTab === 'tab-report') {
      this.renderReportView();
    }
  }
}

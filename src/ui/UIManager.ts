import { InventoryManager } from '../services/InventoryManager';
import { ToastType } from '../types/inventory';

/**
 * UIManager orchestrates DOM rendering, event listeners, modal dialogues, and user notifications.
 */
export class UIManager {
  manager: InventoryManager;
  currentTab: string;

  constructor(inventoryManager: InventoryManager) {
    this.manager = inventoryManager;
    this.currentTab = 'tab-inventory';
    this.init();
  }

  init(): void {
    this.setupNavigation();
    this.setupForms();
    this.setupModals();
    this.setupFilters();
    this.startClock();
    this.renderAll();
  }

  /**
   * Updates live clock in header every second.
   */
  startClock(): void {
    const update = () => {
      const now = new Date();
      const el = document.getElementById('liveClockText');
      if (el) {
        el.textContent =
          now.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) +
          ' - ' +
          now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
      }
    };
    update();
    setInterval(update, 1000);
  }

  /**
   * Set up tab switching navigation.
   */
  setupNavigation(): void {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-tab');
        if (!targetId) return;

        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll<HTMLElement>('.tab-panel').forEach(panel => {
          panel.style.display = panel.id === targetId ? 'block' : 'none';
        });
        this.currentTab = targetId;

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

  /**
   * Set up submit handlers for primary input forms.
   */
  setupForms(): void {
    // Add New Stock Form
    const addForm = document.getElementById('addStockForm') as HTMLFormElement | null;
    if (addForm) {
      addForm.addEventListener('submit', (e: Event) => {
        e.preventDefault();
        const name = (document.getElementById('newItemName') as HTMLInputElement).value;
        const category = (document.getElementById('newItemCategory') as HTMLSelectElement).value;
        const qty = (document.getElementById('newItemQuantity') as HTMLInputElement).value;
        const price = (document.getElementById('newItemPrice') as HTMLInputElement).value;
        const customSku = (document.getElementById('newItemCustomSku') as HTMLInputElement).value;

        try {
          const newItem = this.manager.addStock(name, category, qty, price, customSku);
          this.showToast(
            'success',
            'Stock Added',
            `Registered "${newItem.name}" under SKU [${newItem.itemCode}] at ${this.formatCurrency(newItem.unitPrice)}.`
          );
          addForm.reset();
          this.renderAll();

          const invTabBtn = document.querySelector<HTMLButtonElement>('[data-tab="tab-inventory"]');
          if (invTabBtn) invTabBtn.click();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Registration error';
          this.showToast('error', 'Registration Error', msg);
        }
      });
    }

    // Add New Category Form
    const addCatForm = document.getElementById('addCategoryForm') as HTMLFormElement | null;
    if (addCatForm) {
      addCatForm.addEventListener('submit', (e: Event) => {
        e.preventDefault();
        const name = (document.getElementById('newCategoryName') as HTMLInputElement).value;
        const prefix = (document.getElementById('newCategorySkuPrefix') as HTMLInputElement).value;

        try {
          const newCat = this.manager.addCategory(name, prefix);
          this.showToast(
            'success',
            'Category Created',
            `Added category "${newCat.name}" with prefix [${newCat.prefix}]. Selection dropdowns have been updated.`
          );
          addCatForm.reset();
          this.renderAll();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Category error';
          this.showToast('error', 'Category Error', msg);
        }
      });
    }

    // Allocate Stock Form
    const allocForm = document.getElementById('allocateStockForm') as HTMLFormElement | null;
    if (allocForm) {
      allocForm.addEventListener('submit', (e: Event) => {
        e.preventDefault();
        const itemCode = (document.getElementById('allocItemSelect') as HTMLSelectElement).value;
        const qty = (document.getElementById('allocQuantity') as HTMLInputElement).value;
        const customerRef = (document.getElementById('allocCustomerRef') as HTMLInputElement).value;
        const orderNum = (document.getElementById('allocOrderNumber') as HTMLInputElement).value;

        if (!itemCode) {
          this.showToast('warning', 'Selection Required', 'Please select an item to allocate.');
          return;
        }

        const result = this.manager.allocateStock(itemCode, qty, orderNum, customerRef);
        if (result.success) {
          this.showToast('success', 'Stock Allocated', result.message);
          allocForm.reset();
          this.updateAllocItemHint();
          this.renderAll();
        } else {
          this.showToast('error', 'Allocation Rejected', result.message);
        }
      });

      const itemSelect = document.getElementById('allocItemSelect');
      if (itemSelect) {
        itemSelect.addEventListener('change', () => this.updateAllocItemHint());
      }
    }

    // Download PDF Report Action
    const downloadPdfBtn = document.getElementById('downloadPdfReportBtn');
    if (downloadPdfBtn) {
      downloadPdfBtn.addEventListener('click', () => {
        window.print();
      });
    }

    // Print View Action
    const printBtn = document.getElementById('printReportBtn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }

    // Refresh Report Action
    const refreshReportBtn = document.getElementById('refreshReportBtn');
    if (refreshReportBtn) {
      refreshReportBtn.addEventListener('click', () => {
        this.renderReportView();
        this.showToast('info', 'Report Updated', 'Calculated latest inventory valuation in AED.');
      });
    }
  }

  /**
   * Updates balance guidance text based on currently selected item.
   */
  updateAllocItemHint(): void {
    const itemCode = (document.getElementById('allocItemSelect') as HTMLSelectElement)?.value;
    const hintEl = document.getElementById('allocItemAvailableHint');
    if (!hintEl) return;

    if (!itemCode) {
      hintEl.textContent = 'Select an item to see current available stock balance.';
      return;
    }
    const item = this.manager.items.get(itemCode);
    if (item) {
      const avail = item.getAvailableStock();
      hintEl.innerHTML = `Available stock for this item: <strong>${avail}</strong> unit(s) (Total On Hand: ${item.stockLevel}, Allocated: ${item.allocatedCount}, Unit Price: ${this.formatCurrency(item.unitPrice)}).`;
    }
  }

  /**
   * Set up search query and category/status filter inputs.
   */
  setupFilters(): void {
    const searchInput = document.getElementById('inventorySearchInput');
    const catSelect = document.getElementById('categoryFilterSelect');
    const statusSelect = document.getElementById('stockStatusFilterSelect');

    const triggerFilter = () => {
      this.renderInventoryTable();
    };

    if (searchInput) searchInput.addEventListener('input', triggerFilter);
    if (catSelect) catSelect.addEventListener('change', triggerFilter);
    if (statusSelect) statusSelect.addEventListener('change', triggerFilter);
  }

  /**
   * Set up modal dialogues and form handlers.
   */
  setupModals(): void {
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close-modal');
        if (modalId) this.closeModal(modalId);
      });
    });

    // Quick Restock Submission
    const restockForm = document.getElementById('restockModalForm') as HTMLFormElement | null;
    if (restockForm) {
      restockForm.addEventListener('submit', (e: Event) => {
        e.preventDefault();
        const code = (document.getElementById('modalRestockItemCode') as HTMLInputElement).value;
        const qty = (document.getElementById('modalRestockQty') as HTMLInputElement).value;
        const res = this.manager.restockItem(code, qty);
        if (res.success) {
          this.showToast('success', 'Inventory Restocked', res.message);
          this.closeModal('restockModal');
          this.renderAll();
        } else {
          this.showToast('error', 'Restock Failed', res.message);
        }
      });
    }

    // Adjust Stock Level Submission
    const adjustForm = document.getElementById('adjustStockModalForm') as HTMLFormElement | null;
    if (adjustForm) {
      adjustForm.addEventListener('submit', (e: Event) => {
        e.preventDefault();
        const code = (document.getElementById('modalAdjustItemCode') as HTMLInputElement).value;
        const newTotal = (document.getElementById('modalAdjustNewTotal') as HTMLInputElement).value;

        const res = this.manager.editStock(code, newTotal);
        if (res.success) {
          this.showToast('success', 'Stock Balance Updated', res.message);
          this.closeModal('adjustStockModal');
          this.renderAll();
        } else {
          this.showToast('error', 'Stock Adjustment Rejected', res.message);
        }
      });

      const inputNewTotal = document.getElementById('modalAdjustNewTotal') as HTMLInputElement | null;
      if (inputNewTotal) {
        inputNewTotal.addEventListener('input', () => {
          const code = (document.getElementById('modalAdjustItemCode') as HTMLInputElement).value;
          const item = this.manager.items.get(code);
          if (!item) return;
          const targetVal = Number(inputNewTotal.value) || 0;
          const projected = Math.max(0, targetVal - item.allocatedCount);
          const projectedEl = document.getElementById('modalAdjustProjectedAvailable');
          if (projectedEl) projectedEl.textContent = String(projected);
        });
      }
    }

    // Quick Allocate Submission
    const quickAllocForm = document.getElementById('quickAllocateModalForm') as HTMLFormElement | null;
    if (quickAllocForm) {
      quickAllocForm.addEventListener('submit', (e: Event) => {
        e.preventDefault();
        const code = (document.getElementById('modalAllocItemCode') as HTMLInputElement).value;
        const qty = (document.getElementById('modalAllocQty') as HTMLInputElement).value;
        const customer = (document.getElementById('modalAllocCustomer') as HTMLInputElement).value;
        const order = (document.getElementById('modalAllocOrder') as HTMLInputElement).value;

        const res = this.manager.allocateStock(code, qty, order, customer);
        if (resultIsSuccess(res)) {
          this.showToast('success', 'Order Allocated', res.message);
          this.closeModal('quickAllocateModal');
          quickAllocForm.reset();
          this.renderAll();
        } else {
          this.showToast('error', 'Allocation Rejected', res.message);
        }
      });
    }
  }

  openModal(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('open');
  }

  closeModal(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  }

  openRestockModal(itemCode: string): void {
    const item = this.manager.items.get(itemCode);
    if (!item) return;
    (document.getElementById('modalRestockItemCode') as HTMLInputElement).value = item.itemCode;
    (document.getElementById('modalRestockItemName') as HTMLElement).textContent = item.name;
    (document.getElementById('modalRestockItemSku') as HTMLElement).textContent = item.itemCode;
    (document.getElementById('modalRestockQty') as HTMLInputElement).value = '5';
    this.openModal('restockModal');
  }

  openAdjustStockModal(itemCode: string): void {
    const item = this.manager.items.get(itemCode);
    if (!item) return;
    (document.getElementById('modalAdjustItemCode') as HTMLInputElement).value = item.itemCode;
    (document.getElementById('modalAdjustItemName') as HTMLElement).textContent = item.name;
    (document.getElementById('modalAdjustItemSku') as HTMLElement).textContent = item.itemCode;
    (document.getElementById('modalAdjustCurrentOnHand') as HTMLElement).textContent = String(item.stockLevel);
    (document.getElementById('modalAdjustCurrentAllocated') as HTMLElement).textContent = String(item.allocatedCount);

    const inputNewTotal = document.getElementById('modalAdjustNewTotal') as HTMLInputElement;
    inputNewTotal.value = String(item.stockLevel);
    inputNewTotal.min = String(item.allocatedCount);

    const minWarningEl = document.getElementById('modalAdjustMinWarning');
    if (minWarningEl) {
      minWarningEl.textContent = `Minimum allowed is ${item.allocatedCount} unit(s) to honor active customer orders.`;
    }

    const projEl = document.getElementById('modalAdjustProjectedAvailable');
    if (projEl) {
      projEl.textContent = String(item.getAvailableStock());
    }

    this.openModal('adjustStockModal');
  }

  openQuickAllocateModal(itemCode: string): void {
    const item = this.manager.items.get(itemCode);
    if (!item) return;
    (document.getElementById('modalAllocItemCode') as HTMLInputElement).value = item.itemCode;
    (document.getElementById('modalAllocItemName') as HTMLElement).textContent = item.name;
    (document.getElementById('modalAllocAvailableCount') as HTMLElement).textContent = String(item.getAvailableStock());
    const qtyInput = document.getElementById('modalAllocQty') as HTMLInputElement;
    qtyInput.value = '1';
    qtyInput.max = String(item.getAvailableStock());
    this.openModal('quickAllocateModal');
  }

  /**
   * Display toast notification.
   */
  showToast(type: ToastType, title: string, message: string): void {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const iconMap: Record<ToastType, string> = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info'
    };

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">
        <span class="material-symbols-outlined">${iconMap[type] || 'info'}</span>
      </div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-msg">${message}</div>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease-out';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 200);
    }, 4000);
  }

  /**
   * Format numbers in AED currency.
   */
  formatCurrency(val: number): string {
    return (
      'AED ' +
      Number(val).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    );
  }

  /**
   * Update category dropdowns dynamically.
   */
  populateCategoryDropdowns(): void {
    const categories = this.manager.getCategories();

    const filterSelect = document.getElementById('categoryFilterSelect') as HTMLSelectElement | null;
    if (filterSelect) {
      const currentFilter = filterSelect.value;
      filterSelect.innerHTML =
        '<option value="ALL">All Categories</option>' +
        categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
      if (currentFilter && (currentFilter === 'ALL' || categories.some(c => c.name === currentFilter))) {
        filterSelect.value = currentFilter;
      }
    }

    const itemCatSelect = document.getElementById('newItemCategory') as HTMLSelectElement | null;
    if (itemCatSelect) {
      const currentVal = itemCatSelect.value;
      itemCatSelect.innerHTML =
        '<option value="">Select Category...</option>' +
        categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
      if (currentVal && categories.some(c => c.name === currentVal)) {
        itemCatSelect.value = currentVal;
      }
    }
  }

  renderCategoriesTable(): void {
    const tbody = document.getElementById('categoriesTableBody');
    if (!tbody) return;

    const categories = this.manager.getCategories();
    const items = Array.from(this.manager.items.values());

    tbody.innerHTML = categories
      .map(cat => {
        const catItems = items.filter(i => i.category === cat.name);
        const totalUnits = catItems.reduce((acc, curr) => acc + curr.stockLevel, 0);
        const totalVal = catItems.reduce((acc, curr) => acc + curr.getTotalValuation(), 0);

        return `
          <tr>
            <td style="font-weight: 700; color: #0f172a;">${cat.name}</td>
            <td><span class="sku-code">${cat.prefix}</span></td>
            <td style="text-align: center; font-weight: 600;">${catItems.length}</td>
            <td style="text-align: center;">${totalUnits}</td>
            <td style="text-align: right; font-weight: 600;">${this.formatCurrency(totalVal)}</td>
            <td style="text-align: center;">
              <button class="btn btn-danger btn-sm" onclick="ui.handleDeleteCategory('${cat.name}')">Delete</button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  handleDeleteCategory(categoryName: string): void {
    try {
      this.manager.deleteCategory(categoryName);
      this.showToast('info', 'Category Removed', `Category "${categoryName}" deleted. Dropdowns updated.`);
      this.renderAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cannot delete category';
      this.showToast('error', 'Cannot Delete Category', msg);
    }
  }

  renderMetricsBar(): void {
    const report = this.manager.generateStockReport();
    const kpiVal = document.getElementById('kpiTotalValuation');
    const kpiSkus = document.getElementById('kpiTotalSkus');
    const kpiOnHand = document.getElementById('kpiTotalOnHand');
    const kpiAlloc = document.getElementById('kpiTotalAllocated');
    const kpiAvail = document.getElementById('kpiTotalAvailable');

    if (kpiVal) kpiVal.textContent = this.formatCurrency(report.totalValuation);
    if (kpiSkus) kpiSkus.textContent = String(report.totalSkus);
    if (kpiOnHand) kpiOnHand.textContent = String(report.totalUnitsOnHand);
    if (kpiAlloc) kpiAlloc.textContent = String(report.totalAllocatedUnits);
    if (kpiAvail) kpiAvail.textContent = String(report.totalAvailableUnits);
  }

  renderInventoryTable(): void {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;

    const searchVal = (document.getElementById('inventorySearchInput') as HTMLInputElement)?.value || '';
    const catVal = (document.getElementById('categoryFilterSelect') as HTMLSelectElement)?.value || 'ALL';
    const statusVal = (document.getElementById('stockStatusFilterSelect') as HTMLSelectElement)?.value || 'ALL';

    const filtered = this.manager.filterItems(searchVal, catVal, statusVal);

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10">
            <div class="empty-state">
              <div class="empty-title">No Matching Furniture Items</div>
              <div class="empty-desc">Try clearing the search query or adjusting the category filters.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered
      .map(item => {
        const status = item.getStatus();
        const available = item.getAvailableStock();
        return `
          <tr>
            <td><span class="sku-code">${item.itemCode}</span></td>
            <td style="font-weight: 600;">${item.name}</td>
            <td style="color: #64748b;">${item.category}</td>
            <td style="text-align: right; font-weight: 600;">${this.formatCurrency(item.unitPrice)}</td>
            <td style="text-align: center; font-weight: 600;">${item.stockLevel}</td>
            <td style="text-align: center; color: #475569;">${item.allocatedCount}</td>
            <td style="text-align: center; font-weight: 700; color: ${available > 0 ? '#166534' : '#991b1b'};">${available}</td>
            <td style="text-align: right; font-weight: 600;">${this.formatCurrency(item.getTotalValuation())}</td>
            <td><span class="badge ${status.cssClass}">${status.label}</span></td>
            <td style="text-align: center; white-space: nowrap;">
              <button class="btn btn-secondary btn-sm" onclick="ui.openQuickAllocateModal('${item.itemCode}')">Allocate</button>
              <button class="btn btn-secondary btn-sm" onclick="ui.openAdjustStockModal('${item.itemCode}')" style="margin-left: 4px;">Adjust Stock</button>
              <button class="btn btn-secondary btn-sm" onclick="ui.openRestockModal('${item.itemCode}')" style="margin-left: 4px;">Restock</button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  populateAllocationDropdown(): void {
    const select = document.getElementById('allocItemSelect') as HTMLSelectElement | null;
    if (!select) return;

    const currentVal = select.value;
    const items = Array.from(this.manager.items.values());

    select.innerHTML =
      '<option value="">Select an item to allocate...</option>' +
      items
        .map(item => {
          const avail = item.getAvailableStock();
          return `<option value="${item.itemCode}">[${item.itemCode}] ${item.name} (${this.formatCurrency(item.unitPrice)} | Available: ${avail})</option>`;
        })
        .join('');

    if (currentVal && this.manager.items.has(currentVal)) {
      select.value = currentVal;
    }
  }

  renderAllocationsTable(): void {
    const tbody = document.getElementById('allocationsTableBody');
    if (!tbody) return;

    const allocs = this.manager.allocations;
    if (allocs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state">
              <div class="empty-title">No Order Allocations Logged</div>
              <div class="empty-desc">Allocate stock using the form above to reserve items for customer orders.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = allocs
      .map(alloc => {
        const item = this.manager.items.get(alloc.itemCode);
        const itemName = item ? item.name : 'Unknown Item';
        const allocDate = new Date(alloc.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        let statusBadge = '';
        let actionButtons = '';

        if (alloc.status === 'ACTIVE') {
          statusBadge = '<span class="badge badge-allocated">Active Reservation</span>';
          actionButtons = `
            <button class="btn btn-secondary btn-sm" onclick="ui.dispatchAllocation('${alloc.id}')">Dispatch</button>
            <button class="btn btn-danger btn-sm" onclick="ui.cancelAllocation('${alloc.id}')" style="margin-left: 4px;">Cancel</button>
          `;
        } else if (alloc.status === 'DISPATCHED') {
          statusBadge = '<span class="badge badge-in-stock">Dispatched</span>';
          actionButtons = '<span style="font-size: 12px; color: #64748b;">Completed</span>';
        } else {
          statusBadge = '<span class="badge badge-out-of-stock">Cancelled</span>';
          actionButtons = '<span style="font-size: 12px; color: #64748b;">Returned to Stock</span>';
        }

        return `
          <tr>
            <td><span class="sku-code">${alloc.id}</span></td>
            <td style="font-weight: 600;">${alloc.orderNumber}</td>
            <td>${alloc.customerRef}</td>
            <td>
              <div style="font-weight: 600;">${itemName}</div>
              <div class="sku-code" style="display: inline-block; font-size: 11px;">${alloc.itemCode}</div>
            </td>
            <td style="text-align: center; font-weight: 700;">${alloc.quantity}</td>
            <td style="color: #64748b;">${allocDate}</td>
            <td>${statusBadge}</td>
            <td style="text-align: center; white-space: nowrap;">${actionButtons}</td>
          </tr>
        `;
      })
      .join('');
  }

  dispatchAllocation(allocId: string): void {
    const res = this.manager.dispatchAllocation(allocId);
    if (res.success) {
      this.showToast('success', 'Order Dispatched', res.message);
      this.renderAll();
    } else {
      this.showToast('error', 'Action Failed', res.message);
    }
  }

  cancelAllocation(allocId: string): void {
    const res = this.manager.cancelAllocation(allocId);
    if (res.success) {
      this.showToast('info', 'Allocation Cancelled', res.message);
      this.renderAll();
    } else {
      this.showToast('error', 'Action Failed', res.message);
    }
  }

  renderReportView(): void {
    const report = this.manager.generateStockReport();

    const timestampEl = document.getElementById('reportGeneratedTimestamp');
    if (timestampEl) {
      timestampEl.textContent = report.generatedDate;
    }

    const rptSkus = document.getElementById('rptTotalSkus');
    const rptOnHand = document.getElementById('rptTotalOnHand');
    const rptAlloc = document.getElementById('rptTotalAllocated');
    const rptAvail = document.getElementById('rptTotalAvailable');
    const rptVal = document.getElementById('rptTotalValuation');

    if (rptSkus) rptSkus.textContent = String(report.totalSkus);
    if (rptOnHand) rptOnHand.textContent = String(report.totalUnitsOnHand);
    if (rptAlloc) rptAlloc.textContent = String(report.totalAllocatedUnits);
    if (rptAvail) rptAvail.textContent = String(report.totalAvailableUnits);
    if (rptVal) rptVal.textContent = this.formatCurrency(report.totalValuation);

    const catTbody = document.getElementById('reportCategoryTableBody');
    if (catTbody) {
      catTbody.innerHTML = report.categoryBreakdown
        .map(
          cat => `
          <tr>
            <td style="font-weight: 600;">${cat.category}</td>
            <td style="text-align: center;">${cat.skuCount}</td>
            <td style="text-align: center;">${cat.onHand}</td>
            <td style="text-align: center; color: #475569;">${cat.allocated}</td>
            <td style="text-align: center; font-weight: 700; color: #166534;">${cat.available}</td>
            <td style="text-align: right; font-weight: 600;">${this.formatCurrency(cat.valuation)}</td>
          </tr>
        `
        )
        .join('');
    }
  }

  renderAll(): void {
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

function resultIsSuccess(res: { success: boolean }): boolean {
  return res.success;
}

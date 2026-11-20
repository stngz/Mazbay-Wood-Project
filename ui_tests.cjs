// Browser tests T01-T20 from the Task 3 test plan.
// Each test fills in the real forms, clicks the real buttons and saves a screenshot.
// Setup (once):  npm install --no-save playwright && npx playwright install chromium
// Run:           npm run build && npm run preview   (in one terminal)
//                node tests/ui_tests.cjs http://localhost:4173 test-evidence   (in another)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [baseUrl = 'http://localhost:4173', outDir = 'test-evidence', label = 'run'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 }, deviceScaleFactor: 1.5 });
  // Hide icons so screenshots look the same with or without internet access to Google Fonts.
  await context.route(/fonts\.googleapis\.com/, r => r.fulfill({ contentType: 'text/css', body: '.material-symbols-outlined{display:none!important}' }));
  const page = await context.newPage();
  let pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()); });

  const results = [];
  const shot = async (id, suffix = '') => {
    const f = path.join(outDir, `${id}${suffix}.png`);
    await page.waitForTimeout(400); // let the pop-up message finish fading in
    await page.screenshot({ path: f });
    return f;
  };
  const tab = async name => { await page.click(`.nav-tab[data-tab="${name}"]`); await page.waitForTimeout(250); };
  const clearToasts = async () => page.evaluate(() => { const c = document.getElementById('toastContainer'); if (c) c.innerHTML = ''; });
  const lastToast = async () => {
    try {
      await page.waitForSelector('.toast-item', { timeout: 2500 });
      return (await page.locator('.toast-item').last().innerText()).replace(/\s+/g, ' ').trim();
    } catch { return '(no message shown)'; }
  };
  const row = code => page.locator('#inventoryTableBody tr', { has: page.locator('.sku-code', { hasText: new RegExp(`^${code}$`) }) });
  const rowByName = name => page.locator('#inventoryTableBody tr', { hasText: name }).first();
  const cells = async loc => (await loc.locator('td').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
  const resetFilters = async () => {
    await tab('tab-inventory');
    await page.fill('#inventorySearchInput', '');
    await page.selectOption('#categoryFilterSelect', 'ALL');
    await page.selectOption('#stockStatusFilterSelect', 'ALL');
    await page.waitForTimeout(150);
  };
  const hasTypeField = async () => (await page.locator('#newItemType').count()) > 0;
  const addItem = async ({ name, category, qty, price, sku = '', type }) => {
    await clearToasts();
    await tab('tab-add-item');
    await page.fill('#newItemName', name);
    await page.selectOption('#newItemCategory', category);
    if (type && await hasTypeField()) await page.selectOption('#newItemType', type);
    await page.fill('#newItemQuantity', String(qty));
    await page.fill('#newItemPrice', String(price));
    await page.fill('#newItemCustomSku', sku);
    await page.click('#addStockForm button[type=submit]');
    return lastToast();
  };
  const allocate = async ({ code, qty, customer, order }) => {
    await clearToasts();
    await tab('tab-allocation');
    await page.selectOption('#allocItemSelect', code);
    await page.fill('#allocQuantity', String(qty));
    await page.fill('#allocCustomerRef', customer);
    await page.fill('#allocOrderNumber', order);
    await page.click('#allocateStockForm button[type=submit]');
    return lastToast();
  };
  const record = (r) => { results.push(r); console.log(`${r.id} ${r.result}: ${r.actual}`); };

  // Start every run from the program's own starting data.
  await page.goto(baseUrl);
  await page.evaluate(() => localStorage.clear());
  await page.goto(baseUrl);
  await page.waitForSelector('#inventoryTableBody tr');

  // T01: starting data is consistent
  {
    await resetFilters();
    const c = await cells(row('MW-DIN-001'));
    const shown = Number(c[5]);
    const s1 = await shot('T01', 'a');
    await tab('tab-allocation');
    const inLog = await page.evaluate(() => {
      let sum = 0;
      document.querySelectorAll('#allocationsTableBody tr').forEach(tr => {
        if (tr.innerText.includes('MW-DIN-001') && /Active/i.test(tr.innerText)) sum += Number(tr.children[4].innerText);
      });
      return sum;
    });
    const s2 = await shot('T01', 'b');
    record({ id: 'T01', actual: `Stock Master shows ${shown} Dining Table unit(s) allocated; the order log holds ${inLog} unit(s) in active orders.`, result: shown === inLog ? 'PASS' : 'FAIL', shots: [s1, s2] });
  }

  // T02: add a valid item
  let newSku = '';
  {
    const toast = await addItem({ name: 'Oak Coffee Table', category: 'Living Room', qty: 15, price: 450, type: 'LARGE' });
    await resetFilters();
    const r = rowByName('Oak Coffee Table');
    const ok = (await r.count()) > 0;
    const c = ok ? await cells(r) : [];
    newSku = c[0] || '';
    await page.fill('#inventorySearchInput', 'Oak Coffee');
    await page.waitForTimeout(150);
    const s = await shot('T02');
    record({ id: 'T02', actual: `${toast} New row: SKU ${c[0]}, on hand ${c[4]}.`, result: ok && c[4] === '15' && /^MW-LIV-\d{3}$/.test(c[0]) ? 'PASS' : 'FAIL', shots: [s] });
  }

  // T03: duplicate SKU is rejected
  {
    const toast = await addItem({ name: 'Duplicate Test Table', category: 'Dining Room', qty: 1, price: 100, sku: 'MW-DIN-001', type: 'LARGE' });
    const s = await shot('T03');
    record({ id: 'T03', actual: toast, result: /already exists/i.test(toast) ? 'PASS' : 'FAIL', shots: [s] });
  }

  // T04: text that looks like HTML is shown as plain text
  {
    await addItem({ name: '<b>Bold Sofa</b>', category: 'Living Room', qty: 2, price: 999, type: 'LARGE' });
    await resetFilters();
    await page.fill('#inventorySearchInput', 'Bold Sofa');
    await page.waitForTimeout(150);
    const nameCell = page.locator('#inventoryTableBody tr').first().locator('td').nth(1);
    const html = (await nameCell.count()) ? await nameCell.innerHTML() : '';
    const text = (await nameCell.count()) ? await nameCell.innerText() : '';
    const interpreted = /<b>/i.test(html);
    const s = await shot('T04');
    record({ id: 'T04', actual: interpreted ? `The name was displayed as "${text}" in bold: the <b> tags were run as code.` : `The name was displayed exactly as typed: "${text}".`, result: interpreted ? 'FAIL' : 'PASS', shots: [s] });
  }

  // T05: valid allocation
  {
    const toast = await allocate({ code: newSku, qty: 5, customer: 'Aisha Khan', order: 'SO-9001' });
    const s = await shot('T05');
    await resetFilters();
    const c = await cells(row(newSku));
    record({ id: 'T05', actual: `${toast} Allocated ${c[5]}, available ${c[6]}.`, result: c[5] === '5' && c[6] === '10' ? 'PASS' : 'FAIL', shots: [s] });
  }

  // T06: allocate exactly the remaining stock
  {
    const toast = await allocate({ code: newSku, qty: 10, customer: 'Omar Saeed', order: 'SO-9002' });
    await resetFilters();
    await page.fill('#inventorySearchInput', 'Oak Coffee');
    await page.waitForTimeout(150);
    const c = await cells(row(newSku));
    const s = await shot('T06');
    record({ id: 'T06', actual: `${toast} Available ${c[6]}, status "${c[8]}".`, result: c[6] === '0' && /out of stock/i.test(c[8]) ? 'PASS' : 'FAIL', shots: [s] });
  }

  // T07: allocating more than available is refused
  {
    const toast = await allocate({ code: newSku, qty: 1, customer: 'Late Customer', order: 'SO-9003' });
    const s = await shot('T07');
    record({ id: 'T07', actual: toast, result: /overselling prevented/i.test(toast) ? 'PASS' : 'FAIL', shots: [s] });
  }

  // T08: customer name made of spaces is refused
  {
    const toast = await allocate({ code: 'MW-LIV-003', qty: 1, customer: '   ', order: 'SO-9004' });
    const s = await shot('T08');
    record({ id: 'T08', actual: toast, result: /success/i.test(toast) ? 'FAIL' : 'PASS', shots: [s] });
  }

  // T09: dispatch an order
  {
    await clearToasts();
    await tab('tab-allocation');
    await page.locator('#allocationsTableBody tr', { hasText: 'SO-9001' }).locator('button', { hasText: 'Dispatch' }).click();
    const toast = await lastToast();
    const s = await shot('T09');
    await resetFilters();
    const c = await cells(row(newSku));
    record({ id: 'T09', actual: `${toast} On hand ${c[4]}, allocated ${c[5]}.`, result: c[4] === '10' && c[5] === '10' ? 'PASS' : 'FAIL', shots: [s] });
  }

  // T10: cancel an order
  {
    await clearToasts();
    await tab('tab-allocation');
    await page.locator('#allocationsTableBody tr', { hasText: 'SO-9002' }).locator('button', { hasText: 'Cancel' }).click();
    const toast = await lastToast();
    const s = await shot('T10');
    await resetFilters();
    const c = await cells(row(newSku));
    record({ id: 'T10', actual: `${toast} Allocated ${c[5]}, available ${c[6]}.`, result: c[5] === '0' && c[6] === '10' ? 'PASS' : 'FAIL', shots: [s] });
  }

  // T11: restock
  {
    await clearToasts();
    await resetFilters();
    await row(newSku).locator('button', { hasText: 'Restock' }).click();
    await page.fill('#modalRestockQty', '5');
    await page.click('#restockModalForm button[type=submit]');
    const toast = await lastToast();
    await page.fill('#inventorySearchInput', 'Oak Coffee');
    await page.waitForTimeout(150);
    const c = await cells(row(newSku));
    const s = await shot('T11');
    record({ id: 'T11', actual: `${toast} On hand ${c[4]}.`, result: c[4] === '15' ? 'PASS' : 'FAIL', shots: [s] });
  }

  // T12: adjust a physical stock count
  {
    await clearToasts();
    await resetFilters();
    await row('MW-DIN-001').locator('button', { hasText: 'Adjust' }).click();
    await page.fill('#modalAdjustNewTotal', '20');
    await page.click('#adjustStockModalForm button[type=submit]');
    const toast = await lastToast();
    const c = await cells(row('MW-DIN-001'));
    const s = await shot('T12');
    record({ id: 'T12', actual: `${toast} On hand ${c[4]}.`, result: c[4] === '20' ? 'PASS' : 'FAIL', shots: [s] });
  }

  // T13: add a category whose name has an apostrophe
  {
    await clearToasts();
    await tab('tab-categories');
    await page.fill('#newCategoryName', "Kid's Room");
    await page.fill('#newCategorySkuPrefix', 'KID');
    await page.click('#addCategoryForm button[type=submit]');
    const toast = await lastToast();
    const exists = (await page.locator('#categoriesTableBody tr', { hasText: "Kid's Room" }).count()) > 0;
    const s = await shot('T13');
    record({ id: 'T13', actual: toast, result: exists ? 'PASS' : 'FAIL', shots: [s] });
  }

  // T14: delete that category
  {
    await clearToasts();
    pageErrors = [];
    await page.locator('#categoriesTableBody tr', { hasText: "Kid's Room" }).locator('button', { hasText: 'Delete' }).click();
    await page.waitForTimeout(600);
    const toast = (await page.locator('.toast-item').count()) ? await lastToast() : '(no message shown)';
    const stillThere = (await page.locator('#categoriesTableBody tr', { hasText: "Kid's Room" }).count()) > 0;
    const s = await shot('T14');
    const err = pageErrors.length ? ` Browser error: ${pageErrors[0]}` : '';
    record({ id: 'T14', actual: stillThere ? `Nothing happened; the category is still listed.${err}` : toast, result: stillThere ? 'FAIL' : 'PASS', shots: [s] });
  }

  // T15: a category that still has items cannot be deleted
  {
    await clearToasts();
    await tab('tab-categories');
    await page.locator('#categoriesTableBody tr', { hasText: 'Living Room' }).locator('button', { hasText: 'Delete' }).click();
    const toast = await lastToast();
    const s = await shot('T15');
    record({ id: 'T15', actual: toast, result: /cannot delete/i.test(toast) ? 'PASS' : 'FAIL', shots: [s] });
  }

  // T16: search
  {
    await clearToasts();
    await resetFilters();
    await page.fill('#inventorySearchInput', 'chair');
    await page.waitForTimeout(200);
    const names = await page.locator('#inventoryTableBody tr td:nth-child(2)').allInnerTexts();
    const s = await shot('T16');
    record({ id: 'T16', actual: `Rows shown: ${names.map(n => n.split('\n')[0]).join(', ')}.`, result: names.length > 0 && names.every(n => /chair/i.test(n)) ? 'PASS' : 'FAIL', shots: [s] });
  }

  // T17: category filter
  {
    await clearToasts();
    await resetFilters();
    await page.selectOption('#categoryFilterSelect', 'Bedroom');
    await page.waitForTimeout(200);
    const cats = await page.locator('#inventoryTableBody tr td:nth-child(3)').allInnerTexts();
    const s = await shot('T17');
    record({ id: 'T17', actual: `${cats.length} row(s) shown, categories: ${[...new Set(cats)].join(', ')}.`, result: cats.length > 0 && cats.every(c => c.trim() === 'Bedroom') ? 'PASS' : 'FAIL', shots: [s] });
  }

  // T18: report total matches the stock table
  {
    await clearToasts();
    await resetFilters();
    const expected = await page.evaluate(() => {
      let sum = 0;
      document.querySelectorAll('#inventoryTableBody tr').forEach(tr => {
        const v = tr.children[7]?.innerText.replace(/[^0-9.]/g, '');
        if (v) sum += Number(v);
      });
      return sum;
    });
    await tab('tab-report');
    const shown = await page.locator('#rptTotalValuation').innerText();
    const shownNum = Number(shown.replace(/[^0-9.]/g, ''));
    const s = await shot('T18');
    record({ id: 'T18', actual: `Report total ${shown}; sum of the stock table ${'AED ' + expected.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`, result: Math.abs(shownNum - expected) < 0.01 ? 'PASS' : 'FAIL', shots: [s] });
  }

  // T19: data survives a page refresh
  {
    await page.reload();
    await page.waitForSelector('#inventoryTableBody tr');
    await page.fill('#inventorySearchInput', 'Oak Coffee');
    await page.waitForTimeout(200);
    const c = (await row(newSku).count()) ? await cells(row(newSku)) : [];
    const s = await shot('T19');
    record({ id: 'T19', actual: c.length ? `After refresh the row is still there: ${c[0]}, on hand ${c[4]}.` : 'The item disappeared after refresh.', result: c[4] === '15' ? 'PASS' : 'FAIL', shots: [s] });
  }

  // T20: low-stock warning depends on the type of furniture
  {
    const typed = await hasTypeField();
    await addItem({ name: 'Test Wardrobe', category: 'Bedroom', qty: 2, price: 3000, type: 'LARGE' });
    await addItem({ name: 'Test Bench', category: 'Bedroom', qty: 4, price: 1500, type: 'LARGE' });
    await addItem({ name: 'Test Stool', category: 'Bedroom', qty: 4, price: 250, type: 'STANDARD' });
    await resetFilters();
    await page.fill('#inventorySearchInput', 'Test ');
    await page.waitForTimeout(200);
    const st = {};
    for (const n of ['Test Wardrobe', 'Test Bench', 'Test Stool']) st[n] = (await cells(rowByName(n)))[8];
    const s = await shot('T20');
    const pass = typed && /low/i.test(st["Test Wardrobe"]) && /in stock/i.test(st["Test Bench"]) && /low/i.test(st["Test Stool"]);
    record({ id: 'T20', actual: `${typed ? '' : 'No furniture type option exists, so every item uses the same rule. '}Wardrobe (2 left): ${st['Test Wardrobe']}; Bench (4 left): ${st['Test Bench']}; Stool (4 left): ${st['Test Stool']}.`, result: pass ? 'PASS' : (typed ? 'FAIL' : 'N/A'), shots: [s] });
  }

  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ label, results }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

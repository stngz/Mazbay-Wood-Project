// Automated logic tests for the InventoryManager class (Task 3, part B).
// Usage: npm test   (compiles the classes, then runs these checks)
// Optional: node tests/logic_tests.cjs <compiledBuildDir> [outJson] [label]
const fs = require('fs');
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, clear: () => {} };
const [buildDir = '.test-build', outJson, label = 'run'] = process.argv.slice(2);
// The project is an ES module package, so mark the compiled test build as CommonJS.
fs.writeFileSync(require('path').resolve(buildDir, 'package.json'), '{"type":"commonjs"}');
const { InventoryManager } = require(require('path').resolve(buildDir, 'services/InventoryManager.js'));

const m = new InventoryManager();
const getItem = c => (typeof m.getItem === 'function' ? m.getItem(c) : m.items.get(c));
const results = [];
function test(id, name, input, expected, fn) {
  let actual, pass;
  try { [actual, pass] = fn(); } catch (e) { actual = `Error thrown: ${e.message}`; pass = false; }
  results.push({ id, name, input, expected, actual, result: pass ? 'PASS' : 'FAIL' });
}
const rejects = f => { try { const r = f(); return [`Accepted (no error). Result: ${JSON.stringify(r && r.itemCode ? { code: r.itemCode, qty: r.stockLevel, price: r.unitPrice, category: r.category } : r)}`, false]; } catch (e) { return [`Rejected: ${e.message}`, true]; } };

test('L01', 'Fractional starting quantity', 'addStock("Half Sofa", "Living Room", 2.5, 1200)', 'Rejected: quantity must be a whole number', () => rejects(() => m.addStock('Half Sofa', 'Living Room', '2.5', '1200')));
test('L02', 'Price of zero', 'addStock("Free Stool", "Living Room", 3, 0)', 'Rejected: price must be more than 0', () => rejects(() => m.addStock('Free Stool', 'Living Room', '3', '0')));
test('L03', 'Category that does not exist', 'addStock("Ghost Cabinet", "Bathroom", 3, 50)', 'Rejected: category not found', () => rejects(() => m.addStock('Ghost Cabinet', 'Bathroom', '3', '50')));
test('L04', 'Blank category', 'addStock("No Category Item", "", 3, 50)', 'Rejected: category required', () => rejects(() => m.addStock('No Category Item', '', '3', '50')));
test('L05', 'Letters as allocation quantity', 'allocateStock("MW-LIV-003", "abc", "SO-1", "Test")', 'Refused with a message', () => { const r = m.allocateStock('MW-LIV-003', 'abc', 'SO-1', 'Test'); return [r.message, !r.success]; });
test('L06', 'Fractional allocation quantity', 'allocateStock("MW-LIV-003", 1.5, "SO-2", "Test")', 'Refused: whole units only', () => { const r = m.allocateStock('MW-LIV-003', '1.5', 'SO-2', 'Test'); return [r.success ? `Accepted: ${r.message}` : r.message, !r.success]; });
test('L07', 'Blank order number', 'allocateStock("MW-LIV-003", 1, "", "Test")', 'Refused: order number required', () => { const r = m.allocateStock('MW-LIV-003', '1', '', 'Test'); return [r.success ? `Accepted: ${r.message}` : r.message, !r.success]; });
test('L08', 'Set stock below reserved units', 'editStock("MW-DIN-001", 1) while units are reserved', 'Refused: cannot go below reserved units', () => { const r = m.editStock('MW-DIN-001', '1'); return [r.message, !r.success]; });
test('L09', 'Allocation IDs are unique', '300 allocations of 1 unit each', 'All 300 IDs different', () => {
  const item = m.addStock('Bulk Test Chair', 'Living Room', '1000', '100');
  const ids = [];
  for (let i = 0; i < 300; i++) ids.push(m.allocateStock(item.itemCode, '1', `SO-B${i}`, 'Bulk').allocation.id);
  const unique = new Set(ids).size;
  return [`${unique} unique IDs out of 300 (${300 - unique} repeated)`, unique === 300];
});
test('L10', 'Overselling guard at the class level', 'allocateStock("MW-ACC-006", available + 1, ...)', 'Refused: overselling prevented', () => {
  const avail = getItem('MW-ACC-006').getAvailableStock();
  const r = m.allocateStock('MW-ACC-006', String(avail + 1), 'SO-X', 'Test');
  return [r.message, !r.success];
});

if (outJson) fs.writeFileSync(outJson, JSON.stringify({ label, results }, null, 2));
for (const r of results) console.log(`${r.id} ${r.result}  ${r.name}: ${r.actual}`);
const passed = results.filter(r => r.result === 'PASS').length;
console.log(`\n${passed} of ${results.length} tests passed`);
process.exitCode = passed === results.length ? 0 : 1;

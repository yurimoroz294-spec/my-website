// ── Storage helpers ─────────────────────────────────────────
const STORAGE_KEY_APARTMENTS = 'rentalCrm.apartments';
const STORAGE_KEY_EXPENSES   = 'rentalCrm.expenses';

function loadApartments() {
  const raw = localStorage.getItem(STORAGE_KEY_APARTMENTS);
  if (raw) return JSON.parse(raw);
  const seeded = Array.from({ length: 9 }, (_, i) => ({
    id: crypto.randomUUID(),
    name: `Byt ${i + 1}`,
    tenant: '',
    status: 'occupied',
    rent: 0,
    monthlyCost: 0,
  }));
  saveApartments(seeded);
  return seeded;
}
function saveApartments(list) {
  localStorage.setItem(STORAGE_KEY_APARTMENTS, JSON.stringify(list));
}

function loadExpenses() {
  const raw = localStorage.getItem(STORAGE_KEY_EXPENSES);
  return raw ? JSON.parse(raw) : [];
}
function saveExpenses(list) {
  localStorage.setItem(STORAGE_KEY_EXPENSES, JSON.stringify(list));
}

let apartments = loadApartments();
let expenses   = loadExpenses();

const fmtCzk = n => `${Math.round(n).toLocaleString('cs-CZ')} Kč`;

// ── Apartments table ─────────────────────────────────────────
const apartmentsBody = document.getElementById('apartmentsBody');

function renderApartments() {
  apartmentsBody.innerHTML = '';
  apartments.forEach(apt => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" data-field="name" value="${escapeHtml(apt.name)}" /></td>
      <td><input type="text" data-field="tenant" value="${escapeHtml(apt.tenant)}" /></td>
      <td>
        <select data-field="status">
          <option value="occupied" ${apt.status === 'occupied' ? 'selected' : ''}>Здається</option>
          <option value="vacant" ${apt.status === 'vacant' ? 'selected' : ''}>Вільна</option>
        </select>
      </td>
      <td><input type="number" data-field="rent" min="0" step="100" value="${apt.rent}" /></td>
      <td><input type="number" data-field="monthlyCost" min="0" step="100" value="${apt.monthlyCost}" /></td>
      <td class="apt-net-cell" data-net-for="${apt.id}">—</td>
      <td><button class="row-delete-btn" data-action="delete">Видалити</button></td>
    `;
    tr.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('input', () => {
        const field = el.dataset.field;
        apt[field] = (field === 'rent' || field === 'monthlyCost') ? Number(el.value) || 0 : el.value;
        saveApartments(apartments);
        renderDashboard();
        renderBookkeeping();
      });
    });
    tr.querySelector('[data-action="delete"]').addEventListener('click', () => {
      apartments = apartments.filter(a => a.id !== apt.id);
      saveApartments(apartments);
      renderApartments();
      renderExpenseApartmentOptions();
      renderDashboard();
      renderBookkeeping();
    });
    apartmentsBody.appendChild(tr);
  });
  renderBookkeeping();
}

document.getElementById('addApartmentBtn').addEventListener('click', () => {
  apartments.push({
    id: crypto.randomUUID(),
    name: `Byt ${apartments.length + 1}`,
    tenant: '',
    status: 'vacant',
    rent: 0,
    monthlyCost: 0,
  });
  saveApartments(apartments);
  renderApartments();
  renderExpenseApartmentOptions();
  renderDashboard();
});

// ── Expenses table ───────────────────────────────────────────
const expensesBody = document.getElementById('expensesBody');

function apartmentOptionsHtml(selectedId) {
  return apartments
    .map(a => `<option value="${a.id}" ${a.id === selectedId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`)
    .join('');
}

function renderExpenseApartmentOptions() {
  expensesBody.querySelectorAll('select[data-field="apartmentId"]').forEach(sel => {
    const current = sel.value;
    sel.innerHTML = apartmentOptionsHtml(current);
  });
}

function renderExpenses() {
  expensesBody.innerHTML = '';
  expenses.forEach(exp => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="date" data-field="date" value="${exp.date}" /></td>
      <td><select data-field="apartmentId">${apartmentOptionsHtml(exp.apartmentId)}</select></td>
      <td><input type="text" data-field="category" value="${escapeHtml(exp.category)}" placeholder="напр. ремонт, енергії" /></td>
      <td><input type="number" data-field="amount" min="0" step="100" value="${exp.amount}" /></td>
      <td><button class="row-delete-btn" data-action="delete">Видалити</button></td>
    `;
    tr.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('input', () => {
        const field = el.dataset.field;
        exp[field] = field === 'amount' ? Number(el.value) || 0 : el.value;
        saveExpenses(expenses);
        renderBookkeeping();
      });
    });
    tr.querySelector('[data-action="delete"]').addEventListener('click', () => {
      expenses = expenses.filter(e => e.id !== exp.id);
      saveExpenses(expenses);
      renderExpenses();
      renderBookkeeping();
    });
    expensesBody.appendChild(tr);
  });
}

document.getElementById('addExpenseBtn').addEventListener('click', () => {
  if (apartments.length === 0) {
    alert('Спочатку додайте хоча б одну квартиру.');
    return;
  }
  expenses.push({
    id: crypto.randomUUID(),
    date: new Date().toISOString().slice(0, 10),
    apartmentId: apartments[0].id,
    category: '',
    amount: 0,
  });
  saveExpenses(expenses);
  renderExpenses();
  renderBookkeeping();
});

// ── Dashboard ────────────────────────────────────────────────
function renderDashboard() {
  const occupied = apartments.filter(a => a.status === 'occupied');
  const monthlyIncome = occupied.reduce((sum, a) => sum + (Number(a.rent) || 0), 0);
  document.getElementById('statApartments').textContent = apartments.length;
  document.getElementById('statOccupied').textContent = occupied.length;
  document.getElementById('statMonthlyIncome').textContent = fmtCzk(monthlyIncome);
  document.getElementById('statYearlyIncome').textContent = fmtCzk(monthlyIncome * 12);

  // keep tax income field in sync if user hasn't typed a custom value
  const taxIncomeInput = document.getElementById('taxIncome');
  if (taxIncomeInput && !taxIncomeInput.dataset.touched) {
    taxIncomeInput.value = monthlyIncome * 12;
  }
}

// ── Tax calculator ───────────────────────────────────────────
// 2026 brackets (indicative — verify against financnisprava.gov.cz before filing)
const TAX_RATE_LOW    = 0.15;
const TAX_RATE_HIGH   = 0.23;
const TAX_THRESHOLD   = 1762812; // 36x average wage, 2026
const BASIC_ALLOWANCE = 30840;   // sleva na poplatníka, per year

function progressiveTax(base) {
  if (base <= 0) return 0;
  if (base <= TAX_THRESHOLD) return base * TAX_RATE_LOW;
  return TAX_THRESHOLD * TAX_RATE_LOW + (base - TAX_THRESHOLD) * TAX_RATE_HIGH;
}

// Returns { taxBase, taxAmount, insurance, expensesUsed } for a given regime.
// `realExpenses` is used by the §9-real and s.r.o. regimes.
function computeTax(income, realExpenses, regime) {
  let expensesUsed, taxBase, taxAmount, insurance = 0;
  if (regime === 'par9-flat') {
    expensesUsed = Math.min(income * 0.3, 600000);
    taxBase = Math.max(income - expensesUsed, 0);
    taxAmount = Math.max(progressiveTax(taxBase) - BASIC_ALLOWANCE, 0);
  } else if (regime === 'par9-real') {
    expensesUsed = realExpenses;
    taxBase = Math.max(income - expensesUsed, 0);
    taxAmount = Math.max(progressiveTax(taxBase) - BASIC_ALLOWANCE, 0);
  } else if (regime === 'osvc-flat') {
    expensesUsed = Math.min(income * 0.6, 1200000);
    taxBase = Math.max(income - expensesUsed, 0);
    taxAmount = Math.max(progressiveTax(taxBase) - BASIC_ALLOWANCE, 0);
    const assessmentBase = taxBase * 0.5;
    insurance = assessmentBase * 0.292 + assessmentBase * 0.135;
  } else { // sro
    expensesUsed = realExpenses;
    taxBase = Math.max(income - expensesUsed, 0);
    taxAmount = taxBase * 0.21;
  }
  return { taxBase, taxAmount, insurance, expensesUsed };
}

function totalApartmentsIncome() {
  return apartments.reduce((sum, a) => sum + (Number(a.rent) || 0) * 12, 0);
}
function totalRealExpenses() {
  const apartmentCosts = apartments.reduce((sum, a) => sum + (Number(a.monthlyCost) || 0) * 12, 0);
  const loggedExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  return apartmentCosts + loggedExpenses;
}
function expensesForApartment(aptId) {
  return expenses
    .filter(e => e.apartmentId === aptId)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

const taxRegimeSelect    = document.getElementById('taxRegime');
const realExpensesGroup  = document.getElementById('realExpensesGroup');
const taxIncomeInput     = document.getElementById('taxIncome');
const taxRealExpensesEl  = document.getElementById('taxRealExpenses');
const taxResultEl        = document.getElementById('taxResult');

taxIncomeInput.addEventListener('input', () => { taxIncomeInput.dataset.touched = '1'; });

function syncRealExpensesVisibility() {
  realExpensesGroup.style.display = taxRegimeSelect.value === 'par9-real' ? '' : 'none';
}
taxRegimeSelect.addEventListener('change', syncRealExpensesVisibility);
syncRealExpensesVisibility();

function row(label, value, isTotal = false) {
  return `<div class="tax-row${isTotal ? ' total' : ''}"><span>${label}</span><span>${value}</span></div>`;
}

document.getElementById('calcTaxBtn').addEventListener('click', () => {
  const income  = Number(taxIncomeInput.value) || 0;
  const regime  = taxRegimeSelect.value;
  let expenses, base, tax, html = '', extraNote = '';

  if (regime === 'par9-flat') {
    expenses = Math.min(income * 0.3, 600000);
    base = Math.max(income - expenses, 0);
    tax = Math.max(progressiveTax(base) - BASIC_ALLOWANCE, 0);
    html += row('Дохід', fmtCzk(income));
    html += row('Паушальні витрати (30%, стеля 600 000 Kč)', fmtCzk(expenses));
    html += row('Податкова база', fmtCzk(base));
    html += row('Знижка на платника', `−${fmtCzk(BASIC_ALLOWANCE)}`);
    html += row('Соц./мед. страхування', '0 Kč (не сплачується за §9)');
    html += row('Податок до сплати', fmtCzk(tax), true);
    html += row('Чистий дохід (після податку)', fmtCzk(income - tax));
  } else if (regime === 'par9-real') {
    expenses = Number(taxRealExpensesEl.value) || 0;
    base = Math.max(income - expenses, 0);
    tax = Math.max(progressiveTax(base) - BASIC_ALLOWANCE, 0);
    html += row('Дохід', fmtCzk(income));
    html += row('Реальні витрати', fmtCzk(expenses));
    html += row('Податкова база', fmtCzk(base));
    html += row('Знижка на платника', `−${fmtCzk(BASIC_ALLOWANCE)}`);
    html += row('Соц./мед. страхування', '0 Kč (не сплачується за §9)');
    html += row('Податок до сплати', fmtCzk(tax), true);
    html += row('Чистий дохід (після податку)', fmtCzk(income - tax));
  } else if (regime === 'osvc-flat') {
    expenses = Math.min(income * 0.6, 1200000);
    base = Math.max(income - expenses, 0);
    tax = Math.max(progressiveTax(base) - BASIC_ALLOWANCE, 0);
    const assessmentBase = base * 0.5;
    const socialIns = assessmentBase * 0.292;
    const healthIns = assessmentBase * 0.135;
    html += row('Дохід', fmtCzk(income));
    html += row('Паушальні витрати (60%, стеля 1 200 000 Kč)', fmtCzk(expenses));
    html += row('Податкова база (зисk)', fmtCzk(base));
    html += row('Знижка на платника', `−${fmtCzk(BASIC_ALLOWANCE)}`);
    html += row('Податок з прибутку', fmtCzk(tax));
    html += row('Соціальне страхування (оцінка, 29.2% з 50% бази)', fmtCzk(socialIns));
    html += row('Медичне страхування (оцінка, 13.5% з 50% бази)', fmtCzk(healthIns));
    html += row('Разом до сплати', fmtCzk(tax + socialIns + healthIns), true);
    html += row('Чистий дохід (орієнтовно)', fmtCzk(income - tax - socialIns - healthIns));
    extraNote = 'Соц./мед. страхування показані за відсотковою формулою без урахування мінімальних авансів — реальна сума не може бути нижчою за мінімум, актуальний на поточний рік.';
  } else if (regime === 'sro') {
    expenses = Number(taxRealExpensesEl.value) || 0;
    base = Math.max(income - expenses, 0);
    const corpTax = base * 0.21;
    const afterCorp = base - corpTax;
    const dividendTax = afterCorp * 0.15;
    html += row('Дохід компанії', fmtCzk(income));
    html += row('Витрати', fmtCzk(expenses));
    html += row('Прибуток до оподаткування', fmtCzk(base));
    html += row('Корпоративний податок 21%', fmtCzk(corpTax));
    html += row('Прибуток після податку', fmtCzk(afterCorp));
    html += row('Податок на дивіденди 15% (при виплаті власнику)', fmtCzk(dividendTax));
    html += row('Чистий дохід власника (якщо все виплачено як дивіденди)', fmtCzk(afterCorp - dividendTax), true);
    extraNote = 'Заснування й утримання s.r.o. означає подвійне оподаткування (фірма + дивіденди), бухгалтерський облік і додаткові витрати — порівняйте з §9 перед рішенням.';
  }

  if (extraNote) html += `<p class="tax-placeholder" style="margin-top:8px;">${extraNote}</p>`;
  taxResultEl.innerHTML = html;
});

// Recompute live whenever income/regime/real-expenses change in the calculator.
[taxRegimeSelect, taxIncomeInput, taxRealExpensesEl].forEach(el =>
  el.addEventListener('input', renderBookkeeping)
);
taxRegimeSelect.addEventListener('change', renderBookkeeping);

// ── Bookkeeping (auto, based on apartments + expense log) ────
const bookkeepingResultEl = document.getElementById('bookkeepingResult');

function renderBookkeeping() {
  const regime = taxRegimeSelect.value;
  const income = totalApartmentsIncome();
  const realExpenses = regime === 'par9-real' || regime === 'sro'
    ? (Number(taxRealExpensesEl.value) || totalRealExpenses())
    : totalRealExpenses();

  const { taxAmount, insurance } = computeTax(income, realExpenses, regime);
  const realProfitBeforeTax = income - totalRealExpenses();
  const totalDue = taxAmount + insurance;
  const netAfterTax = realProfitBeforeTax - totalDue;

  let html = '';
  html += row('Дохід від оренди (рік)', fmtCzk(income));
  html += row('Реальні витрати (квартири + журнал)', fmtCzk(totalRealExpenses()));
  html += row('Прибуток до податку', fmtCzk(realProfitBeforeTax));
  html += row('Податок (за обраним режимом)', fmtCzk(taxAmount));
  if (insurance > 0) html += row('Соц./мед. страхування (оцінка)', fmtCzk(insurance));
  html += row('Чистий прибуток (на руках)', fmtCzk(netAfterTax), true);
  bookkeepingResultEl.innerHTML = html;

  // per-apartment net column, tax allocated proportionally to income share
  apartments.forEach(apt => {
    const cell = document.querySelector(`[data-net-for="${apt.id}"]`);
    if (!cell) return;
    const aptIncome = (Number(apt.rent) || 0) * 12;
    const aptExpenses = (Number(apt.monthlyCost) || 0) * 12 + expensesForApartment(apt.id);
    const aptProfit = aptIncome - aptExpenses;
    const share = income > 0 ? aptIncome / income : 0;
    const aptDue = totalDue * share;
    cell.textContent = fmtCzk(aptProfit - aptDue);
  });
}

// ── Utils ────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ── Init ─────────────────────────────────────────────────────
renderApartments();
renderExpenses();
renderDashboard();

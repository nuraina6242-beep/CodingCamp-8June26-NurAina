/* ═══════════════════════════════════════════════════════════
   FinTrack — script.js
   All functionality: add/delete transactions, local storage,
   pie chart, dark/light mode, custom categories, sort.
   ═══════════════════════════════════════════════════════════ */

// ── Constants ────────────────────────────────────────────
const STORAGE_KEY = 'budgetVisualizer_transactions';
const THEME_KEY   = 'budgetVisualizer_theme';
const CAT_KEY     = 'budgetVisualizer_categories';

const CATEGORY_META = {
  Food:      { emoji: '🍔', color: '#f59e0b' },
  Transport: { emoji: '🚌', color: '#3b82f6' },
  Fun:       { emoji: '🎉', color: '#ec4899' },
};

const EXTRA_COLORS = [
  '#10b981','#8b5cf6','#06b6d4','#f97316',
  '#84cc16','#e11d48','#0ea5e9','#a855f7',
];

// ── State ─────────────────────────────────────────────────
let transactions    = [];
let customCategories = [];
let currentSort     = 'date-desc';
let transactionType = 'expense';
let chartInstance   = null;

// ── DOM ───────────────────────────────────────────────────
const itemNameInput       = document.getElementById('itemName');
const amountInput         = document.getElementById('amount');
const categorySelect      = document.getElementById('category');
const addBtn              = document.getElementById('addTransactionBtn');
const sortSelect          = document.getElementById('sortSelect');
const transactionList     = document.getElementById('transactionList');
const chartEmptyEl        = document.getElementById('chartEmpty');
const chartLegendEl       = document.getElementById('chartLegend');
const btnExpense          = document.getElementById('btnExpense');
const btnIncome           = document.getElementById('btnIncome');
const toggleCustomCatBtn  = document.getElementById('toggleCustomCategory');
const customCategoryRow   = document.getElementById('customCategoryRow');
const customCategoryInput = document.getElementById('customCategoryInput');
const addCustomCatBtn     = document.getElementById('addCustomCategoryBtn');

// Stat display elements
const totalBalanceEl  = document.getElementById('totalBalance');
const totalIncomeEl   = document.getElementById('totalIncome');
const totalExpenseEl  = document.getElementById('totalExpense');
const totalCountEl    = document.getElementById('totalCount');
const txSubtitleEl    = document.getElementById('txSubtitle');
const currentDateEl   = document.getElementById('currentDate');

// Theme elements
const themeToggleSidebar = document.getElementById('themeToggle');
const themeToggleMobile  = document.getElementById('themeToggleMobile');
const mobileThemeIcon    = document.getElementById('mobileThemeIcon');
const themeToggleIcon    = themeToggleSidebar ? themeToggleSidebar.querySelector('.theme-toggle-icon') : null;
const themeToggleLabel   = themeToggleSidebar ? themeToggleSidebar.querySelector('.theme-toggle-label') : null;

// Sidebar
const sidebar        = document.getElementById('sidebar');
const menuBtn        = document.getElementById('menuBtn');
const sidebarOverlay = document.getElementById('sidebarOverlay');

// Custom cat button label
const customCatBtnLabel = document.getElementById('customCatBtnLabel');

// ── Init ──────────────────────────────────────────────────
function init() {
  setCurrentDate();
  loadTheme();
  loadCustomCategories();
  loadTransactions();
  renderAll();
  bindEvents();
}

// ── Date ──────────────────────────────────────────────────
function setCurrentDate() {
  if (!currentDateEl) return;
  const now = new Date();
  currentDateEl.textContent = now.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

// ── Events ────────────────────────────────────────────────
function bindEvents() {
  addBtn.addEventListener('click', handleAddTransaction);

  sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    renderTransactionList();
  });

  btnExpense.addEventListener('click', () => setTransactionType('expense'));
  btnIncome.addEventListener('click',  () => setTransactionType('income'));

  toggleCustomCatBtn.addEventListener('click', toggleCustomCategoryPanel);
  addCustomCatBtn.addEventListener('click', handleAddCustomCategory);
  customCategoryInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAddCustomCategory();
  });

  // Live error clearing
  itemNameInput.addEventListener('input',  () => clearError('itemName'));
  amountInput.addEventListener('input',    () => clearError('amount'));
  categorySelect.addEventListener('change', () => clearError('category'));

  // Enter-to-submit
  [itemNameInput, amountInput].forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') handleAddTransaction(); });
  });

  // Theme toggles
  if (themeToggleSidebar) themeToggleSidebar.addEventListener('click', toggleTheme);
  if (themeToggleMobile)  themeToggleMobile.addEventListener('click', toggleTheme);

  // Sidebar (mobile)
  if (menuBtn)       menuBtn.addEventListener('click', openSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

  // Close sidebar on nav link click (mobile)
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth < 768) closeSidebar();
    });
  });
}

// ── Sidebar ───────────────────────────────────────────────
function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('show');
  document.body.style.overflow = '';
}

// ── Transaction Type ──────────────────────────────────────
function setTransactionType(type) {
  transactionType = type;
  btnExpense.classList.toggle('active', type === 'expense');
  btnIncome.classList.toggle('active',  type === 'income');
}

// ── Validation ────────────────────────────────────────────
function validateForm() {
  let valid = true;

  const name = itemNameInput.value.trim();
  if (!name) {
    showError('itemName', 'Nama item wajib diisi.');
    valid = false;
  } else if (name.length < 2) {
    showError('itemName', 'Nama harus minimal 2 karakter.');
    valid = false;
  }

  const amtRaw = amountInput.value.trim();
  const amount = parseFloat(amtRaw);
  if (!amtRaw) {
    showError('amount', 'Jumlah wajib diisi.');
    valid = false;
  } else if (isNaN(amount) || amount <= 0) {
    showError('amount', 'Masukkan jumlah yang valid lebih dari 0.');
    valid = false;
  }

  const category = categorySelect.value;
  if (!category) {
    showError('category', 'Silakan pilih kategori.');
    valid = false;
  }

  return valid;
}

function showError(field, msg) {
  const input = document.getElementById(field);
  const err   = document.getElementById(field + 'Error');
  if (input) input.classList.add('error');
  if (err)   err.textContent = msg;
}

function clearError(field) {
  const input = document.getElementById(field);
  const err   = document.getElementById(field + 'Error');
  if (input) input.classList.remove('error');
  if (err)   err.textContent = '';
}

function clearAllErrors() {
  ['itemName', 'amount', 'category'].forEach(clearError);
}

// ── Add Transaction ───────────────────────────────────────
function handleAddTransaction() {
  clearAllErrors();
  if (!validateForm()) return;

  const transaction = {
    id:       crypto.randomUUID
                ? crypto.randomUUID()
                : Date.now().toString(36) + Math.random().toString(36).slice(2),
    name:     itemNameInput.value.trim(),
    amount:   parseFloat(parseFloat(amountInput.value).toFixed(2)),
    category: categorySelect.value,
    type:     transactionType,
    date:     new Date().toISOString(),
  };

  transactions.unshift(transaction);
  saveTransactions();
  renderAll();
  resetForm();
}

function resetForm() {
  itemNameInput.value  = '';
  amountInput.value    = '';
  categorySelect.value = '';
  clearAllErrors();
  itemNameInput.focus();
}

// ── Delete Transaction ────────────────────────────────────
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  renderAll();
}

// ── Render All ────────────────────────────────────────────
function renderAll() {
  renderStats();
  renderTransactionList();
  renderChart();
}

// ── Stats ─────────────────────────────────────────────────
function renderStats() {
  const totalIncome  = transactions.filter(t => t.type === 'income')
                                   .reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense')
                                   .reduce((s, t) => s + t.amount, 0);
  const balance      = totalIncome - totalExpense;

  if (totalBalanceEl) {
    totalBalanceEl.textContent = formatCurrency(balance);
    totalBalanceEl.classList.toggle('negative', balance < 0);
  }
  if (totalIncomeEl)  totalIncomeEl.textContent  = formatCurrency(totalIncome);
  if (totalExpenseEl) totalExpenseEl.textContent = formatCurrency(totalExpense);
  if (totalCountEl)   totalCountEl.textContent   = transactions.length;
  if (txSubtitleEl)   txSubtitleEl.textContent   =
    transactions.length === 0
      ? '0 transaksi tercatat'
      : `${transactions.length} transaksi tercatat`;
}

// ── Transaction List ──────────────────────────────────────
function renderTransactionList() {
  const sorted = [...transactions].sort((a, b) => {
    switch (currentSort) {
      case 'date-asc':     return new Date(a.date) - new Date(b.date);
      case 'amount-desc':  return b.amount - a.amount;
      case 'amount-asc':   return a.amount - b.amount;
      case 'category-asc': return a.category.localeCompare(b.category);
      default:             return new Date(b.date) - new Date(a.date);
    }
  });

  transactionList.innerHTML = '';

  if (sorted.length === 0) {
    transactionList.appendChild(buildEmptyState());
    return;
  }

  sorted.forEach(t => transactionList.appendChild(buildTxItem(t)));
}

function buildEmptyState() {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.innerHTML = `
    <div class="empty-icon-box">📭</div>
    <p>Belum ada transaksi.<br/>Tambahkan satu di atas untuk memulai.</p>
  `;
  return div;
}

function buildTxItem(t) {
  const meta    = getCategoryMeta(t.category);
  const date    = new Date(t.date);
  const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const sign    = t.type === 'income' ? '+' : '−';
  const cls     = t.type === 'income' ? 'income' : 'expense';
  const badgeBg = hexToRgba(meta.color, 0.14);
  const tagBg   = hexToRgba(meta.color, 0.12);
  const tagClr  = meta.color;

  const item = document.createElement('div');
  item.className = 'tx-item';
  item.setAttribute('role', 'listitem');
  item.dataset.id = t.id;

  item.innerHTML = `
    <div class="tx-badge" style="background:${badgeBg}" aria-label="${escapeHtml(t.category)}">
      ${meta.emoji}
    </div>
    <div class="tx-info">
      <div class="tx-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div>
      <div class="tx-meta">
        <span class="tx-cat-tag" style="background:${tagBg};color:${tagClr}">${escapeHtml(t.category)}</span>
        <span>${dateStr} · ${timeStr}</span>
      </div>
    </div>
    <div class="tx-right">
      <span class="tx-amount ${cls}">${sign} ${formatCurrency(t.amount)}</span>
      <button class="tx-del" aria-label="Hapus transaksi: ${escapeHtml(t.name)}" title="Hapus">🗑</button>
    </div>
  `;

  item.querySelector('.tx-del').addEventListener('click', () => deleteTransaction(t.id));
  return item;
}

// ── Pie Chart ─────────────────────────────────────────────
function renderChart() {
  const expenseMap = {};
  transactions.forEach(t => {
    if (t.type === 'expense') {
      expenseMap[t.category] = (expenseMap[t.category] || 0) + t.amount;
    }
  });

  const labels = Object.keys(expenseMap);
  const data   = Object.values(expenseMap);
  const colors = labels.map(l => getCategoryMeta(l).color);
  const hasData = data.length > 0;

  // Toggle placeholder visibility
  if (chartEmptyEl) {
    chartEmptyEl.style.display = hasData ? 'none' : 'flex';
  }

  // Legend
  chartLegendEl.innerHTML = '';
  if (hasData) {
    labels.forEach((label, i) => {
      const el = document.createElement('div');
      el.className = 'legend-item';
      el.innerHTML = `
        <span class="legend-dot" style="background:${colors[i]}"></span>
        <span>${escapeHtml(label)}</span>
      `;
      chartLegendEl.appendChild(el);
    });
  }

  if (chartInstance) {
    chartInstance.data.labels                        = labels;
    chartInstance.data.datasets[0].data              = data;
    chartInstance.data.datasets[0].backgroundColor   = colors;
    chartInstance.update();
    return;
  }

  const ctx = document.getElementById('expenseChart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 3,
        borderColor: 'transparent',
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `  ${ctx.label}: ${formatCurrency(ctx.parsed)}`,
          },
          backgroundColor: 'rgba(13,27,46,.88)',
          titleColor: '#f0f6ff',
          bodyColor: '#d1dff0',
          padding: 10,
          cornerRadius: 8,
        },
      },
      animation: {
        animateRotate: true,
        duration: 550,
        easing: 'easeOutQuart',
      },
    },
  });
}

// ── Theme ─────────────────────────────────────────────────
function toggleTheme() {
  const html    = document.documentElement;
  const isDark  = html.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  applyThemeUI(newTheme);
  localStorage.setItem(THEME_KEY, newTheme);
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  applyThemeUI(saved);
}

function applyThemeUI(theme) {
  const isDark = theme === 'dark';
  if (themeToggleIcon)  themeToggleIcon.textContent  = isDark ? '☀️' : '🌙';
  if (themeToggleLabel) themeToggleLabel.textContent = isDark ? 'Mode Terang' : 'Mode Gelap';
  if (mobileThemeIcon)  mobileThemeIcon.textContent  = isDark ? '☀️' : '🌙';
}

// ── Custom Categories ─────────────────────────────────────
function toggleCustomCategoryPanel() {
  const isHidden = customCategoryRow.style.display === 'none';
  customCategoryRow.style.display = isHidden ? 'block' : 'none';
  if (customCatBtnLabel) {
    customCatBtnLabel.textContent = isHidden ? '✕ Tutup Panel' : '＋ Kategori Kustom';
  }
  if (isHidden) customCategoryInput.focus();
}

function handleAddCustomCategory() {
  const name  = customCategoryInput.value.trim();
  const errEl = document.getElementById('customCatError');
  errEl.textContent = '';

  if (!name) {
    errEl.textContent = 'Nama kategori wajib diisi.';
    return;
  }
  if (name.length < 2) {
    errEl.textContent = 'Harus minimal 2 karakter.';
    return;
  }

  const existing = getAllCategoryNames().map(c => c.toLowerCase());
  if (existing.includes(name.toLowerCase())) {
    errEl.textContent = 'Kategori sudah ada.';
    return;
  }

  const colorIdx = customCategories.length % EXTRA_COLORS.length;
  const newCat   = { name, color: EXTRA_COLORS[colorIdx] };
  customCategories.push(newCat);
  saveCustomCategories();

  CATEGORY_META[name] = { emoji: '📌', color: newCat.color };
  appendCategoryOption(name);

  customCategoryInput.value = '';
  errEl.textContent = '';
  categorySelect.value = name;
}

function appendCategoryOption(name) {
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = `📌 ${name}`;
  categorySelect.appendChild(opt);
}

function loadCustomCategories() {
  try { customCategories = JSON.parse(localStorage.getItem(CAT_KEY)) || []; }
  catch { customCategories = []; }
  customCategories.forEach(cat => {
    CATEGORY_META[cat.name] = { emoji: '📌', color: cat.color };
    appendCategoryOption(cat.name);
  });
}

function saveCustomCategories() {
  localStorage.setItem(CAT_KEY, JSON.stringify(customCategories));
}

function getAllCategoryNames() {
  return Object.keys(CATEGORY_META);
}

// ── Storage ───────────────────────────────────────────────
function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function loadTransactions() {
  try { transactions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { transactions = []; }
}

// ── Utilities ─────────────────────────────────────────────
function getCategoryMeta(category) {
  return CATEGORY_META[category] || { emoji: '📦', color: '#94a3b8' };
}

function formatCurrency(amount) {
  return 'RM ' + Math.abs(amount).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hexToRgba(hex, alpha) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!r) return `rgba(148,163,184,${alpha})`;
  return `rgba(${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)},${alpha})`;
}

// ── Start ─────────────────────────────────────────────────
init();

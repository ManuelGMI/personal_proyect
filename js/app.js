/* ═══════════════════════════════════════════════
   LicenseHub — Application Logic v2
   Tabs: Trabajo / Personal + Theme Customizer
   ═══════════════════════════════════════════════ */

'use strict';

// Auth handled by Firebase in dashboard.html directly

// ── Auth guard & User ID ────────────────────────
// Wait for auth state to load data
let currentUserUid = null;
if (window.lh_auth) {
    window.lh_auth.onAuthStateChanged((user) => {
        if (user) {
            currentUserUid = user.uid;
            // Load data when user is known
            updateTabCounts();
            renderTable();
            updateStats();
            loadTheme();
        } else {
            window.location.href = 'index.html';
        }
    });
} else {
    // Fallback if not loaded
    window.location.href = 'index.html';
}

// ── Tab state ────────────────────────────────────
let activeTab = sessionStorage.getItem('lh_tab') || 'work';

const TAB_CONFIG = {
    work: { label: 'Trabajo', subtitle: 'Licencias y suscripciones de trabajo', icon: '💼' },
    personal: { label: 'Personal', subtitle: 'Suscripciones y servicios personales', icon: '🏠' },
};

function switchTab(tab) {
    activeTab = tab;
    sessionStorage.setItem('lh_tab', tab);

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    // Update page header
    const cfg = TAB_CONFIG[tab];
    document.getElementById('pageTitle').textContent = `Panel — ${cfg.label}`;
    document.getElementById('pageSubtitle').textContent = cfg.subtitle;

    // Reset filters
    document.getElementById('searchInput').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterStatus').value = '';

    renderTable();
    updateStats();
}

// ── Data layer ──────────────────────────────────
function storageKey(tab) {
    const uid = currentUserUid || 'default';
    return `lh_licenses_${tab || activeTab}_${uid}`;
}

function loadLicenses(tab) {
    try {
        return JSON.parse(localStorage.getItem(storageKey(tab))) || [];
    } catch { return []; }
}

function saveLicenses(data, tab) {
    localStorage.setItem(storageKey(tab), JSON.stringify(data));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Category config ─────────────────────────────
const CAT_CONFIG = {
    'Sueldo': { icon: '💰', color: '#22c55e' },
    'Productividad': { icon: '💼', color: '#6366f1' },
    'Seguridad / Antivirus': { icon: '🛡️', color: '#10b981' },
    'Herramientas IA': { icon: '🤖', color: '#8b5cf6' },
    'Desarrollo': { icon: '💻', color: '#06b6d4' },
    'Almacenamiento Cloud': { icon: '☁️', color: '#0ea5e9' },
    'Diseño': { icon: '🎨', color: '#f59e0b' },
    'Comunicación': { icon: '💬', color: '#ec4899' },
    'Entretenimiento': { icon: '🎬', color: '#f43f5e' },
    'Telecomunicaciones': { icon: '📡', color: '#14b8a6' },
    'Gasolina': { icon: '⛽', color: '#ef4444' },
    'Gasto diario': { icon: '☕', color: '#f59e0b' },
    'Consumibles': { icon: '🛒', color: '#f97316' },
    'Otro': { icon: '📦', color: '#94a3b8' },
};

function getCatIcon(cat) {
    return (CAT_CONFIG[cat] || CAT_CONFIG['Otro']).icon;
}

const CYCLE_LABEL = { monthly: 'Mensual', annual: 'Anual', 'one-time': 'Único' };

// ── Cost helpers ─────────────────────────────────
function annualCost(l) {
    const c = parseFloat(l.cost) || 0;
    if (l.billingCycle === 'monthly') return c * 12;
    if (l.billingCycle === 'annual') return c;
    return c;
}
function monthlyCost(l) {
    const c = parseFloat(l.cost) || 0;
    if (l.billingCycle === 'monthly') return c;
    if (l.billingCycle === 'annual') return c / 12;
    return 0;
}

// ── Date helpers ─────────────────────────────────
function daysUntil(dateStr) {
    if (!dateStr) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const then = new Date(dateStr + 'T00:00:00');
    return Math.round((then - now) / 86400000);
}
function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Financial Data Management ────────────────────
function loadIncome() {
    const uid = currentUserUid || 'default';
    return parseFloat(localStorage.getItem(`lh_income_${uid}`)) || 0;
}
function saveIncome(amount) {
    const uid = currentUserUid || 'default';
    localStorage.setItem(`lh_income_${uid}`, amount);
    updateStats();
}

function loadSavingsGoal() {
    const uid = currentUserUid || 'default';
    try {
        return JSON.parse(localStorage.getItem(`lh_savings_goal_${uid}`)) || { target: 0, months: 12 };
    } catch { return { target: 0, months: 12 }; }
}
function saveSavingsGoal(target, months) {
    const uid = currentUserUid || 'default';
    localStorage.setItem(`lh_savings_goal_${uid}`, JSON.stringify({ target: parseFloat(target), months: parseInt(months) }));
    updateStats();
}

function markAsPaid(id) {
    const licenses = loadLicenses();
    const idx = licenses.findIndex(l => l.id === id);
    if (idx === -1) return;

    const l = licenses[idx];
    if (!l.nextRenewal) return;

    const currentRenewal = new Date(l.nextRenewal);
    let nextDate = new Date(currentRenewal);

    if (l.billingCycle === 'monthly') {
        nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (l.billingCycle === 'annual') {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
    } else {
        // For one-time or others, maybe no action or just 1 month
        // logic depends, but user asked to update "dias restantes"
        // assuming standard recurrence
        nextDate.setMonth(nextDate.getMonth() + 1);
    }

    l.nextRenewal = nextDate.toISOString().slice(0, 10);
    saveLicenses(licenses);
    renderTable();
    updateStats();
    showToast('Marcado como pagado. Próxima fecha actualizada.', 'success');
}

// ── Tab counts in tab bar ────────────────────────
function updateTabCounts() {
    ['work', 'personal'].forEach(tab => {
        const all = loadLicenses(tab);
        document.getElementById(`count-${tab}`).textContent = all.length;
    });
}

// ── Stats ────────────────────────────────────────
function updateStats() {
    const licenses = loadLicenses();
    const active = licenses.filter(l => l.status === 'active');

    // Group annual and monthly costs by currency
    const annualByCur = {};
    const monthlyByCur = {};
    active.forEach(l => {
        const cur = (l.currency || 'USD').toUpperCase();
        annualByCur[cur] = (annualByCur[cur] || 0) + annualCost(l);
        monthlyByCur[cur] = (monthlyByCur[cur] || 0) + monthlyCost(l);
    });

    const renewals = active.filter(l => {
        const d = daysUntil(l.nextRenewal);
        return d !== null && d >= 0 && d <= 30;
    });

    renderCurrencyLines('statAnnualLines', annualByCur);
    renderCurrencyLines('statMonthlyLines', monthlyByCur);

    renderCurrencyLines('statAnnualLines', annualByCur);
    renderCurrencyLines('statMonthlyLines', monthlyByCur);

    // Calculate total monthly expense in main currency (assuming roughly 1 USD = 20 MXN for estimation if mixed, 
    // OR just display the dominant one. For simplicity in this step, we will sum up in user's preferred currency 
    // if possible, but the prompt implies a direct comparison. 
    // Let's sum converted to a base (e.g. MXN) for the "Balance" check, or just sum same-currency if user uses one.
    // For this implementation, we'll do a simple sum assuming mostly one currency or just number addition (naive) 
    // unless we add conversion. Given the "vs" request, I'll add a simple converter estimate or just sum the primary.
    // Let's assume standardizing to MXN if mixed, or just sum. 
    // Better approach: Show "Balance" in main currency. 
    // Let's default to summing everything as if it's the same unit for the "Balance" visual 
    // OR better, handle the user's input currency.

    // We will calculate total monthly outgoings (converting annual/12)
    // and total non-daily outgoings for the projection
    let totalMonthlyOut = 0;
    let totalMonthlyProyectable = 0;

    active.forEach(l => {
        let cost = monthlyCost(l);
        // Naive conversion for the "Balance" display allowing mixed bag
        if (l.currency === 'USD') cost *= 20; // Approx rate, can be made editable later if needed

        totalMonthlyOut += cost;

        // If it's not daily, we project it. Otherwise, we just sum it for the current month but don't project.
        if (!l.isDaily) {
            totalMonthlyProyectable += cost;
        }
    });

    const income = loadIncome();
    const balance = income - totalMonthlyOut;
    // Projection = (Income * 12) - (Proyectable Monthly * 12) - (Daily Unique Costs accumulated this month, not multiplied)
    // To match user request: it drops from monthly balance but NOT multiplied by 12.
    // Daily expenses in this month:
    const dailyExpenses = totalMonthlyOut - totalMonthlyProyectable;
    const projectedYear = (income * 12) - (totalMonthlyProyectable * 12) - dailyExpenses;

    const savingsGoal = loadSavingsGoal();

    // Savings Plan Logic
    const monthlyNeeded = savingsGoal.months > 0 ? savingsGoal.target / savingsGoal.months : 0;
    const savePercent = income > 0 ? (monthlyNeeded / income) * 100 : 0;
    const canSave = balance >= monthlyNeeded;

    // Update UI for Financials
    document.getElementById('statIncome').value = income || ''; // Input field
    document.getElementById('statBalance').textContent = `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('statProjected').textContent = `$${projectedYear.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    document.getElementById('savingsTargetDisplay').textContent = `$${savingsGoal.target.toLocaleString()}`;
    document.getElementById('savingsMonthlyNeeded').textContent = `$${monthlyNeeded.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mes`;
    document.getElementById('savingsPercent').textContent = `${savePercent.toFixed(1)}% de ingreso`;

    const saveStatusEl = document.getElementById('savingsStatus');
    if (saveStatusEl) {
        if (canSave) {
            saveStatusEl.innerHTML = `<span style="color:var(--green)">✅ Meta alcanzable</span> (Te sobran $${(balance - monthlyNeeded).toFixed(0)})`;
        } else {
            saveStatusEl.innerHTML = `<span style="color:var(--red)">⚠️ Déficit</span> (Faltan $${(monthlyNeeded - balance).toFixed(0)})`;
        }
    }

    // Recommendations (cut non-essentials if deficit)
    const recEl = document.getElementById('savingsRecommendations');
    if (recEl) {
        if (!canSave || savePercent > 20) {
            const cutCandidates = active.filter(l => ['Entretenimiento', 'Otro', 'Consumibles'].includes(l.category));
            if (cutCandidates.length > 0) {
                recEl.innerHTML = '<b>Sugerencia:</b> Podrías reducir: ' + cutCandidates.map(c => c.name).slice(0, 3).join(', ');
            } else {
                recEl.innerHTML = 'Revisa tus gastos fijos.';
            }
        } else {
            recEl.innerHTML = 'Tu plan de ahorro se ve saludable.';
        }
    }

    const activeEl = document.getElementById('statActive');
    if (activeEl) activeEl.textContent = active.length;

    const breakEl = document.getElementById('statActiveBreak');
    if (breakEl) breakEl.textContent = `de ${licenses.length} registros`;

    const renewalsEl = document.getElementById('statRenewals');
    if (renewalsEl) renewalsEl.textContent = renewals.length;

    const banner = document.getElementById('renewalBanner');
    if (banner) {
        if (renewals.length > 0) {
            const names = renewals.slice(0, 3).map(l => l.name).join(', ');
            const bannerText = document.getElementById('renewalBannerText');
            if (bannerText) {
                bannerText.innerHTML = `<strong>${renewals.length} licencia(s)</strong> vencen en los próximos 30 días: ${names}${renewals.length > 3 ? ' y más...' : ''}`;
            }
            banner.classList.add('show');
        } else {
            banner.classList.remove('show');
        }
    }

    updateBreakdown(active);
    updateTabCounts();
}

function renderCurrencyLines(containerId, byCur) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const entries = Object.entries(byCur).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
        el.innerHTML = `<div class="stat-currency-line"><span class="s-amount">$0.00</span></div>`;
        return;
    }
    const smaller = entries.length > 1 ? ' smaller' : '';
    el.innerHTML = entries.map(([cur, amount]) => `
        <div class="stat-currency-line">
            <span class="s-amount${smaller}">$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span class="s-cur">${cur}</span>
        </div>`).join('');
}


// ── Category breakdown ───────────────────────────
function updateBreakdown(active) {
    const grid = document.getElementById('breakdownGrid');
    const map = {};
    active.forEach(l => {
        const cat = l.category || 'Otro';
        if (!map[cat]) map[cat] = { cost: 0, count: 0 };
        map[cat].cost += annualCost(l);
        map[cat].count += 1;
    });

    const entries = Object.entries(map).sort((a, b) => b[1].cost - a[1].cost);
    if (entries.length === 0) {
        grid.innerHTML = '<div style="color:var(--text-muted);font-size:14px;padding:12px;">Sin datos aún.</div>';
        return;
    }
    grid.innerHTML = entries.map(([cat, data]) => `
    <div class="breakdown-card">
      <div class="breakdown-icon">${getCatIcon(cat)}</div>
      <div class="breakdown-info">
        <div class="b-name">${cat}</div>
        <div class="b-cost">$${data.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div class="b-count">${data.count} licencia${data.count !== 1 ? 's' : ''} · anual</div>
      </div>
    </div>
  `).join('');
}

// ── Table rendering ──────────────────────────────
function renderTable() {
    const licenses = loadLicenses();
    const search = document.getElementById('searchInput').value.toLowerCase();
    const catF = document.getElementById('filterCategory').value;
    const statusF = document.getElementById('filterStatus').value;

    const filtered = licenses.filter(l => {
        const matchSearch = !search ||
            l.name.toLowerCase().includes(search) ||
            (l.vendor || '').toLowerCase().includes(search) ||
            (l.category || '').toLowerCase().includes(search);
        const matchCat = !catF || l.category === catF;
        const matchStatus = !statusF || l.status === statusF;
        return matchSearch && matchCat && matchStatus;
    });

    document.getElementById('tableCount').textContent = `${filtered.length} registro${filtered.length !== 1 ? 's' : ''}`;

    const container = document.getElementById('tableContainer');
    if (filtered.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${licenses.length === 0 ? '📋' : '🔍'}</div>
        <div class="empty-title">${licenses.length === 0 ? 'Sin registros aún' : 'Sin resultados'}</div>
        <div class="empty-sub">${licenses.length === 0 ? 'Haz clic en "Nueva Licencia" para agregar tu primera suscripción' : 'Intenta con otros filtros o términos de búsqueda'}</div>
      </div>`;
        return;
    }

    const rows = filtered.map(l => {
        const days = daysUntil(l.nextRenewal);
        let renewClass = '', renewLabel = formatDate(l.nextRenewal);
        if (days !== null && l.status === 'active') {
            if (days < 0) { renewClass = 'overdue'; renewLabel = `Vencido hace ${Math.abs(days)}d`; }
            else if (days <= 7) { renewClass = 'soon'; renewLabel = `⚡ ${days === 0 ? 'Hoy' : `En ${days}d`}`; }
            else if (days <= 30) { renewClass = 'soon'; renewLabel = `⏰ En ${days}d`; }
        }

        const statusBadge = {
            active: '<span class="badge badge-active">● Activo</span>',
            expired: '<span class="badge badge-expired">● Vencido</span>',
            cancelled: '<span class="badge badge-cancelled">● Cancelado</span>',
        }[l.status] || '';

        const costStr = `$${parseFloat(l.cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span class="cycle">${l.currency || 'USD'} / ${CYCLE_LABEL[l.billingCycle] || l.billingCycle}</span>`;

        return `
      <tr>
        <td>
          <div class="td-name">${escHtml(l.name)}</div>
          <div class="td-vendor">${escHtml(l.vendor || '—')}</div>
        </td>
        <td><span class="cat-chip">${getCatIcon(l.category)} ${escHtml(l.category || 'Otro')}</span></td>
        <td class="td-cost">${costStr}</td>
        <td>${statusBadge}</td>
        <td class="td-renewal ${renewClass}">${renewLabel}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-check btn-sm" onclick="markAsPaid('${l.id}')" title="Marcar como pagado">✅</button>
            <button class="btn btn-ghost btn-sm" onclick="openModal('${l.id}')" title="Editar">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="askDelete('${l.id}')" title="Eliminar">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Software</th>
          <th>Categoría</th>
          <th>Costo</th>
          <th>Estado</th>
          <th>Próx. Renovación</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Modal ────────────────────────────────────────
let editingId = null;

function openModal(id = null) {
    editingId = id;
    const title = document.getElementById('modalTitle');
    const licenses = loadLicenses();

    // Clear the form completely
    document.getElementById('fName').value = '';
    document.getElementById('fVendor').value = '';
    document.getElementById('fCategory').value = '';
    document.getElementById('fCost').value = '';
    document.getElementById('fCurrency').value = 'USD';
    document.getElementById('fCycle').value = 'monthly';
    document.getElementById('fPurchaseDate').value = '';
    document.getElementById('fRenewal').value = '';
    document.getElementById('fPayment').value = '';
    document.getElementById('fStatus').value = 'active';
    document.getElementById('fNotes').value = '';
    document.getElementById('fIsDaily').checked = false;

    if (id) {
        title.textContent = 'Editar Registro';
        const l = licenses.find(x => x.id === id);
        if (l) {
            document.getElementById('fName').value = l.name || '';
            document.getElementById('fVendor').value = l.vendor || '';
            document.getElementById('fCategory').value = l.category || '';
            document.getElementById('fCost').value = l.cost || '';
            document.getElementById('fCurrency').value = l.currency || 'USD';
            document.getElementById('fCycle').value = l.billingCycle || 'monthly';
            document.getElementById('fPurchaseDate').value = l.purchaseDate || '';
            document.getElementById('fRenewal').value = l.nextRenewal || '';
            document.getElementById('fPayment').value = l.paymentMethod || '';
            document.getElementById('fStatus').value = l.status || 'active';
            document.getElementById('fNotes').value = l.notes || '';
            document.getElementById('fIsDaily').checked = !!l.isDaily;
        }
    } else {
        title.textContent = 'Nuevo Registro / Gasto';
        // Auto-select today
        document.getElementById('fPurchaseDate').value = new Date().toISOString().slice(0, 10);
    }
    document.getElementById('modalOverlay').classList.add('open');
    setTimeout(() => document.getElementById('fName').focus(), 100);
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    editingId = null;
}

function saveLicense() {
    const name = document.getElementById('fName').value.trim();
    const category = document.getElementById('fCategory').value;
    const cost = document.getElementById('fCost').value;

    if (!name) { showToast('El nombre es obligatorio', 'error'); return; }
    if (!category) { showToast('Selecciona una categoría', 'error'); return; }
    if (!cost || isNaN(parseFloat(cost))) { showToast('Ingresa un costo válido', 'error'); return; }

    const licenses = loadLicenses();
    const record = {
        id: editingId || generateId(),
        name,
        vendor: document.getElementById('fVendor').value.trim(),
        category,
        cost: parseFloat(cost),
        currency: document.getElementById('fCurrency').value,
        billingCycle: document.getElementById('fCycle').value,
        purchaseDate: document.getElementById('fPurchaseDate').value,
        nextRenewal: document.getElementById('fRenewal').value,
        paymentMethod: document.getElementById('fPayment').value.trim(),
        status: document.getElementById('fStatus').value,
        notes: document.getElementById('fNotes').value.trim(),
        isDaily: document.getElementById('fIsDaily').checked,
    };

    if (editingId) {
        const idx = licenses.findIndex(l => l.id === editingId);
        if (idx !== -1) licenses[idx] = record;
        showToast('Licencia actualizada correctamente', 'success');
    } else {
        licenses.push(record);
        showToast('Licencia agregada correctamente', 'success');
    }

    saveLicenses(licenses);
    closeModal();
    renderTable();
    updateStats();
}

// ── Delete ───────────────────────────────────────
let deleteTargetId = null;

function askDelete(id) {
    deleteTargetId = id;
    document.getElementById('confirmDialog').classList.add('open');
}
function closeConfirm() {
    document.getElementById('confirmDialog').classList.remove('open');
    deleteTargetId = null;
}
function confirmDelete() {
    if (!deleteTargetId) return;
    saveLicenses(loadLicenses().filter(l => l.id !== deleteTargetId));
    closeConfirm();
    renderTable();
    updateStats();
    showToast('Licencia eliminada', 'info');
}

// ── Toast ────────────────────────────────────────
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ── Event listeners ──────────────────────────────
document.getElementById('modalOverlay').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
document.getElementById('confirmDialog').addEventListener('click', function (e) { if (e.target === this) closeConfirm(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeConfirm(); closeThemePanel(); } });

// ═══════════════════════════════════════════════
//  THEME ENGINE
// ═══════════════════════════════════════════════

const THEME_KEY = 'lh_theme';

const DEFAULT_THEME = {
    accentColors: ['#6366f1', '#8b5cf6'],
    accentAngle: 135,
    bgColors: ['#6366f1', '#8b5cf6', '#06b6d4'],
    bgAngle: 135,
};

const PRESETS = [
    { label: 'Índigo', accentColors: ['#6366f1', '#8b5cf6'], bgColors: ['#6366f1', '#8b5cf6', '#06b6d4'], accentAngle: 135, bgAngle: 135 },
    { label: 'Aurora', accentColors: ['#06b6d4', '#6366f1'], bgColors: ['#06b6d4', '#6366f1', '#8b5cf6'], accentAngle: 135, bgAngle: 120 },
    { label: 'Sunset', accentColors: ['#f59e0b', '#ef4444'], bgColors: ['#f59e0b', '#ef4444', '#8b5cf6'], accentAngle: 135, bgAngle: 150 },
    { label: 'Esmeralda', accentColors: ['#10b981', '#06b6d4'], bgColors: ['#10b981', '#06b6d4', '#6366f1'], accentAngle: 135, bgAngle: 120 },
    { label: 'Rosa', accentColors: ['#ec4899', '#8b5cf6'], bgColors: ['#ec4899', '#8b5cf6', '#6366f1'], accentAngle: 135, bgAngle: 135 },
    { label: 'Fuego', accentColors: ['#ef4444', '#f59e0b'], bgColors: ['#ef4444', '#f59e0b', '#8b5cf6'], accentAngle: 135, bgAngle: 160 },
    { label: 'Océano', accentColors: ['#0ea5e9', '#06b6d4'], bgColors: ['#0ea5e9', '#06b6d4', '#6366f1'], accentAngle: 135, bgAngle: 120 },
    { label: 'Noche', accentColors: ['#475569', '#334155'], bgColors: ['#475569', '#334155', '#1e293b'], accentAngle: 135, bgAngle: 135 },
];

let themeState = { ...DEFAULT_THEME };

// ── Load saved theme ─────────────────────────────
function loadTheme() {
    try {
        const saved = JSON.parse(localStorage.getItem(THEME_KEY));
        if (saved) themeState = { ...DEFAULT_THEME, ...saved };
    } catch { }
    applyThemeToDOM(themeState);
}

// ── Apply theme to DOM ────────────────────────────
function applyThemeToDOM(t) {
    const accentGrad = buildGradient(t.accentColors, t.accentAngle);
    const accentMain = t.accentColors[0];
    const accentLight = lightenHex(t.accentColors[0], 40);
    const accentGlow = hexToRgba(t.accentColors[0], 0.25);

    // Mesh background from bgColors
    const meshGrad = buildMesh(t.bgColors);

    const root = document.documentElement;
    root.style.setProperty('--accent', accentMain);
    root.style.setProperty('--accent-light', accentLight);
    root.style.setProperty('--accent-glow', accentGlow);
    root.style.setProperty('--accent-gradient', accentGrad);
    root.style.setProperty('--mesh-bg', meshGrad);
}

function buildGradient(colors, angle) {
    if (colors.length === 1) return `linear-gradient(${angle}deg, ${colors[0]}, ${colors[0]})`;
    return `linear-gradient(${angle}deg, ${colors.join(', ')})`;
}

function buildMesh(colors) {
    // Create radial orbs from the bg colors
    const positions = [
        { x: '20%', y: '10%', w: '80%', h: '50%' },
        { x: '80%', y: '80%', w: '60%', h: '40%' },
        { x: '60%', y: '30%', w: '50%', h: '60%' },
        { x: '10%', y: '70%', w: '40%', h: '50%' },
    ];
    const parts = colors.map((c, i) => {
        const p = positions[i % positions.length];
        const rgba = hexToRgba(c, 0.12);
        return `radial-gradient(ellipse ${p.w} ${p.h} at ${p.x} ${p.y}, ${rgba} 0%, transparent 60%)`;
    });
    return parts.join(', ');
}

// ── Color utilities ──────────────────────────────
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

function lightenHex(hex, amount) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, r + amount);
    g = Math.min(255, g + amount);
    b = Math.min(255, b + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ── Theme panel UI ────────────────────────────────
function openThemePanel() {
    syncPanelUI();
    document.getElementById('themePanel').classList.add('open');
    document.getElementById('panelBackdrop').classList.add('open');
}
function closeThemePanel() {
    document.getElementById('themePanel').classList.remove('open');
    document.getElementById('panelBackdrop').classList.remove('open');
}

function syncPanelUI() {
    renderColorRows('accentColorRows', themeState.accentColors, 'accent');
    renderColorRows('bgColorRows', themeState.bgColors, 'bg');

    document.getElementById('accentAngle').value = themeState.accentAngle;
    document.getElementById('bgAngle').value = themeState.bgAngle;
    document.getElementById('accentAngleVal').textContent = `${themeState.accentAngle}°`;
    document.getElementById('bgAngleVal').textContent = `${themeState.bgAngle}°`;

    // Sync dark/light mode buttons
    document.getElementById('btnDark').classList.toggle('active', colorMode === 'dark');
    document.getElementById('btnLight').classList.toggle('active', colorMode === 'light');

    updateAccentPreview();
    updateBgPreview();
    renderPresets();
}

function renderColorRows(containerId, colors, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = colors.map((c, i) => `
    <div class="color-row" id="${type}-row-${i}">
      <label>Color ${i + 1}</label>
      <input type="color" value="${c}" oninput="onColorChange('${type}', ${i}, this.value)" />
      ${colors.length > 1 ? `<button class="color-remove" onclick="removeColor('${type}', ${i})" title="Eliminar">×</button>` : ''}
    </div>
  `).join('');
}

function onColorChange(type, index, value) {
    if (type === 'accent') {
        themeState.accentColors[index] = value;
        updateAccentPreview();
    } else {
        themeState.bgColors[index] = value;
        updateBgPreview();
    }
}

function addAccentColor() {
    if (themeState.accentColors.length >= 5) { showToast('Máximo 5 colores', 'info'); return; }
    themeState.accentColors.push('#a78bfa');
    renderColorRows('accentColorRows', themeState.accentColors, 'accent');
    updateAccentPreview();
}

function addBgColor() {
    if (themeState.bgColors.length >= 5) { showToast('Máximo 5 colores', 'info'); return; }
    themeState.bgColors.push('#06b6d4');
    renderColorRows('bgColorRows', themeState.bgColors, 'bg');
    updateBgPreview();
}

function removeColor(type, index) {
    if (type === 'accent') {
        if (themeState.accentColors.length <= 1) return;
        themeState.accentColors.splice(index, 1);
        renderColorRows('accentColorRows', themeState.accentColors, 'accent');
        updateAccentPreview();
    } else {
        if (themeState.bgColors.length <= 1) return;
        themeState.bgColors.splice(index, 1);
        renderColorRows('bgColorRows', themeState.bgColors, 'bg');
        updateBgPreview();
    }
}

function updateAccentPreview() {
    const angle = parseInt(document.getElementById('accentAngle').value);
    themeState.accentAngle = angle;
    document.getElementById('accentAngleVal').textContent = `${angle}°`;
    document.getElementById('accentPreview').style.background = buildGradient(themeState.accentColors, angle);
}

function updateBgPreview() {
    const angle = parseInt(document.getElementById('bgAngle').value);
    themeState.bgAngle = angle;
    document.getElementById('bgAngleVal').textContent = `${angle}°`;
    // Show a simple linear gradient as preview for bg
    document.getElementById('bgPreview').style.background = buildGradient(themeState.bgColors, angle);
}

function applyTheme() {
    localStorage.setItem(THEME_KEY, JSON.stringify(themeState));
    applyThemeToDOM(themeState);
    showToast('Tema aplicado correctamente', 'success');
    closeThemePanel();
}

function resetTheme() {
    themeState = { ...DEFAULT_THEME };
    localStorage.removeItem(THEME_KEY);
    applyThemeToDOM(themeState);
    syncPanelUI();
    showToast('Tema restaurado', 'info');
}

// ── Presets ──────────────────────────────────────
function renderPresets() {
    const grid = document.getElementById('presetGrid');
    grid.innerHTML = PRESETS.map((p, i) => {
        const grad = buildGradient(p.accentColors, p.accentAngle);
        return `<div class="preset-swatch" title="${p.label}" style="background:${grad}" onclick="applyPreset(${i})"></div>`;
    }).join('');
}

function applyPreset(index) {
    const p = PRESETS[index];
    themeState = { ...p };
    syncPanelUI();
    // Highlight selected
    document.querySelectorAll('.preset-swatch').forEach((el, i) => {
        el.classList.toggle('selected', i === index);
    });
}

// ── Seed demo data ────────────────────────────────
function seedDemoData() {
    // Work tab demo
    if (loadLicenses('work').length === 0) {
        const today = new Date();
        const add = d => { const dt = new Date(today); dt.setDate(dt.getDate() + d); return dt.toISOString().slice(0, 10); };
        const sub = d => { const dt = new Date(today); dt.setDate(dt.getDate() - d); return dt.toISOString().slice(0, 10); };

        saveLicenses([
            { id: generateId(), name: 'Microsoft 365', vendor: 'Microsoft', category: 'Productividad', cost: 99.99, currency: 'USD', billingCycle: 'annual', purchaseDate: sub(180), nextRenewal: add(185), paymentMethod: 'Tarjeta de crédito', status: 'active', notes: '5 usuarios incluidos' },
            { id: generateId(), name: 'ChatGPT Plus', vendor: 'OpenAI', category: 'Herramientas IA', cost: 20, currency: 'USD', billingCycle: 'monthly', purchaseDate: sub(60), nextRenewal: add(15), paymentMethod: 'PayPal', status: 'active', notes: 'Acceso a GPT-4o' },
            { id: generateId(), name: 'ESET NOD32', vendor: 'ESET', category: 'Seguridad / Antivirus', cost: 39.99, currency: 'USD', billingCycle: 'annual', purchaseDate: sub(300), nextRenewal: add(65), paymentMethod: 'Tarjeta de crédito', status: 'active', notes: '3 dispositivos' },
            { id: generateId(), name: 'GitHub Copilot', vendor: 'GitHub', category: 'Desarrollo', cost: 10, currency: 'USD', billingCycle: 'monthly', purchaseDate: sub(90), nextRenewal: add(5), paymentMethod: 'Tarjeta de débito', status: 'active', notes: 'Individual plan' },
            { id: generateId(), name: 'Adobe Creative Cloud', vendor: 'Adobe', category: 'Diseño', cost: 599.88, currency: 'USD', billingCycle: 'annual', purchaseDate: sub(400), nextRenewal: add(-30), paymentMethod: 'Tarjeta de crédito', status: 'expired', notes: 'Todos los apps' },
            { id: generateId(), name: 'Slack Pro', vendor: 'Slack', category: 'Comunicación', cost: 7.25, currency: 'USD', billingCycle: 'monthly', purchaseDate: sub(120), nextRenewal: add(10), paymentMethod: 'Tarjeta de crédito', status: 'active', notes: 'Equipo de 5 personas' },
        ], 'work');
    }

    // Personal tab demo
    if (loadLicenses('personal').length === 0) {
        const today = new Date();
        const add = d => { const dt = new Date(today); dt.setDate(dt.getDate() + d); return dt.toISOString().slice(0, 10); };
        const sub = d => { const dt = new Date(today); dt.setDate(dt.getDate() - d); return dt.toISOString().slice(0, 10); };

        saveLicenses([
            { id: generateId(), name: 'Netflix', vendor: 'Netflix', category: 'Entretenimiento', cost: 15.99, currency: 'USD', billingCycle: 'monthly', purchaseDate: sub(200), nextRenewal: add(12), paymentMethod: 'Tarjeta de crédito', status: 'active', notes: 'Plan estándar HD' },
            { id: generateId(), name: 'Roku Channel+', vendor: 'Roku', category: 'Entretenimiento', cost: 4.99, currency: 'USD', billingCycle: 'monthly', purchaseDate: sub(90), nextRenewal: add(8), paymentMethod: 'PayPal', status: 'active', notes: '' },
            { id: generateId(), name: 'Spotify Premium', vendor: 'Spotify', category: 'Entretenimiento', cost: 9.99, currency: 'USD', billingCycle: 'monthly', purchaseDate: sub(365), nextRenewal: add(20), paymentMethod: 'Tarjeta de débito', status: 'active', notes: 'Plan individual' },
            { id: generateId(), name: 'Plan Celular', vendor: 'Telcel', category: 'Telecomunicaciones', cost: 299, currency: 'MXN', billingCycle: 'monthly', purchaseDate: sub(180), nextRenewal: add(7), paymentMethod: 'Domiciliación', status: 'active', notes: '20GB datos + llamadas ilimitadas' },
            { id: generateId(), name: 'Internet Hogar', vendor: 'Telmex', category: 'Telecomunicaciones', cost: 499, currency: 'MXN', billingCycle: 'monthly', purchaseDate: sub(730), nextRenewal: add(18), paymentMethod: 'Domiciliación', status: 'active', notes: '200 Mbps fibra óptica' },
            { id: generateId(), name: 'Google One 2TB', vendor: 'Google', category: 'Almacenamiento Cloud', cost: 2.99, currency: 'USD', billingCycle: 'monthly', purchaseDate: sub(200), nextRenewal: add(25), paymentMethod: 'Google Pay', status: 'active', notes: 'Almacenamiento compartido familia' },
            { id: generateId(), name: 'Notion Plus', vendor: 'Notion', category: 'Productividad', cost: 8, currency: 'USD', billingCycle: 'monthly', purchaseDate: sub(50), nextRenewal: add(22), paymentMethod: 'PayPal', status: 'active', notes: 'Plan personal' },
        ], 'personal');
    }
}

// ═══════════════════════════════════════════════
//  COLOR MODE (DARK / LIGHT)
// ═══════════════════════════════════════════════

const MODE_KEY = 'lh_color_mode';
let colorMode = localStorage.getItem(MODE_KEY) || 'dark';

function setColorMode(mode) {
    colorMode = mode;
    localStorage.setItem(MODE_KEY, mode);
    applyColorMode(mode);
    // Update toggle buttons
    document.getElementById('btnDark').classList.toggle('active', mode === 'dark');
    document.getElementById('btnLight').classList.toggle('active', mode === 'light');
}

function applyColorMode(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    // Also update navbar bg for light mode (it uses a CSS var now)
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        navbar.style.background = mode === 'light'
            ? 'rgba(240,244,255,0.9)'
            : 'rgba(8,12,20,0.8)';
    }
}

function loadColorMode() {
    applyColorMode(colorMode);
}

// ── Savings Modal ────────────────────────────────
function openSavingsModal() {
    const goal = loadSavingsGoal();
    document.getElementById('saveTarget').value = goal.target || '';
    document.getElementById('saveMonths').value = goal.months || '';
    document.getElementById('savingsModalOverlay').classList.add('open');
    setTimeout(() => document.getElementById('saveTarget').focus(), 100);
}

function closeSavingsModal() {
    document.getElementById('savingsModalOverlay').classList.remove('open');
}

function saveSavingsConfig() {
    const target = document.getElementById('saveTarget').value;
    const months = document.getElementById('saveMonths').value;

    if (!target || isNaN(parseFloat(target))) { showToast('Ingresa una meta válida', 'error'); return; }
    if (!months || isNaN(parseInt(months))) { showToast('Ingresa un plazo válido', 'error'); return; }

    saveSavingsGoal(target, months);
    closeSavingsModal();
    showToast('Plan de ahorro actualizado', 'success');
}

document.getElementById('savingsModalOverlay').addEventListener('click', function (e) { if (e.target === this) closeSavingsModal(); });

// ── Init ─────────────────────────────────────────
loadColorMode();
loadTheme();
seedDemoData();
switchTab(activeTab);

let cart = [];
let inventory = [];
let categories = [];
let activeCategory = 'All';
let searchTerm = '';
let editingItemId = null;
let shopSettings = { shop_name: 'FreshMarket POS', gst_mode: 'none', gst_rate: 0, sales_tax_enabled: false, sales_tax_rate: 0, sales_tax_name: 'Sales Tax' };

// ─── License System ───────────────────────────────────────────────────────────

const LicenseStatus = {
    UNLICENSED:  'unlicensed',
    ACTIVE:      'active',
    EXPIRED:     'expired',
    TAMPERED:    'tampered',
    INVALID_KEY: 'invalid_key',
};

let _licenseStatus = null;

async function checkLicense() {
    try {
        const res = await fetch('/api/license/status');
        const data = await res.json();
        _licenseStatus = data;
        return data;
    } catch (e) {
        return { status: LicenseStatus.UNLICENSED, message: 'Could not reach license server.', secret_code: '' };
    }
}

function showLicenseWall(statusData) {
    const wall      = document.getElementById('licenseWall');
    const title     = document.getElementById('licWallTitle');
    const subtitle  = document.getElementById('licWallSubtitle');
    const secretVal = document.getElementById('licSecretValue');
    const keyLabel  = document.getElementById('licKeyLabel');
    const activateBtn = document.getElementById('licActivateBtn');
    const statusInfo  = document.getElementById('licStatusInfo');
    const errEl       = document.getElementById('licError');

    wall.classList.remove('hidden');
    secretVal.textContent = statusData.secret_code || '----';
    errEl.classList.add('hidden');
    errEl.textContent = '';
    statusInfo.classList.add('hidden');
    statusInfo.className = 'license-status-info hidden';

    if (statusData.status === LicenseStatus.UNLICENSED) {
        title.textContent   = 'Activate FreshMarket POS';
        subtitle.textContent = 'Enter your activation key to start using the software.';
        keyLabel.textContent = 'Activation Key';
        activateBtn.textContent = '✔  Activate';
    } else if (statusData.status === LicenseStatus.EXPIRED) {
        title.textContent    = 'License Expired';
        subtitle.textContent = statusData.message;
        keyLabel.textContent = 'Renewal Key';
        activateBtn.textContent = '🔄  Renew License';
        statusInfo.classList.remove('hidden');
        statusInfo.textContent = statusData.message;
    } else if (statusData.status === LicenseStatus.TAMPERED) {
        title.textContent    = 'License Suspended';
        subtitle.textContent = 'Clock tampering detected.';
        keyLabel.textContent = 'Renewal Key';
        activateBtn.textContent = '🔄  Restore License';
        statusInfo.classList.remove('hidden');
        statusInfo.classList.add('license-tamper-info');
        statusInfo.textContent = statusData.message;
    }
}

function hideLicenseWall() {
    document.getElementById('licenseWall').classList.add('hidden');
}

function showExpiryBanner(daysLeft) {
    if (daysLeft > 14) return;
    const existing = document.getElementById('licExpiryBanner');
    if (existing) return;
    const banner = document.createElement('div');
    banner.id = 'licExpiryBanner';
    banner.className = 'license-warning-banner';
    banner.textContent = daysLeft <= 0
        ? '⚠  License expired — enter a renewal key in Settings.'
        : `⚠  License expires in ${daysLeft} day(s). Contact your vendor for a renewal key.`;
    document.querySelector('.app-container').prepend(banner);
}

async function handleActivate() {
    const keyInput = document.getElementById('licKeyInput');
    const errEl    = document.getElementById('licError');
    const btn      = document.getElementById('licActivateBtn');
    const key      = keyInput.value.trim();

    if (!key) {
        errEl.textContent = 'Please enter a key.';
        errEl.classList.remove('hidden');
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳  Verifying…';
    errEl.classList.add('hidden');

    try {
        const res  = await fetch('/api/license/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key }),
        });
        const data = await res.json();

        if (data.ok) {
            btn.textContent = '✔  Success!';
            keyInput.value  = '';
            // Brief pause so user sees success, then reload
            setTimeout(() => { location.reload(); }, 1200);
        } else {
            errEl.textContent = data.message || 'Activation failed.';
            errEl.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = '✔  Activate';
        }
    } catch (e) {
        errEl.textContent = 'Network error. Is the server running?';
        errEl.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = '✔  Activate';
    }
}

function initLicenseUI() {
    // Activate button
    document.getElementById('licActivateBtn').addEventListener('click', handleActivate);

    // Copy button
    document.getElementById('licCopyBtn').addEventListener('click', () => {
        const code = document.getElementById('licSecretValue').textContent;
        navigator.clipboard.writeText(code).then(() => {
            const btn = document.getElementById('licCopyBtn');
            btn.textContent = '✔ Copied!';
            btn.classList.add('copied');
            setTimeout(() => { btn.textContent = '⎘ Copy'; btn.classList.remove('copied'); }, 2000);
        });
    });

    // Exit button on license wall
    document.getElementById('licExitBtn').addEventListener('click', async () => {
        try { await fetch('/api/exit', { method: 'POST' }); } catch (_) {}
        window.close();
    });

    // Allow Enter key in input
    document.getElementById('licKeyInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') handleActivate();
    });

    // Auto-format key input (insert dashes every 5 chars)
    document.getElementById('licKeyInput').addEventListener('input', e => {
        let raw = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        let formatted = raw.match(/.{1,5}/g)?.join('-') ?? raw;
        // Limit to 8 groups of 5 = 40 chars + 7 dashes
        const parts = formatted.split('-').slice(0, 8);
        e.target.value = parts.join('-');
    });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            document.getElementById(tab).classList.add('active');
            if (tab === 'history') loadSalesHistory();
            if (tab === 'settings') loadSettingsForm();
    if (tab === 'barcodes') {
        bcSelected.clear(); bcSearchTerm = ''; bcActiveCategory = 'All';
        updateBcPrintBtn();
        renderBarcodesTab();
        const si = document.getElementById('bcSearchInput');
        if (si) si.value = '';
    }
        });
    });

    // Cart discount input — recalculate on change
    document.getElementById('cartDiscountInput').addEventListener('input', updateCartUI);
    document.getElementById('cartDiscountInput').addEventListener('change', updateCartUI);

    // Cart
    document.getElementById('btnClear').addEventListener('click', clearCart);
    document.getElementById('btnCheckout').addEventListener('click', openReceiptPreview);

    // Search
    document.getElementById('searchInput').addEventListener('input', e => {
        searchTerm = e.target.value.toLowerCase();
        renderProductsGrid();
    });

    document.getElementById('searchInput').addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        const code = e.target.value.trim();
        if (!code) return;
        const product = inventory.find(i => i.barcode && i.barcode === code);
        if (product) {
            if (product.stock !== 999 && product.stock <= 0) {
                alert(`"${product.name}" is out of stock.`);
            } else {
                addToCart(product);
            }
            e.target.value = '';
            searchTerm = '';
            renderProductsGrid();
        }
    });

    // Inventory form
    document.getElementById('addInventoryForm').addEventListener('submit', handleInventorySubmit);
    document.getElementById('invCancelBtn').addEventListener('click', resetInventoryForm);
    initUnitTypeToggle();
    initWeightModal();

    // Category management
    document.getElementById('btnAddCategory').addEventListener('click', addCategory);

    // Bluetooth
    document.getElementById('btnBluetoothPicker').addEventListener('click', openBluetoothReceive);
    document.getElementById('btnInboxPicker').addEventListener('click', openInboxModal);
    document.getElementById('closeBluetoothModalBtn').addEventListener('click', () =>
        document.getElementById('bluetoothModal').classList.add('hidden'));

    // Browse image
    const filePicker = document.getElementById('fileImagePicker');
    document.getElementById('btnBrowseImage').addEventListener('click', () => filePicker.click());
    filePicker.addEventListener('change', handleBrowseImageSelected);

    // Receipt modal buttons
    document.getElementById('cancelReceiptBtn').addEventListener('click', closeReceiptModal);
    document.getElementById('printReceiptBtn').addEventListener('click', confirmAndPrint);

    // MISC quick entry
    document.getElementById('miscToggle').addEventListener('click', () => {
        const form = document.getElementById('miscForm');
        const chevron = document.getElementById('miscChevron');
        form.classList.toggle('hidden');
        chevron.textContent = form.classList.contains('hidden') ? '▶' : '▼';
    });
    document.getElementById('btnAddMisc').addEventListener('click', addMiscItem);

    // History refresh
    document.getElementById('btnRefreshHistory').addEventListener('click', loadSalesHistory);

    // Barcode modal
    document.getElementById('closeBarcodeModal').addEventListener('click', closeBarcodeModal);
    document.getElementById('btnCloseBarcode').addEventListener('click', closeBarcodeModal);
    document.getElementById('barcodeModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeBarcodeModal(); });
    document.getElementById('btnPrintBarcode').addEventListener('click', async () => {
        const btn = document.getElementById('btnPrintBarcode');
        // Get current item from modal title — find by barcode svg value
        const svg = document.getElementById('barcodeSvg');
        const barcodeVal = svg && svg.querySelector('text') ? svg.querySelector('text').textContent : null;
        // Fallback: read from the displayed barcode text element inside svg
        const name  = document.getElementById('barcodeProductName').textContent;
        const priceText = document.getElementById('barcodeProductPrice').textContent.replace('₹','');
        const price = parseFloat(priceText) || 0;
        // Get barcode value from the item in inventory matching the name
        const item = inventory.find(i => i.name === name && i.barcode);
        if (!item) { alert('No barcode to print.'); return; }
        btn.disabled = true;
        btn.textContent = '⏳ Printing...';
        try {
            const res = await fetch('/api/print-barcodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: [{ barcode: item.barcode, name: item.name, price: item.price }] })
            });
            const data = await res.json();
            btn.textContent = data.status === 'ok' ? '✅ Printed!' : '⚠️ Failed';
        } catch(e) {
            btn.textContent = '⚠️ Failed';
        }
        setTimeout(() => { btn.disabled = false; btn.innerHTML = '🖨️ Print'; }, 2000);
    });

    // Barcodes tab
    document.getElementById('bcSelectAll').addEventListener('change', e => {
        const checked = e.target.checked;
        document.querySelectorAll('.bc-checkbox:not(:disabled)').forEach(cb => {
            cb.checked = checked;
            const id = parseInt(cb.dataset.id);
            checked ? bcSelected.add(id) : bcSelected.delete(id);
        });
        updateBcPrintBtn();
    });
    document.getElementById('btnPrintSelected').addEventListener('click', bcPrintSelected);
    document.getElementById('bcSearchInput').addEventListener('input', e => {
        bcSearchTerm = e.target.value;
        renderBcItems();
    });

    // Settings form
    document.getElementById('settingsForm').addEventListener('submit', saveSettings);
    document.getElementById('gstMode').addEventListener('change', updateGstRateVisibility);
    document.getElementById('salesTaxEnabled').addEventListener('change', updateSalesTaxVisibility);

    // Font size slider — live update
    const fontRange = document.getElementById('fontSizeRange');
    fontRange.addEventListener('input', () => {
        applyFontSize(parseInt(fontRange.value));
    });

    // ── License gate: check before loading any data ────────────────────────
    initLicenseUI();

    checkLicense().then(status => {
        if (status.status === LicenseStatus.ACTIVE) {
            hideLicenseWall();
            showExpiryBanner(status.days_left);
            // Normal startup
            loadSettings().then(() => loadCategories().then(() => loadInventory()));
            loadSessionCount();
        } else {
            // Show the license wall; block app usage
            showLicenseWall(status);
        }
    });
});

// ─── Font Size ────────────────────────────────────────────────────────────────

function applyFontSize(px) {
    document.documentElement.style.fontSize = px + 'px';
    localStorage.setItem('pos_font_size', px);
    const label = document.getElementById('fontSizeLabel');
    const range = document.getElementById('fontSizeRange');
    if (label) label.textContent = px + 'px';
    if (range) range.value = px;
}

// Apply saved font size immediately on load
(function() {
    const saved = parseInt(localStorage.getItem('pos_font_size')) || 16;
    document.documentElement.style.fontSize = saved + 'px';
})();

// ─── Settings ─────────────────────────────────────────────────────────────────

async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        if (res.ok) {
            shopSettings = await res.json();
            applyShopName(shopSettings.shop_name);
        }
    } catch (e) { console.error(e); }
}

function applyShopName(name) {
    const displayName = (name || 'FreshMarket POS').trim();
    document.title = displayName;
    document.getElementById('pageTitle').textContent = displayName;
    const brandH1 = document.querySelector('.brand h1');
    if (brandH1) brandH1.textContent = displayName;
}

async function loadSessionCount() {
    try {
        const res = await fetch('/api/session-count');
        if (res.ok) {
            const data = await res.json();
            const el = document.getElementById('sessionCount');
            if (el) el.textContent = data.count.toLocaleString();
        }
    } catch (e) { console.error(e); }
}

function loadSettingsForm() {
    document.getElementById('setShopName').value  = shopSettings.shop_name || '';
    document.getElementById('setAddress').value   = shopSettings.address   || '';
    document.getElementById('setPhone').value     = shopSettings.phone     || '';
    document.getElementById('setGstin').value     = shopSettings.gstin     || '';
    document.getElementById('gstMode').value      = shopSettings.gst_mode  || 'none';
    document.getElementById('gstRate').value      = shopSettings.gst_rate  || 0;
    updateGstRateVisibility();

    // Font size
    const savedSize = parseInt(localStorage.getItem('pos_font_size')) || 16;
    document.getElementById('fontSizeRange').value = savedSize;
    document.getElementById('fontSizeLabel').textContent = savedSize + 'px';

    // Sales tax
    const enabled = !!shopSettings.sales_tax_enabled;
    document.getElementById('salesTaxEnabled').checked = enabled;
    document.getElementById('salesTaxName').value = shopSettings.sales_tax_name || 'Sales Tax';
    document.getElementById('salesTaxRate').value = shopSettings.sales_tax_rate || 0;
    updateSalesTaxVisibility();
}

function updateSalesTaxVisibility() {
    const enabled = document.getElementById('salesTaxEnabled').checked;
    document.getElementById('salesTaxFields').classList.toggle('hidden', !enabled);
}



function updateGstRateVisibility() {
    const mode = document.getElementById('gstMode').value;
    const rateGroup = document.getElementById('gstRateGroup');
    rateGroup.classList.toggle('hidden', mode === 'none');
}

async function saveSettings(e) {
    e.preventDefault();
    const payload = {
        shop_name: document.getElementById('setShopName').value.trim(),
        address:   document.getElementById('setAddress').value.trim(),
        phone:     document.getElementById('setPhone').value.trim(),
        gstin:     document.getElementById('setGstin').value.trim(),
        gst_mode:  document.getElementById('gstMode').value,
        gst_rate:  parseFloat(document.getElementById('gstRate').value) || 0,
        sales_tax_enabled: document.getElementById('salesTaxEnabled').checked,
        sales_tax_rate:    parseFloat(document.getElementById('salesTaxRate').value) || 0,
        sales_tax_name:    document.getElementById('salesTaxName').value.trim() || 'Sales Tax',
    };
    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            shopSettings = payload;
            applyShopName(payload.shop_name);
            const btn = document.getElementById('saveSettingsBtn');
            btn.textContent = '✅ Saved!';
            setTimeout(() => btn.textContent = 'Save Settings', 2000);
        }
    } catch (e) { console.error(e); }
}

// ─── Categories ───────────────────────────────────────────────────────────────

async function loadCategories() {
    try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        categories = data.categories;
        renderCategoryDropdown();
        renderCategoryManager();
    } catch (e) { console.error('Error loading categories:', e); }
}

function renderCategoryDropdown() {
    const sel = document.getElementById('invCategory');
    const current = sel.value;
    sel.innerHTML = '';
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.name;
        opt.textContent = cat.name;
        if (cat.name === current) opt.selected = true;
        sel.appendChild(opt);
    });
}

function renderCategoryManager() {
    const list = document.getElementById('categoryList');
    list.innerHTML = '';
    categories.forEach(cat => {
        const li = document.createElement('li');
        li.className = 'cat-item';
        li.innerHTML = `
            <span class="cat-name" id="catLabel-${cat.id}">${cat.name}</span>
            <div class="cat-actions">
                <button class="cat-edit-btn" onclick="startEditCategory(${cat.id}, '${cat.name.replace(/'/g, "\\'")}')">✏️</button>
                <button class="cat-delete-btn" onclick="deleteCategory(${cat.id})">🗑️</button>
            </div>
        `;
        list.appendChild(li);
    });
}

async function addCategory() {
    const input = document.getElementById('newCategoryName');
    const name = input.value.trim();
    if (!name) return;
    try {
        const res = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (res.ok) {
            input.value = '';
            await loadCategories();
            await loadInventory();
        } else { alert('Category already exists.'); }
    } catch (e) { console.error(e); }
}

function startEditCategory(id, currentName) {
    const li = document.getElementById(`catLabel-${id}`).parentElement.parentElement;
    li.innerHTML = `
        <input type="text" class="cat-edit-input" value="${currentName}" id="catEditInput-${id}">
        <div class="cat-actions">
            <button class="cat-save-btn" onclick="saveCategory(${id})">✔️</button>
            <button class="cat-cancel-btn" onclick="renderCategoryManager()">✖️</button>
        </div>
    `;
}

async function saveCategory(id) {
    const input = document.getElementById(`catEditInput-${id}`);
    const name = input.value.trim();
    if (!name) return;
    try {
        const res = await fetch(`/api/categories/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (res.ok) { await loadCategories(); await loadInventory(); }
    } catch (e) { console.error(e); }
}

async function deleteCategory(id) {
    const li = document.getElementById(`catLabel-${id}`);
    const name = li ? li.textContent : '';
    const confirmDiv = document.createElement('span');
    confirmDiv.innerHTML = ` Delete "<b>${name}</b>"? <button onclick="confirmDeleteCategory(${id})">Yes</button> <button onclick="renderCategoryManager()">No</button>`;
    li.parentElement.parentElement.appendChild(confirmDiv);
    li.parentElement.parentElement.querySelector('.cat-actions').style.display = 'none';
}

async function confirmDeleteCategory(id) {
    try {
        const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
        if (res.ok) { await loadCategories(); await loadInventory(); }
    } catch (e) { console.error(e); }
}

// ─── Inventory ────────────────────────────────────────────────────────────────

async function loadInventory() {
    try {
        const res = await fetch('/api/inventory');
        const data = await res.json();
        inventory = data.inventory;
        renderCategoryPills();
        renderProductsGrid();
        renderInventoryList();
        renderBarcodesTab();
    } catch (e) { console.error('Error loading inventory:', e); }
}

function renderCategoryPills() {
    const container = document.getElementById('categoryPills');
    const unique = ['All', ...new Set(inventory.map(i => i.category).filter(Boolean))];
    container.innerHTML = '';
    unique.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'pill' + (cat === activeCategory ? ' active' : '');
        btn.dataset.category = cat;
        btn.textContent = cat;
        btn.addEventListener('click', () => {
            activeCategory = cat;
            container.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            renderProductsGrid();
        });
        container.appendChild(btn);
    });
}

function renderProductsGrid() {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = '';
    const filtered = inventory.filter(item => {
        const matchCat = activeCategory === 'All' || item.category === activeCategory;
        const matchSearch = item.name.toLowerCase().includes(searchTerm);
        return matchCat && matchSearch;
    });
    if (filtered.length === 0) {
        grid.innerHTML = '<p class="no-results">No items found.</p>';
        return;
    }
    filtered.forEach(item => {
        const outOfStock = item.stock !== 999 && item.stock <= 0;
        const lowStock   = item.stock !== 999 && item.stock > 0 && item.stock < 10;
        const card = document.createElement('div');
        card.className = 'product-card' + (outOfStock ? ' out-of-stock' : '');
        card.innerHTML = `
            <div class="card-badge-area">
                ${lowStock   ? `<span class="stock-badge low">⚠️ ${formatStockLabel(item)} left</span>` : ''}
                ${outOfStock ? `<span class="stock-badge out">Out of Stock</span>` : ''}
            </div>
            <img src="${item.image_url || '/static/logo.png'}" alt="${item.name}" class="product-img" onerror="this.src='/static/logo.png'">
            <div class="product-info">
                <span class="product-category">${item.category || ''}</span>
                <h3>${item.name}</h3>
                ${item.name_ta ? `<span class="product-name-ta">${item.name_ta}</span>` : ''}
                <div class="product-price">₹${item.price.toFixed(2)}${item.unit_type === 'weight' ? ' <span class="price-per-kg">/kg</span>' : ''}</div>
                ${item.unit_type === 'weight' ? '<span class="weight-badge">⚖️ By weight</span>' : ''}
            </div>
        `;
        if (!outOfStock) card.addEventListener('click', () => addToCart(item));
        grid.appendChild(card);
    });
}

function renderInventoryList() {
    const list = document.getElementById('inventoryList');
    list.innerHTML = '';
    inventory.forEach(item => {
        const tr = document.createElement('tr');
        const stockDisplay = formatStockLabel(item);
        const stockClass = item.stock !== 999 && item.stock < 10 ? 'stock-low' : '';
        tr.innerHTML = `
            <td><img src="${item.image_url || '/static/logo.png'}" alt="${item.name}" onerror="this.src='/static/logo.png'"></td>
            <td>${item.name}${item.name_ta ? `<br><span class="inv-name-ta">${item.name_ta}</span>` : ''}</td>
            <td><span class="category-tag">${item.category || 'General'}</span></td>
            <td>₹${item.price.toFixed(2)}${item.unit_type === 'weight' ? `<br><span class="unit-type-tag">⚖️ per kg</span>` : ''}</td>
            <td class="${stockClass}">${stockDisplay}</td>
            <td>${item.barcode
                ? `<button class="barcode-btn" title="View/Print Barcode">&#9646;&#9646;&#9646; ${item.barcode}</button>`
                : `<span class="no-barcode">—</span>`}</td>
            <td class="action-cell">
                <button class="edit-btn">Edit</button>
                <button class="delete-btn">Delete</button>
                <span class="confirm-delete hidden">
                    Sure?
                    <button class="confirm-yes-btn">Yes</button>
                    <button class="confirm-no-btn">No</button>
                </span>
            </td>
        `;
        tr.querySelector('.edit-btn').addEventListener('click', () => startEditItem(item));
        const deleteBtn   = tr.querySelector('.delete-btn');
        const confirmSpan = tr.querySelector('.confirm-delete');
        deleteBtn.addEventListener('click', () => { deleteBtn.classList.add('hidden'); confirmSpan.classList.remove('hidden'); });
        tr.querySelector('.confirm-no-btn').addEventListener('click', () => { deleteBtn.classList.remove('hidden'); confirmSpan.classList.add('hidden'); });
        tr.querySelector('.confirm-yes-btn').addEventListener('click', () => deleteInventoryItem(item.id));
        const barcodeBtn = tr.querySelector('.barcode-btn');
        if (barcodeBtn) barcodeBtn.addEventListener('click', () => openBarcodeModal(item));
        list.appendChild(tr);
    });
}

function startEditItem(item) {
    editingItemId = item.id;
    document.getElementById('inventoryFormTitle').textContent = 'Edit Item';
    document.getElementById('invSubmitBtn').textContent = 'Save Changes';
    document.getElementById('invCancelBtn').classList.remove('hidden');
    document.getElementById('editItemId').value = item.id;
    document.getElementById('invName').value     = item.name;
    document.getElementById('invPrice').value    = item.price;
    document.getElementById('invCategory').value = item.category;
    if (item.unit_type === 'weight') {
        const { kg, g } = decimalKgToKgGrams(item.stock);
        document.getElementById('invStockKg').value = kg;
        document.getElementById('invStockG').value  = g;
    } else {
        document.getElementById('invStock').value = item.stock;
    }
    document.getElementById('invImage').value    = item.image_url;
    document.getElementById('invBarcode').value  = item.barcode || '';
    setInvUnitType(item.unit_type === 'weight' ? 'weight' : 'piece');
    document.querySelector('.inventory-card').scrollIntoView({ behavior: 'smooth' });
    document.querySelector('[data-tab="inventory"]').click();
}

function resetInventoryForm() {
    editingItemId = null;
    document.getElementById('inventoryFormTitle').textContent = 'Add New Item';
    document.getElementById('invSubmitBtn').textContent = 'Add to Inventory';
    document.getElementById('invCancelBtn').classList.add('hidden');
    document.getElementById('addInventoryForm').reset();
    document.getElementById('invStock').value = 999;
    document.getElementById('invStockKg').value = 999;
    document.getElementById('invStockG').value = 0;
    setInvUnitType('piece');
}

// ===== Unit type toggle (Piece / Weight) =====
function getInvUnitType() {
    const el = document.getElementById('invUnitType');
    return el ? el.value : 'piece';
}

// Combine separate kg + g inputs into one decimal-kg value (e.g. 5kg 200g -> 5.2).
function kgGramsToDecimalKg(kg, g) {
    const kgNum = Math.max(0, parseFloat(kg) || 0);
    const gNum  = Math.max(0, Math.min(999, parseFloat(g) || 0));
    return Math.round((kgNum + gNum / 1000) * 1000) / 1000; // avoid float noise
}

// Split a decimal-kg value back into whole kg + remainder grams for the form.
function decimalKgToKgGrams(value) {
    let total = Math.max(0, parseFloat(value) || 0);
    let kg = Math.floor(total);
    let g  = Math.round((total - kg) * 1000);
    if (g >= 1000) { kg += 1; g -= 1000; } // guard against rounding carry
    return { kg, g };
}

function setInvUnitType(unitType) {
    const hidden = document.getElementById('invUnitType');
    if (hidden) hidden.value = unitType;
    document.querySelectorAll('.unit-type-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.unit === unitType);
    });
    const priceLabel = document.getElementById('invPriceLabel');
    const priceHint  = document.getElementById('invPriceHint');
    const stockPieceGroup = document.getElementById('stockPieceGroup');
    const stockWeightGroup = document.getElementById('stockWeightGroup');
    if (unitType === 'weight') {
        if (priceLabel) priceLabel.textContent = 'Rate (₹ per kg)';
        if (priceHint) priceHint.classList.remove('hidden');
        if (stockPieceGroup) stockPieceGroup.classList.add('hidden');
        if (stockWeightGroup) stockWeightGroup.classList.remove('hidden');
    } else {
        if (priceLabel) priceLabel.textContent = 'Price (₹)';
        if (priceHint) priceHint.classList.add('hidden');
        if (stockPieceGroup) stockPieceGroup.classList.remove('hidden');
        if (stockWeightGroup) stockWeightGroup.classList.add('hidden');
    }
}

// Human-readable stock label, e.g. "5 kg 200 g" for weight items, "42" for piece items.
function formatStockLabel(item) {
    if (item.stock === 999) return '∞';
    if (item.unit_type === 'weight') {
        const { kg, g } = decimalKgToKgGrams(item.stock);
        if (kg > 0 && g > 0) return `${kg} kg ${g} g`;
        if (kg > 0) return `${kg} kg`;
        return `${g} g`;
    }
    return item.stock;
}

function initUnitTypeToggle() {
    document.querySelectorAll('.unit-type-btn').forEach(btn => {
        btn.addEventListener('click', () => setInvUnitType(btn.dataset.unit));
    });
}

async function handleInventorySubmit(e) {
    e.preventDefault();
    const nameEn = document.getElementById('invName').value.trim();
    if (!nameEn) {
        alert('Enter the item name.');
        return;
    }
    const unitType = getInvUnitType();
    const stock = unitType === 'weight'
        ? kgGramsToDecimalKg(
            document.getElementById('invStockKg').value,
            document.getElementById('invStockG').value
          )
        : parseInt(document.getElementById('invStock').value, 10) || 0;
    const payload = {
        name:      nameEn,
        price:     parseFloat(document.getElementById('invPrice').value),
        category:  document.getElementById('invCategory').value,
        stock:     stock,
        image_url: document.getElementById('invImage').value,
        barcode:   document.getElementById('invBarcode').value.trim() || null,
        unit_type: unitType,
    };
    try {
        const method = editingItemId ? 'PUT' : 'POST';
        const url    = editingItemId ? `/api/inventory/${editingItemId}` : '/api/inventory';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) { resetInventoryForm(); loadInventory(); }
        else {
            const err = await res.json().catch(() => null);
            alert(err?.detail || 'Failed to save item.');
        }
    } catch (e) { console.error(e); }
}

async function deleteInventoryItem(id) {
    try {
        const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
        if (res.ok) loadInventory();
        else alert('Failed to delete item.');
    } catch (e) { console.error(e); }
}

// ─── Barcodes Tab ─────────────────────────────────────────────────────────────

let bcSelected = new Set(); // item ids selected for printing
let bcActiveCategory = 'All';
let bcSearchTerm = '';

function renderBarcodesTab() {
    const container = document.getElementById('bcCategoryList');
    if (!container) return;

    // Build category pills
    const allCats = ['All', ...new Set(inventory.map(i => i.category || 'General'))].sort((a, b) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b));
    const pillsContainer = document.getElementById('bcCategoryPills');
    if (pillsContainer) {
        pillsContainer.innerHTML = '';
        allCats.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'pill' + (cat === bcActiveCategory ? ' active' : '');
            btn.dataset.category = cat;
            btn.textContent = cat;
            btn.addEventListener('click', () => {
                bcActiveCategory = cat;
                renderBcItems();
                pillsContainer.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
            });
            pillsContainer.appendChild(btn);
        });
    }

    renderBcItems();
}

function renderBcItems() {
    const container = document.getElementById('bcCategoryList');
    if (!container) return;

    // Filter inventory
    const term = bcSearchTerm.toLowerCase();
    let filtered = inventory.filter(i => {
        const matchCat = bcActiveCategory === 'All' || (i.category || 'General') === bcActiveCategory;
        const matchSearch = !term || i.name.toLowerCase().includes(term) || (i.barcode || '').toLowerCase().includes(term);
        return matchCat && matchSearch;
    });

    container.innerHTML = '';

    if (!filtered.length) {
        container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:48px 0;font-size:0.95rem;">No items found.</div>';
        return;
    }

    // Group by category
    const cats = bcActiveCategory === 'All'
        ? [...new Set(filtered.map(i => i.category || 'General'))].sort()
        : [bcActiveCategory];

    cats.forEach(cat => {
        const items = filtered.filter(i => (i.category || 'General') === cat);
        if (!items.length) return;

        const block = document.createElement('div');
        block.className = 'bc-category-block';
        block.innerHTML = `<div class="bc-category-header"><span class="bc-cat-name">${cat}</span><span class="bc-cat-count">${items.length} item${items.length !== 1 ? 's' : ''}</span></div>`;

        const grid = document.createElement('div');
        grid.className = 'bc-items-grid';

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'bc-item-card';
            card.dataset.id = item.id;

            card.innerHTML = `
                <div class="bc-item-select">
                    <input type="checkbox" class="bc-checkbox" data-id="${item.id}" ${item.barcode ? '' : 'disabled'} ${bcSelected.has(item.id) ? 'checked' : ''}>
                </div>
                <div class="bc-item-info">
                    <img src="${item.image_url || '/static/logo.png'}" class="bc-thumb" onerror="this.src='/static/logo.png'">
                    <div class="bc-item-details">
                        <div class="bc-item-name">${item.name}</div>
                        <div class="bc-item-price">₹${item.price.toFixed(2)}</div>
                    </div>
                </div>
                <div class="bc-barcode-area">
                    ${item.barcode
                        ? `<svg class="bc-barcode-svg" id="bcsvg-${item.id}"></svg>`
                        : `<div class="bc-no-barcode">
                            <span>No barcode</span>
                            <div class="bc-generate-row">
                                <input type="text" class="bc-gen-input" placeholder="Enter barcode..." data-id="${item.id}">
                                <button class="bc-gen-btn" data-id="${item.id}">Generate</button>
                            </div>
                           </div>`
                    }
                </div>
            `;
            grid.appendChild(card);
        });

        block.appendChild(grid);
        container.appendChild(block);
    });

    // Render all barcodes via JsBarcode
    filtered.filter(i => i.barcode).forEach(item => {
        const svg = document.getElementById(`bcsvg-${item.id}`);
        if (!svg) return;
        try {
            JsBarcode(svg, item.barcode, { format: 'CODE128', width: 1.6, height: 55, displayValue: true, fontSize: 11, margin: 6 });
        } catch(e) { svg.innerHTML = '<text x="4" y="20" fill="#e55" font-size="11">Invalid</text>'; }
    });

    // Checkbox listeners
    container.querySelectorAll('.bc-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            const id = parseInt(cb.dataset.id);
            cb.checked ? bcSelected.add(id) : bcSelected.delete(id);
            updateBcPrintBtn();
            syncSelectAll();
        });
    });

    // Generate button listeners
    container.querySelectorAll('.bc-gen-btn').forEach(btn => {
        btn.addEventListener('click', () => bcGenerateBarcode(parseInt(btn.dataset.id), btn));
    });
}

function syncSelectAll() {
    const allCbs = document.querySelectorAll('.bc-checkbox:not(:disabled)');
    const allChecked = allCbs.length > 0 && [...allCbs].every(c => c.checked);
    const selectAll = document.getElementById('bcSelectAll');
    if (selectAll) selectAll.checked = allChecked;
}

function updateBcPrintBtn() {
    const btn = document.getElementById('btnPrintSelected');
    const countEl = document.getElementById('bcSelectedCount');
    if (!btn || !countEl) return;
    countEl.textContent = bcSelected.size;
    btn.disabled = bcSelected.size === 0;
}

async function bcGenerateBarcode(itemId, btn) {
    const input = document.querySelector(`.bc-gen-input[data-id="${itemId}"]`);
    const value = input ? input.value.trim() : '';
    if (!value) { input && input.focus(); return; }

    // Save barcode to server
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    btn.disabled = true;
    btn.textContent = '...';
    try {
        const payload = { name: item.name, price: item.price, category: item.category, stock: item.stock, image_url: item.image_url, barcode: value };
        const res = await fetch(`/api/inventory/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            await loadInventory(); // refresh everything
        } else {
            alert('Failed to save barcode.'); btn.disabled = false; btn.textContent = 'Generate';
        }
    } catch(e) { alert('Error saving barcode.'); btn.disabled = false; btn.textContent = 'Generate'; }
}

async function bcPrintSelected() {
    const items = inventory.filter(i => bcSelected.has(i.id) && i.barcode);
    if (!items.length) return;

    const btn = document.getElementById('btnPrintSelected');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⏳ Printing...';

    try {
        const res = await fetch('/api/print-barcodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items.map(i => ({ barcode: i.barcode, name: i.name, price: i.price })) })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            btn.innerHTML = '✅ Printed!';
        } else {
            const failed = data.results.filter(r => !r.ok).map(r => r.name).join(', ');
            btn.innerHTML = '⚠️ Partial';
            alert(`Some labels failed: ${failed}`);
        }
    } catch(e) {
        alert('Print failed: ' + e.message);
        btn.innerHTML = origText;
        btn.disabled = false;
        return;
    }

    setTimeout(() => {
        btn.innerHTML = origText;
        btn.disabled = bcSelected.size === 0;
    }, 2000);
}

// ─── Cart ─────────────────────────────────────────────────────────────────────

function addToCart(product) {
    if (product.unit_type === 'weight') {
        openWeightModal(product);
        return;
    }
    const existing = cart.find(i => i.id === product.id);
    if (existing) {
        if (product.stock !== 999 && existing.quantity >= product.stock) {
            alert(`Only ${product.stock} units available.`);
            return;
        }
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    updateCartUI();
}

// ─── Weight Selection Popup (for weight-based products) ──────────────────────

const WEIGHT_PRESETS_G = [100, 250, 500, 1000, 2000, 5000];
let weightModalContext = null;   // { product, editIndex }
let selectedWeightGrams = null;

function formatWeightLabel(grams) {
    if (grams >= 1000) {
        const kg = grams / 1000;
        return (kg % 1 === 0 ? kg.toFixed(0) : kg) + ' kg';
    }
    return grams + ' g';
}

function formatWeightKg(kg) {
    const grams = Math.round(kg * 1000);
    if (grams >= 1000 && grams % 1000 === 0) {
        return (grams / 1000) + ' kg';
    }
    if (grams >= 1000) {
        return (Math.round((grams / 1000) * 1000) / 1000) + ' kg';
    }
    return grams + ' g';
}

function openWeightModal(product, editIndex = null) {
    weightModalContext = { product, editIndex };
    selectedWeightGrams = null;

    document.getElementById('weightModalTitle').textContent = editIndex !== null ? 'Edit Weight' : 'Select Weight';
    document.getElementById('weightModalProductName').textContent = product.name;
    document.getElementById('weightModalRate').textContent = `₹${product.price.toFixed(2)} / kg`;

    const customValueEl = document.getElementById('weightCustomValue');
    const customUnitEl  = document.getElementById('weightCustomUnit');
    customValueEl.value = '';
    customUnitEl.value  = 'g';

    let prefillGrams = null;
    if (editIndex !== null && cart[editIndex]) {
        prefillGrams = Math.round(cart[editIndex].quantity * 1000);
    }

    const grid = document.getElementById('weightPresetGrid');
    grid.innerHTML = '';
    WEIGHT_PRESETS_G.forEach(g => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'weight-preset-btn';
        btn.textContent = formatWeightLabel(g);
        btn.dataset.grams = g;
        if (prefillGrams === g) { btn.classList.add('active'); selectedWeightGrams = g; }
        btn.addEventListener('click', () => selectWeightPreset(g));
        grid.appendChild(btn);
    });

    if (prefillGrams !== null && !WEIGHT_PRESETS_G.includes(prefillGrams)) {
        if (prefillGrams >= 1000 && prefillGrams % 1000 === 0) {
            customValueEl.value = prefillGrams / 1000;
            customUnitEl.value  = 'kg';
        } else {
            customValueEl.value = prefillGrams;
            customUnitEl.value  = 'g';
        }
        selectedWeightGrams = prefillGrams;
    }

    updateWeightModalTotal();
    document.getElementById('weightModal').classList.remove('hidden');
}

function selectWeightPreset(grams) {
    selectedWeightGrams = grams;
    document.querySelectorAll('.weight-preset-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.grams, 10) === grams);
    });
    document.getElementById('weightCustomValue').value = '';
    updateWeightModalTotal();
}

function getCustomWeightGrams() {
    const val = parseFloat(document.getElementById('weightCustomValue').value);
    if (isNaN(val) || val <= 0) return null;
    const unit = document.getElementById('weightCustomUnit').value;
    return unit === 'kg' ? val * 1000 : val;
}

function getSelectedWeightGrams() {
    const custom = getCustomWeightGrams();
    if (custom !== null) return custom;
    return selectedWeightGrams;
}

function updateWeightModalTotal() {
    const grams = getSelectedWeightGrams();
    const rate  = weightModalContext ? weightModalContext.product.price : 0;
    const total = grams ? (grams / 1000) * rate : 0;
    document.getElementById('weightModalTotal').textContent = `₹${total.toFixed(2)}`;
}

function closeWeightModal() {
    document.getElementById('weightModal').classList.add('hidden');
    weightModalContext = null;
    selectedWeightGrams = null;
}

function confirmWeightSelection() {
    if (!weightModalContext) return;
    const grams = getSelectedWeightGrams();
    if (!grams || grams <= 0) { alert('Select or enter a weight.'); return; }
    const weightKg = grams / 1000;
    const { product, editIndex } = weightModalContext;

    if (editIndex !== null) {
        if (cart[editIndex]) cart[editIndex].quantity = weightKg;
    } else {
        const existingIndex = cart.findIndex(i => i.id === product.id && i.unit_type === 'weight');
        if (existingIndex !== -1) {
            cart[existingIndex].quantity += weightKg;
        } else {
            cart.push({ ...product, quantity: weightKg, unit_type: 'weight', unit: 'kg' });
        }
    }
    updateCartUI();
    closeWeightModal();
}

function initWeightModal() {
    const customValueEl = document.getElementById('weightCustomValue');
    const customUnitEl  = document.getElementById('weightCustomUnit');
    if (!customValueEl) return;
    customValueEl.addEventListener('input', () => {
        if (customValueEl.value) {
            document.querySelectorAll('.weight-preset-btn').forEach(b => b.classList.remove('active'));
            selectedWeightGrams = null;
        }
        updateWeightModalTotal();
    });
    customUnitEl.addEventListener('change', updateWeightModalTotal);
    document.getElementById('btnAddWeight').addEventListener('click', confirmWeightSelection);
    document.getElementById('btnCancelWeight').addEventListener('click', closeWeightModal);
    document.getElementById('closeWeightModal').addEventListener('click', closeWeightModal);
}

function addMiscItem() {
    const nameEl  = document.getElementById('miscName');
    const priceEl = document.getElementById('miscPrice');
    const qtyEl   = document.getElementById('miscQty');
    const name  = nameEl.value.trim();
    const price = parseFloat(priceEl.value);
    const qty   = parseInt(qtyEl.value) || 1;
    if (!name)  { alert('Please enter an item name.'); return; }
    if (isNaN(price) || price <= 0) { alert('Please enter a valid price.'); return; }
    cart.push({ id: 'misc_' + Date.now(), name, price, quantity: qty, category: 'MISC', stock: 999 });
    updateCartUI();
    nameEl.value = ''; priceEl.value = ''; qtyEl.value = '1';
}

function updateQuantity(index, delta) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) cart.splice(index, 1);
    updateCartUI();
}

function openBarcodeModal(item) {
    document.getElementById('barcodeModalTitle').textContent = 'Barcode — ' + item.name;
    document.getElementById('barcodeProductName').textContent = item.name;
    document.getElementById('barcodeProductPrice').textContent = '₹' + item.price.toFixed(2);
    const svg = document.getElementById('barcodeSvg');
    try {
        JsBarcode(svg, item.barcode, {
            format: 'CODE128',
            width: 2,
            height: 80,
            displayValue: true,
            fontSize: 14,
            margin: 10
        });
    } catch(e) {
        svg.innerHTML = '<text x="10" y="30" fill="red">Invalid barcode value</text>';
    }
    document.getElementById('barcodeModal').classList.remove('hidden');
}

function closeBarcodeModal() {
    document.getElementById('barcodeModal').classList.add('hidden');
}

function clearCart() { cart = []; document.getElementById('cartDiscountInput').value = '0'; updateCartUI(); }

function getCartDiscount() {
    const raw = parseFloat(document.getElementById('cartDiscountInput').value);
    return isNaN(raw) || raw < 0 ? 0 : raw;
}

function calcTotals() {
    const gst_mode = shopSettings.gst_mode || 'none';
    const gst_rate = parseFloat(shopSettings.gst_rate) || 0;
    const sales_tax_enabled = !!shopSettings.sales_tax_enabled;
    const sales_tax_rate    = parseFloat(shopSettings.sales_tax_rate) || 0;

    let subtotal = 0;
    for (const item of cart) {
        subtotal += item.price * item.quantity;
    }
    const discount_total = getCartDiscount();
    const taxable_total = Math.max(0, subtotal - discount_total);

    // GST is tax-inclusive: extract from total
    let tax_amount = 0;
    if (gst_mode !== 'none' && gst_rate > 0) {
        tax_amount = taxable_total - (taxable_total / (1 + gst_rate / 100));
    }

    const total = taxable_total;

    // Sales tax is added on top
    const sales_tax_amount = (sales_tax_enabled && sales_tax_rate > 0)
        ? Math.round(total * sales_tax_rate / 100 * 100) / 100
        : 0;
    const grand_total = total + sales_tax_amount;

    return { subtotal, discount_total, tax_amount, total, sales_tax_amount, grand_total };
}

function updateCartUI() {
    const cartItemsDiv = document.getElementById('cartItems');
    cartItemsDiv.innerHTML = '';

    if (cart.length === 0) {
        cartItemsDiv.innerHTML = '<div class="empty-cart-msg">Your cart is empty</div>';
        document.getElementById('cartTotal').textContent = '₹0.00';
        document.getElementById('cartGstRow').classList.add('hidden');
        document.getElementById('cartSalesTaxRow').classList.add('hidden');
        document.getElementById('cartDiscRow').classList.add('hidden');
        document.getElementById('cartDiscountInput').value = '0';
        return;
    }

    const gst_mode = shopSettings.gst_mode || 'none';
    const gst_rate = parseFloat(shopSettings.gst_rate) || 0;

    cart.forEach((item, index) => {
        const lineTotal = item.price * item.quantity;
        const isWeight = item.unit_type === 'weight';
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-details">
                <span class="cart-item-title">${item.name}</span>
                ${item.name_ta ? `<span class="cart-item-name-ta">${item.name_ta}</span>` : ''}
                <span class="cart-item-price">₹${item.price.toFixed(2)} ${isWeight ? '/kg' : 'each'}</span>
            </div>
            <div class="cart-item-controls">
                ${isWeight ? `
                    <span class="cart-item-qty">${formatWeightKg(item.quantity)}</span>
                    <button class="qty-btn edit-weight-btn" title="Change weight">✎</button>
                    <button class="qty-btn remove-weight-btn" title="Remove">🗑</button>
                ` : `
                    <button class="qty-btn" onclick="updateQuantity(${index}, -1)">−</button>
                    <span class="cart-item-qty">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateQuantity(${index}, 1)">+</button>
                `}
            </div>
            <div class="cart-item-line-total">₹${lineTotal.toFixed(2)}</div>
        `;
        if (isWeight) {
            div.querySelector('.edit-weight-btn').addEventListener('click', () => openWeightModal(item, index));
            div.querySelector('.remove-weight-btn').addEventListener('click', () => { cart.splice(index, 1); updateCartUI(); });
        }
        cartItemsDiv.appendChild(div);
    });

    const { subtotal, discount_total, tax_amount, total, sales_tax_amount, grand_total } = calcTotals();

    // Show GST breakdown
    const gstRow = document.getElementById('cartGstRow');
    if (gst_mode !== 'none' && gst_rate > 0) {
        gstRow.classList.remove('hidden');
        let label = '';
        if (gst_mode === 'split') {
            const half = gst_rate / 2;
            label = `CGST ${half}% + SGST ${half}% (incl.)`;
        } else {
            label = `GST ${gst_rate}% (incl.)`;
        }
        document.getElementById('gstLabel').textContent = label;
        document.getElementById('gstAmount').textContent = `₹${tax_amount.toFixed(2)}`;
    } else {
        gstRow.classList.add('hidden');
    }

    if (discount_total > 0) {
        document.getElementById('cartDiscRow').classList.remove('hidden');
        document.getElementById('cartDiscAmount').textContent = `-₹${discount_total.toFixed(2)}`;
    } else {
        document.getElementById('cartDiscRow').classList.add('hidden');
    }

    // Sales tax row
    const sales_tax_enabled = !!shopSettings.sales_tax_enabled;
    const sales_tax_rate    = parseFloat(shopSettings.sales_tax_rate) || 0;
    const sales_tax_name    = shopSettings.sales_tax_name || 'Sales Tax';
    const salesTaxRow = document.getElementById('cartSalesTaxRow');
    if (sales_tax_enabled && sales_tax_amount > 0) {
        salesTaxRow.classList.remove('hidden');
        document.getElementById('salesTaxLabel').textContent = `${sales_tax_name} (${sales_tax_rate}%)`;
        document.getElementById('salesTaxAmount').textContent = `₹${sales_tax_amount.toFixed(2)}`;
    } else {
        salesTaxRow.classList.add('hidden');
    }

    document.getElementById('cartTotal').textContent = `₹${grand_total.toFixed(2)}`;
}

// ─── Receipt Preview (before saving) ─────────────────────────────────────────

function openReceiptPreview() {
    if (cart.length === 0) { alert('Cart is empty!'); return; }

    const { subtotal, discount_total, tax_amount, total, sales_tax_amount, grand_total } = calcTotals();
    const gst_mode = shopSettings.gst_mode || 'none';
    const gst_rate = parseFloat(shopSettings.gst_rate) || 0;
    const sales_tax_enabled = !!shopSettings.sales_tax_enabled;
    const sales_tax_rate    = parseFloat(shopSettings.sales_tax_rate) || 0;
    const sales_tax_name    = shopSettings.sales_tax_name || 'Sales Tax';
    const now = new Date().toLocaleString('en-IN');
    const shopName = shopSettings.shop_name || 'FreshMarket POS';

    const has_gst       = gst_mode !== 'none' && tax_amount > 0;
    const has_discount  = discount_total > 0;
    const has_sales_tax = sales_tax_amount > 0;
    const show_subtotal = has_gst || has_discount || has_sales_tax;

    // Build GST lines
    let gstLines = '';
    if (has_gst) {
        if (gst_mode === 'split') {
            const half = (tax_amount / 2).toFixed(2);
            const half_rate = gst_rate / 2;
            gstLines = `
                <tr class="rcpt-tax-row"><td colspan="3" class="rcpt-td-name">CGST ${half_rate}% (incl.)</td><td class="rcpt-td-num">₹${half}</td></tr>
                <tr class="rcpt-tax-row"><td colspan="3" class="rcpt-td-name">SGST ${half_rate}% (incl.)</td><td class="rcpt-td-num">₹${half}</td></tr>
            `;
        } else {
            gstLines = `<tr class="rcpt-tax-row"><td colspan="3" class="rcpt-td-name">GST ${gst_rate}% (incl.)</td><td class="rcpt-td-num">₹${tax_amount.toFixed(2)}</td></tr>`;
        }
    }

    const discRow = has_discount
        ? `<tr class="rcpt-disc-row"><td colspan="3" class="rcpt-td-name">Discount</td><td class="rcpt-td-num">-₹${discount_total.toFixed(2)}</td></tr>`
        : '';

    const subtotalRow = show_subtotal
        ? `<tr><td colspan="3">Subtotal</td><td class="rcpt-td-num">₹${subtotal.toFixed(2)}</td></tr>`
        : '';

    const salesTaxRow = has_sales_tax
        ? `<tr class="rcpt-tax-row"><td colspan="3" class="rcpt-td-name">${sales_tax_name} (${sales_tax_rate}%)</td><td class="rcpt-td-num">₹${sales_tax_amount.toFixed(2)}</td></tr>`
        : '';

    const previewContent = document.getElementById('previewReceiptContent');
    previewContent.innerHTML = `
        <div class="rcpt-wrap">
            <div class="rcpt-header">
                <div class="rcpt-store">${shopName}</div>
                ${shopSettings.address ? `<div class="rcpt-meta">${shopSettings.address}</div>` : ''}
                ${shopSettings.phone   ? `<div class="rcpt-meta">Ph: ${shopSettings.phone}</div>` : ''}
                ${shopSettings.gstin   ? `<div class="rcpt-meta">GSTIN: ${shopSettings.gstin}</div>` : ''}
                <div class="rcpt-sub">CUSTOMER RECEIPT</div>
                <div class="rcpt-meta">${now}</div>
            </div>
            <div class="rcpt-divider"></div>
            <table class="rcpt-table">
                <thead>
                    <tr>
                        <th class="rcpt-th-name">Item</th>
                        <th class="rcpt-th-num">Qty</th>
                        <th class="rcpt-th-num">Price</th>
                        <th class="rcpt-th-num">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${cart.map(i => {
                        const lineTotal = i.price * i.quantity;
                        const qtyText = i.unit_type === 'weight' ? formatWeightKg(i.quantity) : i.quantity;
                        return `<tr>
                            <td class="rcpt-td-name">${i.name}</td>
                            <td class="rcpt-td-num">${qtyText}</td>
                            <td class="rcpt-td-num">₹${i.price.toFixed(2)}</td>
                            <td class="rcpt-td-num">₹${lineTotal.toFixed(2)}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            <div class="rcpt-divider"></div>
            <table class="rcpt-summary">
                ${subtotalRow}
                ${discRow}
                ${gstLines}
                ${salesTaxRow}
            </table>
            <div class="rcpt-divider"></div>
            <div class="rcpt-total-row">
                <span>TOTAL</span>
                <span>₹${grand_total.toFixed(2)}</span>
            </div>
            <div class="rcpt-divider"></div>
            <div class="rcpt-footer">Thank you for shopping!<br>Please come again 🙂</div>
        </div>
    `;

    // Store pending cart snapshot for when user clicks Print
    document.getElementById('receiptPreviewModal').dataset.pending = JSON.stringify({
        subtotal, discount_total, tax_amount, total, sales_tax_amount, grand_total
    });

    document.getElementById('receiptPreviewModal').classList.remove('hidden');
}

function closeReceiptModal() {
    document.getElementById('receiptPreviewModal').classList.add('hidden');
}

async function confirmAndPrint() {
    const modal = document.getElementById('receiptPreviewModal');
    const pending = JSON.parse(modal.dataset.pending || 'null');
    if (!pending) return;

    const printBtn   = document.getElementById('printReceiptBtn');
    const cancelBtn  = document.getElementById('cancelReceiptBtn');
    printBtn.disabled  = true;
    cancelBtn.disabled = true;
    printBtn.textContent = '⏳ Processing...';

    const payload = {
        items: cart.map(i => ({ name: i.name, price: i.price, quantity: i.quantity, unit: i.unit_type === 'weight' ? 'kg' : null, discount: 0 })),
        subtotal:       pending.subtotal,
        discount_total: pending.discount_total,
        tax_amount:     pending.tax_amount,
        total:          pending.grand_total,
    };

    try {
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const result = await res.json();
            closeReceiptModal();
            clearCart();
            loadInventory();

            // Show confirmation toast
            showToast(result.printer_ok
                ? '🖨️ Sale saved & receipt printed!'
                : '✅ Sale saved. Printer not detected.');
        } else {
            const err = await res.json();
            alert(err.detail || 'Checkout failed');
        }
    } catch (e) {
        console.error(e);
        alert('An error occurred during checkout');
    } finally {
        printBtn.disabled  = false;
        cancelBtn.disabled = false;
        printBtn.textContent = '🖨️ Print Receipt';
    }
}

function showToast(msg) {
    let toast = document.getElementById('posToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'posToast';
        toast.className = 'pos-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ─── Sales History ────────────────────────────────────────────────────────────

async function loadSalesHistory() {
    try {
        const res = await fetch('/api/sales/detailed');
        const data = await res.json();
        renderSalesHistory(data.sales);
    } catch (e) { console.error('Error loading sales history:', e); }
}

function renderSalesHistory(sales) {
    const tbody = document.getElementById('historyList');
    tbody.innerHTML = '';
    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No sales recorded yet.</td></tr>';
        return;
    }
    sales.forEach(sale => {
        const itemCount = sale.items.reduce((s, i) => s + i.quantity, 0);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${sale.id}</td>
            <td>${new Date(sale.timestamp + 'Z').toLocaleString()}</td>
            <td>${itemCount} item(s)</td>
            <td>₹${sale.total.toFixed(2)}</td>
            <td><button class="detail-btn" data-id="${sale.id}">▶ Show</button></td>
        `;
        tbody.appendChild(tr);

        const detailRow = document.createElement('tr');
        detailRow.className = 'detail-row hidden';
        detailRow.id = `detail-${sale.id}`;
        const discTotal  = (sale.discount_total || 0);
        const taxAmount  = (sale.tax_amount || 0);
        const subtotal   = (sale.subtotal || sale.total);
        detailRow.innerHTML = `
            <td colspan="5">
                <table class="detail-table">
                    <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Disc</th><th>Subtotal</th></tr></thead>
                    <tbody>
                        ${sale.items.map(i => `
                            <tr>
                                <td>${i.name}</td>
                                <td>${i.quantity}</td>
                                <td>₹${i.price.toFixed(2)}</td>
                                <td>${i.discount > 0 ? '-₹' + i.discount.toFixed(2) : '—'}</td>
                                <td>₹${(i.price * i.quantity - (i.discount||0)).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        ${discTotal > 0 ? `<tr><td colspan="4" style="text-align:right;font-weight:600">Discount</td><td>-₹${discTotal.toFixed(2)}</td></tr>` : ''}
                        ${taxAmount > 0 ? `<tr><td colspan="4" style="text-align:right;font-weight:600">Tax (incl.)</td><td>₹${taxAmount.toFixed(2)}</td></tr>` : ''}
                        <tr style="font-weight:700"><td colspan="4" style="text-align:right">TOTAL</td><td>₹${sale.total.toFixed(2)}</td></tr>
                    </tfoot>
                </table>
            </td>
        `;
        tbody.appendChild(detailRow);

        tr.querySelector('.detail-btn').addEventListener('click', () => {
            const isHidden = detailRow.classList.contains('hidden');
            detailRow.classList.toggle('hidden', !isHidden);
            tr.querySelector('.detail-btn').textContent = isHidden ? '▼ Hide' : '▶ Show';
        });
    });
}

// ─── Bluetooth ────────────────────────────────────────────────────────────────

async function openBluetoothReceive() {
    const btn     = document.getElementById('btnBluetoothPicker');
    const inboxBtn = document.getElementById('btnInboxPicker');
    btn.disabled = true;
    btn.style.opacity = '0.5';
    try {
        const res = await fetch('/api/bluetooth-receive', { method: 'POST' });
        if (res.ok) {
            btn.style.opacity = '1';
            btn.style.animation = 'bt-pulse 1s infinite';
            setTimeout(async () => {
                btn.style.animation = '';
                try {
                    const syncRes  = await fetch('/api/bluetooth-sync', { method: 'POST' });
                    const syncData = await syncRes.json();
                    if (syncData.count > 0 && inboxBtn) {
                        inboxBtn.style.background = '#16a34a';
                        setTimeout(() => inboxBtn.style.background = '', 2000);
                    }
                } catch (e) {}
                btn.disabled = false;
                btn.style.opacity = '1';
            }, 8000);
        } else {
            const err = await res.json();
            alert('Could not open Bluetooth receiver:\n' + (err.detail || 'Unknown error'));
            btn.disabled = false; btn.style.opacity = '1';
        }
    } catch (e) {
        alert('Server unreachable.');
        btn.disabled = false; btn.style.opacity = '1';
    }
}

async function openInboxModal() {
    const grid = document.getElementById('bluetoothImagesGrid');
    grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">🔄 Syncing...</p>';
    document.getElementById('bluetoothModal').classList.remove('hidden');
    try { await fetch('/api/bluetooth-sync', { method: 'POST' }); } catch(e) {}
    try {
        const res  = await fetch('/api/bluetooth-images');
        const data = await res.json();
        if (!data.images || data.images.length === 0) {
            grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">📭 Inbox is empty.</p>';
            return;
        }
        grid.innerHTML = '';
        data.images.forEach(filename => {
            const item = document.createElement('div');
            item.className = 'bluetooth-item';
            item.innerHTML = `
                <img src="/api/bluetooth-images/preview/${encodeURIComponent(filename)}"
                     onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                     style="width:100%;height:100px;object-fit:cover;border-radius:6px 6px 0 0;">
                <div style="display:none;height:100px;align-items:center;justify-content:center;background:#e0e0e0;font-size:2rem;border-radius:6px 6px 0 0;">🖼️</div>
                <div class="bluetooth-filename" title="${filename}">${filename}</div>
            `;
            item.addEventListener('click', () => claimBluetoothImage(filename));
            grid.appendChild(item);
        });
    } catch (e) {
        grid.innerHTML = '<p style="color:var(--danger);text-align:center;padding:20px;">Failed to load inbox.</p>';
    }
}

async function claimBluetoothImage(filename) {
    try {
        const res = await fetch('/api/bluetooth-images/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        if (res.ok) {
            const data = await res.json();
            document.getElementById('invImage').value = data.image_url;
            document.getElementById('bluetoothModal').classList.add('hidden');
        } else { alert('Failed to claim image.'); }
    } catch (e) { console.error(e); }
}

async function handleBrowseImageSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    const btn = document.getElementById('btnBrowseImage');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Uploading...';
    btn.disabled = true;
    try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload-image', { method: 'POST', body: formData });
        if (res.ok) {
            const data = await res.json();
            document.getElementById('invImage').value = data.image_url;
            btn.textContent = '✅ Done';
            setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 1500);
        } else {
            const err = await res.json();
            alert('Upload failed: ' + (err.detail || 'Unknown error'));
            btn.textContent = originalText; btn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        alert('Upload error. Is the server running?');
        btn.textContent = originalText; btn.disabled = false;
    }
    e.target.value = '';
}

// ─── Exit ─────────────────────────────────────────────────────────────────────

document.getElementById('btnExit').addEventListener('click', async () => {
    try { await fetch('/api/exit', { method: 'POST' }); } catch (_) {}
    window.close();
});

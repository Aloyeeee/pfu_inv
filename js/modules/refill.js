// refill.js - Повністю робоча версія

// ==========================================
// ГЛОБАЛЬНІ ЗМІННІ
// ==========================================
window.cartridgeModels = [];
window.globalCartridges = [];
window.refillCart = [];
window.globalRefillHistory = [];
window.selectedCartridges = [];

// ==========================================
// ПЕРЕМИКАННЯ ВКЛАДОК (ГАРАНТОВАНО ПРАЦЮЄ)
// ==========================================
window.switchRefillTab = function(tabId) {
    console.log("🔄 Перемикання на вкладку:", tabId);
    
    // Знімаємо активний клас з усіх кнопок
    document.querySelectorAll('.refill-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Активуємо потрібну кнопку
    const targetBtn = Array.from(document.querySelectorAll('.refill-tab-btn')).find(
        btn => btn.textContent.includes(
            tabId === 'request' ? 'Заявки' :
            tabId === 'cartridges' ? 'Картриджі' :
            tabId === 'printers' ? 'Принтери' : 'Запаси'
        )
    );
    if (targetBtn) targetBtn.classList.add('active');
    
    // Ховаємо всі вкладки
    document.querySelectorAll('.refill-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Показуємо потрібну вкладку
    const activeContent = document.getElementById(`refill-${tabId}`);
    if (activeContent) {
        activeContent.classList.add('active');
        
        // Завантажуємо дані
        setTimeout(() => {
            if (tabId === 'cartridges') window.loadCartridgesData();
            if (tabId === 'printers') window.loadPrintersData();
            if (tabId === 'inventory') window.loadInventoryData();
            if (tabId === 'request') window.loadRefillHistory();
        }, 100);
    }
};

// ==========================================
// МАСОВЕ ПОВЕРНЕННЯ КАРТРИДЖІВ
// ==========================================
window.toggleSelectCartridge = function(id, checked) {
    if (checked) {
        if (!window.selectedCartridges.includes(id)) {
            window.selectedCartridges.push(id);
        }
    } else {
        window.selectedCartridges = window.selectedCartridges.filter(cid => cid !== id);
    }
    updateBulkReturnButton();
};

window.selectAllRefilling = function() {
    const checkboxes = document.querySelectorAll('.cartridge-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = true;
        window.toggleSelectCartridge(parseInt(cb.value), true);
    });
};

window.unselectAll = function() {
    const checkboxes = document.querySelectorAll('.cartridge-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = false;
    });
    window.selectedCartridges = [];
    updateBulkReturnButton();
};

function updateBulkReturnButton() {
    const btn = document.getElementById('bulkReturnBtn');
    if (!btn) return;
    const count = window.selectedCartridges.length;
    btn.style.display = count > 0 ? 'inline-block' : 'none';
    if (count > 0) btn.innerHTML = `📥 Повернути вибрані (${count})`;
}

window.bulkReturnCartridges = async function() {
    if (window.selectedCartridges.length === 0) {
        showToast("Виберіть картриджі для повернення", "error");
        return;
    }

    if (!confirm(`Повернути ${window.selectedCartridges.length} картридж(ів) з заправки?`)) return;

    let success = 0;
    let failed = 0;

    for (const id of window.selectedCartridges) {
        try {
            const response = await fetch('api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'change_cartridge_status',
                    id: id,
                    status: 'in_stock',
                    notes: 'Масове повернення',
                    from_refill: true
                })
            });
            const result = await response.json();
            if (result.success) success++; else failed++;
        } catch (err) {
            failed++;
        }
    }

    showToast(`✅ Повернуто: ${success}, помилок: ${failed}`, success > 0 ? 'success' : 'error');
    window.selectedCartridges = [];
    updateBulkReturnButton();
    window.loadCartridgesData();
    window.loadInventoryData();
};

// ==========================================
// ЗАВАНТАЖЕННЯ ЛОКАЦІЙ
// ==========================================
window.loadLocations = async function() {
    try {
        const response = await fetch('api.php?action=get_locations');
        const locations = await response.json();
        if (!Array.isArray(locations)) return;
        
        const options = locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
        const emptyOption = '<option value="">-- Оберіть локацію --</option>';
        const allOption = '<option value="all">Всі локації</option>';
        
        const selects = {
            'cartridgeLocation': emptyOption + options,
            'moveLocation': emptyOption + options,
            'rfLocation': emptyOption + options,
            'printerLocation': emptyOption + options,
            'filterCartridgeLocation': allOption + options
        };
        
        for (const [id, html] of Object.entries(selects)) {
            const select = document.getElementById(id);
            if (select) select.innerHTML = html;
        }
    } catch (err) {
        console.error("❌ Помилка завантаження локацій:", err);
    }
};

// ==========================================
// ЗАВАНТАЖЕННЯ МОДЕЛЕЙ КАРТРИДЖІВ
// ==========================================
window.loadCartridgeModels = async function() {
    try {
        const response = await fetch('api.php?action=get_cartridge_models');
        const data = await response.json();
        window.cartridgeModels = Array.isArray(data) ? data : [];
        updateModelSelects();
    } catch (err) {
        console.error("Помилка завантаження моделей:", err);
        window.cartridgeModels = [];
    }
};

function updateModelSelects() {
    const filterModel = document.getElementById('filterCartridgeModel');
    if (filterModel) {
        filterModel.innerHTML = '<option value="all">Всі моделі</option>' +
            window.cartridgeModels.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    }
    
    const rfModel = document.getElementById('rfModel');
    if (rfModel) {
        rfModel.innerHTML = '<option value="">-- Оберіть модель --</option>' +
            window.cartridgeModels.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
    }
}

// ==========================================
// ЗАВАНТАЖЕННЯ КАРТРИДЖІВ
// ==========================================
window.loadCartridgesData = async function() {
    const tbody = document.getElementById('cartridgesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="10" class="refill-loading-state"><div class="refill-spinner"></div><div>Завантаження...</div></td></tr>';

    try {
        const params = new URLSearchParams();
        const status = document.getElementById('filterCartridgeStatus')?.value;
        const model = document.getElementById('filterCartridgeModel')?.value;
        const location = document.getElementById('filterCartridgeLocation')?.value;
        const search = document.getElementById('filterCartridgeSearch')?.value;

        if (status && status !== 'all') params.append('status', status);
        if (model && model !== 'all') params.append('model_id', model);
        if (location && location !== 'all') params.append('location_id', location);
        if (search) params.append('search', search);

        const url = `api.php?action=get_cartridges&${params.toString()}`;
        const response = await fetch(url);
        const data = await response.json();

        window.globalCartridges = Array.isArray(data) ? data : [];
        renderCartridgesTable();
    } catch (err) {
        console.error("Помилка:", err);
        tbody.innerHTML = '<tr><td colspan="10" class="refill-error-state"><div>❌</div><div>Помилка завантаження</div></td></tr>';
    }
};

function renderCartridgesTable() {
    const tbody = document.getElementById('cartridgesTableBody');
    if (!tbody) return;

    const data = window.globalCartridges;
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="refill-empty-state"><div class="refill-empty-icon">💾</div><div>Картриджі не знайдено</div></td></tr>';
        return;
    }

    const statusColors = {
        'in_use': '#10b981', 'in_stock': '#3b82f6', 'for_refill': '#f97316',
        'refilling': '#8b5cf6', 'broken': '#ef4444', 'write_off': '#64748b'
    };
    const statusLabels = {
        'in_use': 'В роботі', 'in_stock': 'В запасі', 'for_refill': 'Очікує заправки',
        'refilling': 'На заправці', 'broken': 'Дефектний', 'write_off': 'Списано'
    };

    tbody.innerHTML = data.map(c => {
        const statusText = statusLabels[c.status] || c.status;
        const statusColor = statusColors[c.status] || '#64748b';
        const isRefilling = c.status === 'refilling';
        const checked = window.selectedCartridges.includes(c.id) ? 'checked' : '';

        return `<tr>
            ${isRefilling ? `
            <td style="width: 40px; text-align: center;">
                <input type="checkbox" class="cartridge-checkbox refill-checkbox" value="${c.id}" ${checked} onchange="window.toggleSelectCartridge(${c.id}, this.checked)">
            </td>
            ` : '<td style="width: 40px;"></td>'}
            <td><span class="refill-status-badge" style="background:${statusColor}">${statusText}</span></td>
            <td><strong>${c.model_name || '-'}</strong></td>
            <td>${c.barcode || '-'}</td>
            <td>${c.serial_number || '-'}</td>
            <td>${c.printer_model ? `${c.printer_model}<br><small>Каб. ${c.room_number || '?'}</small>` : '-'}</td>
            <td>${c.location_name || '-'}</td>
            <td style="text-align:center;">${c.refill_count || 0}</td>
            <td>${c.is_defective ? '<span style="color:#ef4444;">⚠️ Дефект</span>' : '-'}</td>
            <td class="actions-col">
                <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                    ${c.status === 'in_stock' ? `<button class="refill-btn refill-btn-primary" style="padding:6px 12px; font-size:12px;" onclick="window.openCartridgeAction(${c.id}, 'in_use', '📤 Видати')">📤 Видати</button>` : ''}
                    ${c.status === 'in_use' ? `<button class="refill-btn refill-btn-secondary" style="padding:6px 12px; font-size:12px; border-color:#f97316; color:#ea580c;" onclick="window.openCartridgeAction(${c.id}, 'refilling', '🔄 Відправити на заправку')">🔄 Заправити</button>` : ''}
                    ${c.status === 'refilling' ? `<button class="refill-btn refill-btn-secondary" style="padding:6px 12px; font-size:12px; border-color:#059669; color:#059669;" onclick="window.openCartridgeAction(${c.id}, 'in_stock', '📥 Повернути на склад', true)">📥 Повернути</button>` : ''}
                    <button class="refill-btn refill-btn-secondary" onclick="window.showQuickMoveModal(${c.id}, '${c.model_name} (${c.barcode || 'Б/Н'})')" style="padding:6px 12px; font-size:12px;" title="Перемістити">📦</button>
                    <button class="refill-btn refill-btn-secondary" onclick="window.showDefectiveModal(${c.id})" style="padding:6px 12px; font-size:12px; color:#ef4444;" title="Позначити дефект">⚠️</button>
                    <button class="refill-btn refill-btn-secondary" onclick="window.showCartridgeDetails(${c.id})" style="padding:6px 12px; font-size:12px;" title="Історія">👁️</button>
                    <button class="refill-btn refill-btn-secondary" onclick="window.editCartridge(${c.id})" style="padding:6px 12px; font-size:12px;" title="Редагувати">✏️</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    updateBulkReturnButton();
}

// ==========================================
// ДІЇ З КАРТРИДЖЕМ
// ==========================================
window.openCartridgeAction = function(id, newStatus, title, fromRefill = false) {
    const modal = document.getElementById('cartridgeActionModal');
    if (!modal) return;
    
    document.getElementById('actionCartId').value = id;
    document.getElementById('actionCartStatus').value = newStatus;
    document.getElementById('actionFromRefill').value = fromRefill ? '1' : '0';
    document.getElementById('cartActionTitle').innerText = title;

    const notesInput = document.getElementById('actionNotes');
    notesInput.value = '';
    
    const notesLabel = document.getElementById('actionNotesLabel');
    if (newStatus === 'in_use') {
        notesLabel.innerText = "Кому видано (ПІБ / Кабінет)?";
        notesInput.placeholder = "Наприклад: Іванов І.І., каб. 102";
    } else if (newStatus === 'refilling') {
        notesLabel.innerText = "З ким передано / Акт №";
    } else {
        notesLabel.innerText = "Примітки (необов'язково)";
    }
    
    modal.style.display = 'flex';
};

window.submitCartridgeAction = async function(e) {
    e.preventDefault();
    
    const id = document.getElementById('actionCartId').value;
    const status = document.getElementById('actionCartStatus').value;
    const fromRefill = document.getElementById('actionFromRefill').value === '1';
    const notes = document.getElementById('actionNotes').value;

    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'change_cartridge_status',
                id: id,
                status: status,
                notes: notes,
                from_refill: fromRefill
            })
        });
        const result = await response.json();

        if (result.success) {
            showToast("✅ Статус успішно змінено!", "success");
            document.getElementById('cartridgeActionModal').style.display = 'none';
            window.loadCartridgesData();
            window.loadInventoryData();
        } else {
            showToast("Помилка: " + result.error, "error");
        }
    } catch (err) {
        showToast("Помилка зв'язку з сервером", "error");
    }
};

// ==========================================
// ЗАВАНТАЖЕННЯ ПРИНТЕРІВ
// ==========================================
window.loadPrintersData = async function() {
    const tbody = document.getElementById('printersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="refill-loading-state"><div class="refill-spinner"></div><div>Завантаження...</div></td></tr>';

    try {
        const response = await fetch('api.php?action=get_printers');
        const data = await response.json();
        renderPrintersTable(Array.isArray(data) ? data : []);
    } catch (err) {
        console.error("Помилка:", err);
        tbody.innerHTML = '<tr><td colspan="7" class="refill-error-state"><div>❌</div><div>Помилка завантаження</div></td></tr>';
    }
};

function renderPrintersTable(data) {
    const tbody = document.getElementById('printersTableBody');
    if (!tbody) return;
    
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="refill-empty-state"><div class="refill-empty-icon">🖨️</div><div>Принтери не знайдено</div></td></tr>';
        return;
    }

    tbody.innerHTML = data.map(p => `
        <tr>
            <td>${p.location_name || '-'}<br><small>Каб. ${p.room_number || '?'}</small></td>
            <td><strong>${p.printer_model}</strong></td>
            <td>${p.printer_name || '-'}</td>
            <td>${p.ip_address || '-'}</td>
            <td>${p.inv_number || 'Б/Н'}</td>
            <td>
                ${p.current_cartridge_model 
                    ? `<span style="color:#10b981; font-weight:600;">${p.current_cartridge_model}</span><br>
                       <small>Штрихкод: ${p.current_cartridge_barcode || 'Б/Н'}</small>`
                    : '<span style="color:#f97316; font-weight:600;">Немає картриджа</span>'}
            </td>
            <td class="actions-col">
                <div style="display: flex; gap: 5px;">
                    <button class="refill-btn refill-btn-secondary" onclick="window.showPrinterDetails(${p.id})" style="padding:6px 12px; font-size:12px;" title="Деталі">👁️</button>
                    <button class="refill-btn refill-btn-secondary" onclick="window.installCartridge(${p.id})" style="padding:6px 12px; font-size:12px;" title="Встановити картридж">🔧</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ==========================================
// ЗАВАНТАЖЕННЯ ЗАПАСІВ
// ==========================================
window.loadInventoryData = async function() {
    const container = document.getElementById('inventorySummary');
    if (!container) return;
    
    container.innerHTML = '<div class="refill-loading-state"><div class="refill-spinner"></div><div>Завантаження...</div></div>';

    try {
        const response = await fetch('api.php?action=get_inventory_summary');
        const data = await response.json();
        renderInventorySummary(Array.isArray(data) ? data : []);
    } catch (err) {
        console.error("Помилка:", err);
        container.innerHTML = '<div class="refill-error-state"><div>❌</div><div>Помилка завантаження</div></div>';
    }
};

function renderInventorySummary(data) {
    const container = document.getElementById('inventorySummary');
    if (!container) return;
    
    if (!data.length) {
        container.innerHTML = '<div class="refill-empty-state"><div class="refill-empty-icon">📊</div><div>Немає даних</div></div>';
        return;
    }

    let html = '';
    data.forEach(building => {
        const totals = building.totals || {};
        const totalActive = (totals.in_use || 0) + (totals.in_stock || 0);
        const totalProblem = (totals.for_refill || 0) + (totals.refilling || 0) + (totals.defective || 0);

        html += `
            <div class="refill-building-card">
                <div class="refill-building-header">
                    <h3><span>🏢</span> ${building.name || 'Невідома будівля'}</h3>
                    <div class="refill-building-stats">
                        <span class="refill-stat-badge refill-stat-working">✅ Робочі: ${totalActive}</span>
                        <span class="refill-stat-badge refill-stat-problem">⏳ Проблемні: ${totalProblem}</span>
                        <span class="refill-stat-badge refill-stat-total">📊 Всього: ${totals.total || 0}</span>
                    </div>
                </div>
                <div class="refill-models-grid">
        `;

        (building.models || []).forEach(model => {
            html += `
                <div class="refill-model-card">
                    <div class="refill-model-header">
                        <strong>${model.model_name || 'Невідома модель'}</strong>
                        <span class="refill-model-count">${model.total || 0} шт</span>
                    </div>
                    <div class="refill-model-stats">
                        <div class="refill-stat-cell">
                            <div class="refill-stat-number in-use">${model.in_use || 0}</div>
                            <div class="refill-stat-label">В роботі</div>
                        </div>
                        <div class="refill-stat-cell">
                            <div class="refill-stat-number in-stock">${model.in_stock || 0}</div>
                            <div class="refill-stat-label">В запасі</div>
                        </div>
                        <div class="refill-stat-cell">
                            <div class="refill-stat-number refill">${(model.for_refill || 0) + (model.refilling || 0)}</div>
                            <div class="refill-stat-label">На заправці</div>
                        </div>
                        <div class="refill-stat-cell">
                            <div class="refill-stat-number defective">${model.defective || 0}</div>
                            <div class="refill-stat-label">Дефектні</div>
                        </div>
                    </div>
                    <div class="model-actions">
                        <button class="refill-btn refill-btn-secondary" onclick="window.showAddBalanceModal(${building.id || 0}, ${model.model_id || 0}, '${model.model_name || ''}')" style="padding:6px 12px; font-size:12px;">➕ Додати</button>
                        <button class="refill-btn refill-btn-secondary" onclick="window.showModelDetails(${model.model_id || 0}, ${building.id || 0})" style="padding:6px 12px; font-size:12px;">📊 Деталі</button>
                    </div>
                </div>
            `;
        });
        html += `</div></div>`;
    });
    container.innerHTML = html;
}

// ==========================================
// ІСТОРІЯ ЗАПРАВОК
// ==========================================
window.loadRefillHistory = async function() {
    const tbody = document.getElementById('refillHistoryBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" class="refill-loading-state"><div class="refill-spinner"></div><div>Завантаження...</div></td></tr>';
    
    try {
        const response = await fetch('api.php?action=get_refills');
        const data = await response.json();
        window.globalRefillHistory = Array.isArray(data) ? data : [];
        renderRefillHistory();
    } catch (err) {
        console.error("Помилка завантаження історії:", err);
        tbody.innerHTML = '<tr><td colspan="6" class="refill-error-state"><div>❌</div><div>Помилка завантаження</div></td></tr>';
    }
};

function renderRefillHistory() {
    const tbody = document.getElementById('refillHistoryBody');
    if (!tbody) return;
    
    const data = window.globalRefillHistory;
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="refill-empty-state"><div class="refill-empty-icon">📜</div><div>Історія порожня</div></td></tr>';
        return;
    }
    
    tbody.innerHTML = data.map(item => `
        <tr>
            <td>${item.date || '-'}</td>
            <td>${item.location || '-'}</td>
            <td><span style="color:${item.action === 'send' ? '#f97316' : '#10b981'}">${item.action === 'send' ? 'Відправка' : 'Повернення'}</span></td>
            <td>${Array.isArray(item.items) ? item.items.map(i => `${i.model} (${i.barcode || 'Б/Н'})`).join('<br>') : '-'}</td>
            <td><span class="refill-status-badge" style="background:${item.status === 'completed' ? '#10b981' : '#f97316'}">${item.status === 'completed' ? 'Завершено' : 'В обробці'}</span></td>
            <td class="actions-col">
                <button class="refill-btn refill-btn-secondary" style="padding:6px 12px; font-size:11px;" onclick="window.printRefillAct(${item.id})">🖨️ Акт</button>
            </td>
        </tr>
    `).join('');
}

// ==========================================
// ФОРМИ
// ==========================================
window.toggleAddCartridgeForm = function() {
    const form = document.getElementById('addCartridgeInlineForm');
    if (!form) return;
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    if (form.style.display === 'block') window.loadLocations();
};

window.toggleAddPrinterForm = function() {
    const form = document.getElementById('addPrinterInlineForm');
    if (!form) return;
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    if (form.style.display === 'block') window.loadLocations();
};

window.showQuickMoveModal = function(id, info) {
    document.getElementById('addCartridgeInlineForm').style.display = 'none';
    document.getElementById('defectiveInlineForm').style.display = 'none';
    document.getElementById('moveCartridgeId').value = id;
    document.getElementById('quickMoveCartridgeInfo').innerHTML = info;
    loadLocationsForMove();
    loadPrintersForMove();
    document.getElementById('quickMoveInlineForm').style.display = 'block';
};

window.closeQuickMoveModal = function() {
    document.getElementById('quickMoveInlineForm').style.display = 'none';
    document.getElementById('quickMoveForm')?.reset();
};

window.showDefectiveModal = function(id) {
    document.getElementById('addCartridgeInlineForm').style.display = 'none';
    document.getElementById('quickMoveInlineForm').style.display = 'none';
    document.getElementById('defectiveCartridgeId').value = id;
    document.getElementById('defectiveInlineForm').style.display = 'block';
};

window.closeDefectiveModal = function() {
    document.getElementById('defectiveInlineForm').style.display = 'none';
    document.getElementById('defectiveForm')?.reset();
};

// ==========================================
// ЛОГІКА ЗАЯВОК (КОШИК)
// ==========================================
window.addRefillItem = function() {
    const modelSelect = document.getElementById('rfModel');
    const barcodeInput = document.getElementById('rfCartNum');
    const model = modelSelect ? modelSelect.value : '';
    const barcode = barcodeInput ? barcodeInput.value.trim() : '';

    if (!model) {
        showToast("Будь ласка, оберіть модель картриджа!", "warning");
        return;
    }

    window.refillCart.push({
        id: Date.now(),
        model: model,
        barcode: barcode
    });

    if (modelSelect) modelSelect.value = '';
    if (barcodeInput) barcodeInput.value = '';
    renderRefillCart();
};

window.removeRefillItem = function(id) {
    window.refillCart = window.refillCart.filter(item => item.id !== id);
    renderRefillCart();
};

function renderRefillCart() {
    const tbody = document.getElementById('refillCartBody');
    if (!tbody) return;
    
    if (window.refillCart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="refill-empty-state"><div class="refill-empty-icon">🛒</div><div>Кошик порожній</div><div style="font-size:12px;">Додайте картриджі вище</div></td></tr>';
    } else {
        tbody.innerHTML = window.refillCart.map((item) => `
            <tr>
                <td><strong>${item.model}</strong></td>
                <td>${item.barcode || '—'}</td>
                <td style="text-align: right;">
                    <button type="button" class="refill-btn refill-btn-secondary" style="color: #ef4444; border-color: #fca5a5; padding: 4px 8px; font-size: 11px;" onclick="window.removeRefillItem(${item.id})">❌ Видалити</button>
                </td>
            </tr>
        `).join('');
    }
    
    const cartCount = document.getElementById('cartCount');
    if (cartCount) cartCount.innerText = window.refillCart.length;
}

// ==========================================
// ІНІЦІАЛІЗАЦІЯ
// ==========================================
function initRefillModule() {
    console.log("initRefillModule запущено");
    
    window.loadLocations();
    window.loadCartridgeModels();
    
    initAddCartridgeForm();
    initQuickMoveForm();
    initDefectiveForm();
    initAddPrinterForm();
    initRefillForm();
    initAutocomplete();
    
    // Активуємо першу вкладку
    const activeTab = document.querySelector('.refill-tab-btn.active');
    if (activeTab) {
        const tabText = activeTab.textContent;
        if (tabText.includes('Заявки')) window.switchRefillTab('request');
        else if (tabText.includes('Картриджі')) window.switchRefillTab('cartridges');
        else if (tabText.includes('Принтери')) window.switchRefillTab('printers');
        else if (tabText.includes('Запаси')) window.switchRefillTab('inventory');
    } else {
        // Якщо немає активної, активуємо першу
        const firstTab = document.querySelector('.refill-tab-btn');
        if (firstTab) firstTab.click();
    }
}

// ==========================================
// ІНІЦІАЛІЗАЦІЯ ФОРМ
// ==========================================
function initAddCartridgeForm() {
    const form = document.getElementById('addCartridgeForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const modelInput = document.getElementById('cartridgeModelInput');
        const modelId = modelInput.dataset.modelId;
        const editId = form.dataset.editId;

        if (!modelId) {
            showToast("Виберіть або створіть модель", "error");
            return;
        }

        const data = {
            model_id: modelId,
            barcode: document.getElementById('cartridgeBarcode').value,
            serial_number: document.getElementById('cartridgeSerial').value,
            status: document.getElementById('cartridgeStatus').value,
            location_id: document.getElementById('cartridgeLocation').value,
            purchase_date: document.getElementById('cartridgePurchaseDate').value,
            notes: document.getElementById('cartridgeNotes').value
        };

        const actionName = editId ? 'edit_cartridge' : 'add_cartridge';
        if (editId) data.id = editId;

        try {
            const response = await fetch('api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: actionName, ...data })
            });
            const result = await response.json();

            if (result.success) {
                showToast(editId ? "Картридж оновлено!" : "Картридж додано!", "success");
                form.reset();
                modelInput.value = '';
                modelInput.dataset.modelId = '';
                form.dataset.editId = '';
                window.toggleAddCartridgeForm();
                window.loadCartridgesData();
                window.loadInventoryData();
            } else {
                throw new Error(result.error || "Помилка збереження");
            }
        } catch (err) {
            showToast("Помилка: " + err.message, "error");
        }
    });
}

function initQuickMoveForm() {
    const form = document.getElementById('quickMoveForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            cartridge_id: document.getElementById('moveCartridgeId').value,
            to_location_id: document.getElementById('moveLocation').value,
            to_printer_id: document.getElementById('movePrinter').value || null,
            notes: document.getElementById('moveNotes').value
        };
        
        if (!data.to_location_id && !data.to_printer_id) {
            showToast("Оберіть куди перемістити картридж", "error");
            return;
        }
        
        try {
            const response = await fetch('api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'quick_move_cartridge', ...data })
            });
            const result = await response.json();
            if (result.success) {
                showToast("Картридж переміщено!", "success");
                window.closeQuickMoveModal();
                window.loadCartridgesData();
                window.loadInventoryData();
            } else {
                throw new Error(result.error || "Помилка переміщення");
            }
        } catch (err) {
            showToast("Помилка: " + err.message, "error");
        }
    });
}

function initDefectiveForm() {
    const form = document.getElementById('defectiveForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            id: document.getElementById('defectiveCartridgeId').value,
            reason: document.getElementById('defectReason').value
        };
        
        try {
            const response = await fetch('api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'mark_defective', ...data })
            });
            const result = await response.json();
            if (result.success) {
                showToast("Картридж позначено як дефектний", "success");
                window.closeDefectiveModal();
                window.loadCartridgesData();
                window.loadInventoryData();
            } else {
                throw new Error(result.error || "Помилка");
            }
        } catch (err) {
            showToast("Помилка: " + err.message, "error");
        }
    });
}

function initAddPrinterForm() {
    const form = document.getElementById('addPrinterForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            location_id: document.getElementById('printerLocation').value,
            room_number: document.getElementById('printerRoom').value,
            model: document.getElementById('printerModel').value,
            printer_name: document.getElementById('printerName').value,
            ip_address: document.getElementById('printerIP').value,
            inv_number: document.getElementById('printerInv').value,
            serial_number: document.getElementById('printerSerial').value,
            notes: document.getElementById('printerNotes').value
        };
        
        if (!data.location_id || !data.room_number || !data.model) {
            showToast("Заповніть обов'язкові поля", "error");
            return;
        }
        
        try {
            const response = await fetch('api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add_printer', ...data })
            });
            const result = await response.json();
            if (result.success) {
                showToast("Принтер додано!", "success");
                window.toggleAddPrinterForm();
                window.loadPrintersData();
            } else {
                throw new Error(result.error || "Помилка додавання");
            }
        } catch (err) {
            showToast("Помилка: " + err.message, "error");
        }
    });
}

function initRefillForm() {
    const form = document.getElementById('refillForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (window.refillCart.length === 0) {
            showToast("Кошик порожній!", "error");
            return;
        }
        
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerText;
        btn.innerText = '⏳ Обробка...';
        btn.disabled = true;

        const data = {
            action_type: document.getElementById('rfAction')?.value || 'send',
            location_id: document.getElementById('rfLocation')?.value,
            person: document.getElementById('rfPerson')?.value || '',
            notes: '',
            items: window.refillCart
        };

        try {
            const response = await fetch('api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create_refill_request', ...data })
            });
            const result = await response.json();

            if (result.success) {
                showToast("Заявку створено!", "success");
                window.refillCart = [];
                renderRefillCart();
                form.reset();
                window.loadRefillHistory();
                window.loadInventoryData();
            } else {
                throw new Error(result.error || "Помилка сервера");
            }
        } catch (err) {
            showToast("Помилка: " + err.message, "error");
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

function initAutocomplete() {
    const input = document.getElementById('cartridgeModelInput');
    const dropdown = document.getElementById('modelDropdown');
    if (!input || !dropdown) return;
    
    const container = input.closest('.refill-field');
    if (container) container.style.position = 'relative';
    
    dropdown.style.zIndex = '999999';
    
    input.addEventListener('focus', async () => {
        await window.loadCartridgeModels();
        showModelDropdown(input.value);
    });
    
    input.addEventListener('input', () => showModelDropdown(input.value));
    
    document.addEventListener('click', (e) => {
        if (e.target !== input && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

function showModelDropdown(searchText = '') {
    const dropdown = document.getElementById('modelDropdown');
    if (!dropdown || !window.cartridgeModels) return;
    
    const searchLower = searchText.toLowerCase();
    const filtered = window.cartridgeModels.filter(m => 
        m.name.toLowerCase().includes(searchLower)
    );
    
    let html = '';
    filtered.forEach(model => {
        html += `<div class="autocomplete-item" onclick="window.selectModel('${model.name}', ${model.id})">${model.name}</div>`;
    });
    
    if (filtered.length === 0 && searchText.trim()) {
        html += `<div class="autocomplete-item new" onclick="window.createNewModel('${searchText}')">➕ Створити нову модель: "${searchText}"</div>`;
    }
    
    dropdown.innerHTML = html;
    dropdown.style.display = html ? 'block' : 'none';
}

window.selectModel = (name, id) => {
    const input = document.getElementById('cartridgeModelInput');
    if (input) {
        input.value = name;
        input.dataset.modelId = id;
        document.getElementById('modelDropdown').style.display = 'none';
    }
};

window.createNewModel = async (name) => {
    const id = await window.addNewCartridgeModel(name);
    if (id) {
        const input = document.getElementById('cartridgeModelInput');
        input.value = name;
        input.dataset.modelId = id;
        document.getElementById('modelDropdown').style.display = 'none';
    }
};

window.addNewCartridgeModel = async function(name) {
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add_cartridge_model', name: name })
        });
        const result = await response.json();
        if (result.success) {
            showToast(`Модель "${name}" додано!`, "success");
            await window.loadCartridgeModels();
            return result.id;
        } else {
            throw new Error(result.error || "Помилка");
        }
    } catch (err) {
        showToast("Помилка: " + err.message, "error");
        return null;
    }
};

// ==========================================
// ДОПОМІЖНІ ФУНКЦІЇ
// ==========================================
window.applyCartridgeFilters = () => window.loadCartridgesData();
window.exportCartridges = () => window.location.href = 'api.php?action=export_cartridges';
window.printRefillAct = (id) => showToast("Функція друку в розробці", "info");

window.showCartridgeDetails = async (id) => {
    showToast("Завантаження...", "info");
    try {
        const response = await fetch(`api.php?action=get_cartridge_history&id=${id}`);
        const data = await response.json();
        let html = '';
        if (data.success && data.history?.length) {
            html = '<ul>' + data.history.map(h => `<li><b>${h.date}</b>: ${h.action}</li>`).join('') + '</ul>';
        } else {
            html = '<p>Історія порожня</p>';
        }
        showInlineDetails('refill-cartridges', '📄 Історія', html);
    } catch (err) {
        showToast("Помилка", "error");
    }
};

window.editCartridge = async (id) => {
    try {
        const response = await fetch(`api.php?action=get_cartridge&id=${id}`);
        const data = await response.json();
        if (data.success && data.cartridge) {
            const c = data.cartridge;
            window.toggleAddCartridgeForm();
            setTimeout(() => {
                document.getElementById('addCartridgeInlineForm').querySelector('h3').innerHTML = '✏️ Редагувати картридж';
                document.getElementById('cartridgeModelInput').value = c.model_name || '';
                document.getElementById('cartridgeModelInput').dataset.modelId = c.model_id || '';
                document.getElementById('cartridgeBarcode').value = c.barcode || '';
                document.getElementById('cartridgeSerial').value = c.serial_number || '';
                document.getElementById('cartridgeStatus').value = c.status || 'in_stock';
                document.getElementById('cartridgeLocation').value = c.location_id || '';
                if (c.purchase_date) {
                    document.getElementById('cartridgePurchaseDate').value = c.purchase_date.split(' ')[0];
                }
                document.getElementById('cartridgeNotes').value = c.notes || '';
                document.getElementById('addCartridgeForm').dataset.editId = id;
            }, 100);
        }
    } catch (err) {
        showToast("Помилка", "error");
    }
};

window.showPrinterDetails = async (id) => {
    showToast("Завантаження...", "info");
    try {
        const response = await fetch(`api.php?action=get_printer_history&id=${id}`);
        const data = await response.json();
        let html = '';
        if (data.success && data.history?.length) {
            html = '<ul>' + data.history.map(h => `<li><b>${h.date}</b>: ${h.action}</li>`).join('') + '</ul>';
        } else {
            html = '<p>Історія порожня</p>';
        }
        showInlineDetails('refill-printers', '🖨️ Історія принтера', html);
    } catch (err) {
        showToast("Помилка", "error");
    }
};

window.installCartridge = async (printerId) => {
    const barcode = prompt("Введіть штрихкод картриджа:");
    if (!barcode) return;
    try {
        const response = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'install_cartridge', printer_id: printerId, barcode: barcode })
        });
        const result = await response.json();
        if (result.success) {
            showToast("Картридж встановлено!", "success");
            window.loadPrintersData();
        } else {
            showToast(result.error || "Помилка", "error");
        }
    } catch (err) {
        showToast("Помилка сервера", "error");
    }
};

window.showAddBalanceModal = (locId, modelId, modelName) => {
    window.toggleAddCartridgeForm();
    setTimeout(() => {
        const modelInput = document.getElementById('cartridgeModelInput');
        const locationSelect = document.getElementById('cartridgeLocation');
        if (modelInput && modelId) {
            const model = window.cartridgeModels.find(m => m.id == modelId);
            if (model) {
                modelInput.value = model.name;
                modelInput.dataset.modelId = model.id;
            }
        }
        if (locationSelect && locId) locationSelect.value = locId;
    }, 100);
};

window.showModelDetails = async (modelId, locId) => {
    showToast("Статистика моделі", "info");
    // Тут можна додати реальний запит
    showInlineDetails('refill-inventory', '📊 Статистика', '<p>Дані в розробці</p>');
};

function showInlineDetails(tabId, title, html) {
    const old = document.getElementById('dynamicInlineDetails');
    if (old) old.remove();
    const tab = document.getElementById(tabId);
    if (!tab) return;
    const div = document.createElement('div');
    div.id = 'dynamicInlineDetails';
    div.className = 'refill-card';
    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
            <h3>${title}</h3>
            <button class="refill-btn refill-btn-secondary" onclick="this.parentElement.parentElement.remove()">✖</button>
        </div>
        <div>${html}</div>
    `;
    tab.insertAdjacentElement('afterbegin', div);
}

async function loadLocationsForMove() {
    const select = document.getElementById('moveLocation');
    if (!select) return;
    try {
        const response = await fetch('api.php?action=get_locations');
        const data = await response.json();
        if (Array.isArray(data)) {
            select.innerHTML = '<option value="">-- Оберіть будівлю --</option>' +
                data.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadPrintersForMove() {
    const select = document.getElementById('movePrinter');
    if (!select) return;
    try {
        const response = await fetch('api.php?action=get_printers');
        const data = await response.json();
        if (Array.isArray(data)) {
            select.innerHTML = '<option value="">-- Не встановлювати в принтер --</option>' +
                data.map(p => `<option value="${p.id}">${p.location_name || '?'} / Каб.${p.room_number || '?'} - ${p.printer_model}</option>`).join('');
        }
    } catch (err) {
        console.error(err);
    }
}

// ==========================================
// ЗАПУСК
// ==========================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRefillModule);
} else {
    initRefillModule();
}
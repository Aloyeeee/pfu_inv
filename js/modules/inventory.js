// js/modules/inventory.js
import { apiRequest } from './database.js'; 
import { logAction } from './audit.js';
import { showToast } from '../ui/ui-components.js';

let currentFilteredInventory = []; 
let invSortCol = 'location';
let invSortAsc = true;
let invCurrentPage = 1;
let invItemsPerPage = 50;

// ==========================================
// ЗАВАНТАЖЕННЯ ДАНИХ
// ==========================================
window.loadInventoryCrispy = async () => {
    const tbody = document.getElementById('inventoryTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 40px;">⏳ Завантаження...</td></tr>';
    
    try {
        const response = await fetch('api.php?action=get_inventory&limit=999999&offset=0');
        const data = await response.json();
        
        window.globalInventory = data || [];
        window.updateInventoryFilters();
        window.renderInventoryTable();
        
    } catch (err) {
        console.error("Помилка завантаження:", err);
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 40px; color: red;">❌ Помилка завантаження</td></tr>';
    }
};

// ==========================================
// ОНОВЛЕННЯ ФІЛЬТРІВ
// ==========================================
window.updateInventoryFilters = () => {
    if (!window.globalInventory || !Array.isArray(window.globalInventory)) return;
    
    const locations = new Set();
    const persons = new Set();
    
    window.globalInventory.forEach(item => {
        if (item.location) locations.add(item.location);
        if (item.person && item.person !== 'Не закріплено') persons.add(item.person);
    });
    
    const locFilter = document.getElementById('filterLoc1');
    if (locFilter) {
        locFilter.innerHTML = '<option value="all">Всі локації</option>' + 
            Array.from(locations).sort().map(l => `<option value="${l}">${l}</option>`).join('');
    }
    
    const personFilter = document.getElementById('invFilterPerson');
    if (personFilter) {
        personFilter.innerHTML = '<option value="all">Всі МВО</option>' + 
            Array.from(persons).sort().map(p => `<option value="${p}">${p}</option>`).join('');
    }
};

// ==========================================
// РЕНДЕРИНГ ТАБЛИЦІ
// ==========================================
window.renderInventoryTable = () => {
    const tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;
    
    if (!window.globalInventory || window.globalInventory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:40px;">📭 Немає даних</td></tr>';
        return;
    }
    
    // Фільтрація
    let filtered = [...window.globalInventory];
    
    const locFilter = document.getElementById('filterLoc1')?.value;
    if (locFilter && locFilter !== 'all') {
        filtered = filtered.filter(i => i.location === locFilter);
    }
    
    const statusFilter = document.getElementById('invFilterStatus')?.value;
    if (statusFilter && statusFilter !== 'all') {
        filtered = filtered.filter(i => i.status === statusFilter);
    }
    
    const personFilter = document.getElementById('invFilterPerson')?.value;
    if (personFilter && personFilter !== 'all') {
        filtered = filtered.filter(i => i.person === personFilter);
    }
    
    const invTypeFilter = document.getElementById('invFilterInvType')?.value;
    if (invTypeFilter && invTypeFilter !== 'all') {
        if (invTypeFilter === 'no_inv') {
            filtered = filtered.filter(i => !i.inv || i.inv === 'Б/Н');
        } else if (invTypeFilter === 'has_inv') {
            filtered = filtered.filter(i => i.inv && i.inv !== 'Б/Н');
        } else if (invTypeFilter === 'auto_inv') {
            filtered = filtered.filter(i => i.isAutoIndexed == 1);
        }
    }
    
    const search = document.getElementById('invSearch')?.value.toLowerCase();
    if (search) {
        filtered = filtered.filter(i => 
            (i.name && i.name.toLowerCase().includes(search)) ||
            (i.inv && i.inv.toLowerCase().includes(search)) ||
            (i.person && i.person.toLowerCase().includes(search)) ||
            (i.sn && i.sn.toLowerCase().includes(search))
        );
    }
    
    // Сортування
    filtered.sort((a, b) => {
        let valA = a[invSortCol] || '';
        let valB = b[invSortCol] || '';
        
        if (invSortCol === 'price') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
        } else if (invSortCol === 'startDate') {
            valA = a.startDate ? new Date(a.startDate) : new Date(0);
            valB = b.startDate ? new Date(b.startDate) : new Date(0);
        } else {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }
        
        if (valA < valB) return invSortAsc ? -1 : 1;
        if (valA > valB) return invSortAsc ? 1 : -1;
        return 0;
    });
    
    currentFilteredInventory = filtered;
    
    // Пагінація
    const itemsPerPage = invItemsPerPage === 'all' ? filtered.length : parseInt(invItemsPerPage);
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
    
    if (invCurrentPage > totalPages) invCurrentPage = totalPages;
    if (invCurrentPage < 1) invCurrentPage = 1;
    
    const start = (invCurrentPage - 1) * itemsPerPage;
    const pageData = filtered.slice(start, start + itemsPerPage);
    
    // Рендеринг
    let html = '';
    pageData.forEach(item => {
        const statusColor = item.status === 'В роботі' ? '#10b981' : 
                           (item.status === 'В ремонті' ? '#f97316' : 
                           (item.status === 'Списано' ? '#ef4444' : 
                           (item.status === 'Для списання' ? '#dc2626' : '#64748b')));
        
        const invDisplay = item.inv && item.inv !== 'Б/Н' ? 
            `<span style="color:var(--primary); font-weight:600;">${item.inv}</span>` : 
            '<span style="color:#f59e0b;">Б/Н</span>';
        
        html += `
        <tr>
            <td data-label="Локація"><b>${item.location || 'Склад'}</b></td>
            <td data-label="Обладнання"><b>${item.name || item.model || '-'}</b><br><span style="font-size:11px; color:#64748b;">${item.type || ''}</span></td>
            <td data-label="Номери">${invDisplay}<br>${item.sn ? 'S/N: ' + item.sn : ''}</td>
            <td data-label="МВО">${item.person || '-'}</td>
            <td data-label="Введено">${item.startDate ? new Date(item.startDate).toLocaleDateString('uk-UA') : '-'}</td>
            <td data-label="Ціна"><b>${item.price ? parseFloat(item.price).toFixed(2) + ' ₴' : '-'}</b></td>
            <td data-label="Статус"><span style="color:${statusColor};">● ${item.status || 'На складі'}</span></td>
            <td data-label="Дії" class="actions-col" style="display: flex; flex-direction: column; gap: 5px; min-width: 250px;">
                <div style="display: flex; gap: 5px; width: 100%;">
                    <button class="btn-secondary" style="flex: 1; padding: 6px 8px; font-size: 12px;" onclick="window.editInv(${item.id})">✏️ Редагувати</button>
                    <button class="btn-secondary" style="flex: 1; padding: 6px 8px; font-size: 12px; color: #ef4444;" onclick="window.deleteInv(${item.id})">🗑️ Видалити</button>
                </div>
                <div style="display: flex; gap: 5px; width: 100%;">
                    <button class="btn-secondary" style="flex: 1; padding: 6px 8px; font-size: 12px;" onclick="window.openNoteModal('inventory', '${item.id}', '${item.name || item.model || 'Техніка'}')">📝 Примітка</button>
                    <button class="btn-secondary" style="flex: 1; padding: 6px 8px; font-size: 12px;" onclick="window.openSpecsModal('${item.id}')">📊 Характеристики</button>
                </div>
            </td>
        </tr>`;
    });
    
    tbody.innerHTML = html || '<tr><td colspan="8" style="text-align:center;">❓ Нічого не знайдено</td></tr>';
    
    // Оновлюємо пагінацію
    const pageInfo = document.getElementById('invPageInfo');
    if (pageInfo) pageInfo.innerText = `Сторінка ${invCurrentPage} з ${totalPages} (Всього: ${filtered.length})`;
    
    const prevBtn = document.getElementById('invPrevPage');
    const nextBtn = document.getElementById('invNextPage');
    if (prevBtn) prevBtn.disabled = invCurrentPage === 1;
    if (nextBtn) nextBtn.disabled = invCurrentPage === totalPages;
};

// ==========================================
// ЕКСПОРТ (ВИПРАВЛЕНО)
// ==========================================

// Стара функція для сумісності
window.exportInventoryToExcel = () => {
    window.openExportModal();
};

// ==========================================
// ЕКСПОРТ З ВИБОРОМ ПОЛІВ (СКЛАД)
// ==========================================
// ==========================================
// ЕКСПОРТ З ВИБОРОМ ПОЛІВ (СКЛАД) - САМОВІДНОВЛЮВАЛЬНЕ ВІКНО
// ==========================================
window.openExportModal = () => {
    let modal = document.getElementById('exportModal');
    
    // Якщо вікно випадково стерлося з HTML, JS створює його самостійно
    if (!modal) {
        const modalHtml = `
        <div id="exportModal" class="modal">
            <div class="modal-content small">
                <div class="modal-header">
                    <h2>📥 Експорт складу в Excel</h2>
                    <button class="btn-secondary" onclick="window.closeExportModal()" style="padding: 6px 12px;">✖ Закрити</button>
                </div>
                <div class="modal-body">
                    <p style="color: #64748b; margin-bottom: 15px;">Експортується <b id="exportItemsCount" style="color: #0ea5e9;">0</b> записів (поточний фільтр):</p>
                    <div class="export-fields-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <label class="custom-checkbox"><input type="checkbox" name="exportField" value="location" checked> 🏢 Локація</label>
                        <label class="custom-checkbox"><input type="checkbox" name="exportField" value="type" checked> 💻 Тип</label>
                        <label class="custom-checkbox"><input type="checkbox" name="exportField" value="model" checked> 📱 Модель</label>
                        <label class="custom-checkbox"><input type="checkbox" name="exportField" value="inv" checked> 🔢 Інвентарний №</label>
                        <label class="custom-checkbox"><input type="checkbox" name="exportField" value="sn"> 🔢 Серійний №</label>
                        <label class="custom-checkbox"><input type="checkbox" name="exportField" value="person" checked> 👤 МВО</label>
                        <label class="custom-checkbox"><input type="checkbox" name="exportField" value="startDate"> 📅 Дата введення</label>
                        <label class="custom-checkbox"><input type="checkbox" name="exportField" value="price" checked> 💰 Ціна</label>
                        <label class="custom-checkbox"><input type="checkbox" name="exportField" value="status" checked> 📊 Статус</label>
                    </div>
                </div>
                <div class="modal-footer" style="justify-content: space-between;">
                    <div style="display: flex; gap: 10px;">
                        <button class="btn-secondary" onclick="document.querySelectorAll('#exportModal input[name=exportField]').forEach(cb => cb.checked = true)">✅ Всі</button>
                        <button class="btn-secondary" onclick="document.querySelectorAll('#exportModal input[name=exportField]').forEach(cb => cb.checked = false)">❌ Жодного</button>
                    </div>
                    <button class="btn-primary" onclick="window.exportFilteredInventory()">📥 Завантажити</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = document.getElementById('exportModal');
    }
    
    // Оновлюємо кількість записів
    const countEl = document.getElementById('exportItemsCount');
    if (countEl) {
        countEl.innerText = currentFilteredInventory ? currentFilteredInventory.length : 0;
    }
    
    modal.style.display = 'flex';
    modal.style.zIndex = '10000';
};

window.closeExportModal = () => {
    const modal = document.getElementById('exportModal');
    if (modal) modal.style.display = 'none';
};

window.exportFilteredInventory = () => {
    // 1. Перевірка наявності даних
    if (!currentFilteredInventory || currentFilteredInventory.length === 0) {
        showToast("Немає даних для експорту. Змініть фільтри.", "error");
        return;
    }
    
    // 2. Збір вибраних полів з модального вікна
    const selectedFields = [];
    document.querySelectorAll('#exportModal input[name="exportField"]:checked').forEach(cb => {
        selectedFields.push(cb.value);
    });
    
    if (selectedFields.length === 0) {
        showToast("Виберіть хоча б одне поле для експорту", "error");
        return;
    }
    
    // 3. Мапінг назв колонок
    const fieldMap = {
        'location': 'Локація',
        'type': 'Тип',
        'model': 'Модель',
        'inv': 'Інвентарний №',
        'sn': 'Серійний №',
        'person': 'МВО',
        'startDate': 'Дата введення',
        'price': 'Ціна (грн)',
        'status': 'Статус'
    };
    
    // 4. Формування даних для Excel
    const exportData = currentFilteredInventory.map(item => {
        const row = {};
        selectedFields.forEach(field => {
            const header = fieldMap[field] || field;
            let value = '-';
            
            switch(field) {
                case 'location': value = item.location || 'Склад'; break;
                case 'type': value = item.type || '-'; break;
                case 'model': value = item.name || item.model || '-'; break;
                case 'inv': value = (!item.inv || item.inv === 'Б/Н') ? 'Б/Н' : item.inv; break;
                case 'sn': value = item.sn || '-'; break;
                case 'person': value = item.person || '-'; break;
                case 'startDate': value = item.startDate ? new Date(item.startDate).toLocaleDateString('uk-UA') : '-'; break;
                case 'price': value = item.price ? parseFloat(item.price).toFixed(2) : '0.00'; break;
                case 'status': value = item.status || 'На складі'; break;
                default: value = item[field] ?? '-';
            }
            row[header] = value;
        });
        return row;
    });
    
    // 5. Генерація Excel файлу
    try {
        const xlsxLib = typeof XLSX !== 'undefined' ? XLSX : window.XLSX;
        if (!xlsxLib) {
            showToast("Бібліотека XLSX не завантажена", "error");
            return;
        }

        const ws = xlsxLib.utils.json_to_sheet(exportData);
        
        // Автоматичне налаштування ширини колонок
        const colWidths = [];
        selectedFields.forEach(field => {
            const headerText = fieldMap[field];
            // Знаходимо найдовший рядок у кожній колонці
            let maxLength = headerText.length;
            exportData.forEach(row => {
                const cellValue = String(row[headerText] || '');
                if (cellValue.length > maxLength) maxLength = cellValue.length;
            });
            colWidths.push({ wch: maxLength + 2 }); // +2 для відступів
        });
        ws['!cols'] = colWidths;

        const wb = xlsxLib.utils.book_new();
        xlsxLib.utils.book_append_sheet(wb, ws, 'Склад');
        
        const dateStr = new Date().toLocaleDateString('uk-UA').replace(/\./g, '-');
        xlsxLib.writeFile(wb, `Sklad_PFU_${dateStr}.xlsx`);
        
        showToast(`✅ Експортовано ${exportData.length} записів`, 'success');
        window.closeExportModal();
    } catch (e) {
        console.error("Помилка експорту складу:", e);
        showToast('Помилка експорту: ' + e.message, 'error');
    }
};

// Швидкий експорт всіх полів
window.exportAllInventory = () => {
    if (!currentFilteredInventory.length) {
        showToast('Немає даних для експорту', 'error');
        return;
    }
    
    try {
        const data = currentFilteredInventory.map(item => ({
            'Локація': item.location || 'Склад',
            'Тип': item.type || '-',
            'Модель': item.name || item.model || '-',
            'Інвентарний №': item.inv || 'Б/Н',
            'Серійний №': item.sn || '-',
            'МВО': item.person || '-',
            'Дата введення': item.startDate ? new Date(item.startDate).toLocaleDateString('uk-UA') : '-',
            'Ціна': item.price ? parseFloat(item.price).toFixed(2) : '0.00',
            'Статус': item.status || 'На складі'
        }));
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Склад');
        
        ws['!cols'] = [
            { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, 
            { wch: 18 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 15 }
        ];
        
        const dateStr = new Date().toLocaleDateString('uk-UA').replace(/\./g, '-');
        XLSX.writeFile(wb, `inventory_all_${dateStr}.xlsx`);
        
        showToast(`✅ Експортовано ${data.length} записів`, 'success');
        
    } catch (e) {
        console.error("Помилка експорту:", e);
        showToast('Помилка експорту: ' + e.message, 'error');
    }
};

// ==========================================
// ПРИМІТКИ
// ==========================================
window.openNoteModal = (targetType, targetId, title) => {
    console.log(`Відкриття приміток: ${targetType} ID: ${targetId}`);
    
    const modal = document.getElementById('noteModal');
    if (!modal) {
        showToast("Помилка: модальне вікно не знайдено", "error");
        return;
    }
    
    document.getElementById('noteModalTitle').innerText = title || 'Примітки';
    document.getElementById('noteTargetType').value = targetType;
    document.getElementById('noteTargetId').value = targetId;
    
    // Завантажуємо існуючі примітки
    loadNotes(targetType, targetId);
    
    modal.style.display = 'flex';
};

window.closeNoteModal = () => {
    const modal = document.getElementById('noteModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('noteForm').reset();
    }
};

async function loadNotes(targetType, targetId) {
    const container = document.getElementById('noteListContainer');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 20px;"><p>⏳ Завантаження...</p></div>';
    
    const paramMap = {
        'inventory': 'inventory_id',
        'room': 'room_id',
        'transfer': 'transfer_id',
        'laptop': 'laptop_id'
    };
    
    let url = 'api.php?action=get_notes';
    if (targetType && targetId && paramMap[targetType]) {
        url += `&${paramMap[targetType]}=${targetId}`;
    }
    
    try {
        const response = await fetch(url);
        const notes = await response.json();
        
        if (!notes || notes.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px;"><p style="color:var(--text-muted);">📭 Немає приміток</p></div>';
            return;
        }
        
        let html = '';
        notes.forEach(note => {
            const date = new Date(note.created_at).toLocaleString('uk-UA');
            html += `
                <div style="border-bottom:1px solid var(--border-light); padding:15px 0;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <div>
                            <strong style="color:var(--primary);">${note.creator_name || 'Система'}</strong>
                            ${note.is_private ? '<span style="background:#f97316; color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:5px;">🔒</span>' : ''}
                        </div>
                        <span style="color:var(--text-muted); font-size:11px;">🕒 ${date}</span>
                    </div>
                    <div style="font-size:13px; white-space:pre-wrap; background:var(--bg-body); padding:10px; border-radius:8px;">
                        ${note.note_text.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
        
    } catch (err) {
        console.error("Помилка завантаження приміток:", err);
        container.innerHTML = '<div style="text-align: center; padding: 20px;"><p style="color:#ef4444;">❌ Помилка завантаження</p></div>';
    }
}

// ==========================================
// ХАРАКТЕРИСТИКИ
// ==========================================
window.openSpecsModal = (id) => {
    console.log("openSpecsModal called with id:", id);
    
    const item = window.globalInventory.find(i => String(i.id) === String(id));
    
    if (!item) {
        console.error("Запис не знайдено:", id);
        showToast(`Запис з ID ${id} не знайдено`, "error");
        return;
    }
    
    // Для складу характеристики можуть бути в іншому місці
    showToast("Характеристики для складу в розробці", "info");
};

window.closeSpecsModal = () => {
    const modal = document.getElementById('specsModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// ==========================================
// ІМПОРТ CSV
// ==========================================
window.import1CInventory = function() {
    console.log("import1CInventory викликано");
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv, .txt';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // Показуємо прогрес-бар
        const progCont = document.getElementById('importProgressContainer');
        const progBar = document.getElementById('importProgressBar');
        const statusText = document.getElementById('importStatusText');
        
        if (progCont) progCont.style.display = 'block';
        if (progBar) progBar.style.width = '0%';
        if (statusText) statusText.innerText = 'Читання файлу...';
        
        const reader = new FileReader();
        
        reader.onload = async function(event) {
            try {
                const text = event.target.result;
                
                // Відправляємо на сервер через FormData
                const formData = new FormData();
                formData.append('file', file);
                
                if (statusText) statusText.innerText = 'Відправка на сервер...';
                if (progBar) progBar.style.width = '30%';
                
                const response = await fetch('api.php?action=import_inventory_csv', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.error) {
                    throw new Error(result.error);
                }
                
                if (progBar) progBar.style.width = '100%';
                
                if (statusText) {
                    statusText.innerHTML = `✅ ${result.message || 'Імпорт завершено!'}`;
                }
                
                if (typeof logAction === 'function') {
                    await logAction("Склад", `Імпорт CSV: додано ${result.added || 0}, оновлено ${result.updated || 0}`);
                }
                
                setTimeout(() => {
                    if (progCont) progCont.style.display = 'none';
                }, 2000);
                
                await window.loadInventoryCrispy();
                
            } catch (err) {
                console.error("Помилка:", err);
                if (statusText) {
                    statusText.innerHTML = `❌ Помилка: ${err.message}`;
                }
                setTimeout(() => {
                    if (progCont) progCont.style.display = 'none';
                }, 3000);
            }
        };
        
        reader.readAsText(file, 'UTF-8');
    };
    
    input.click();
};

// ==========================================
// СОРТУВАННЯ
// ==========================================
window.sortInventory = (column) => {
    if (invSortCol === column) invSortAsc = !invSortAsc;
    else { invSortCol = column; invSortAsc = true; }
    window.renderInventoryTable();
};

// ==========================================
// ПАГІНАЦІЯ
// ==========================================
window.changeInvItemsPerPage = () => {
    const val = document.getElementById('invItemsPerPage').value;
    invItemsPerPage = val === 'all' ? 999999 : parseInt(val);
    invCurrentPage = 1;
    window.renderInventoryTable();
};

window.changeInvPage = (dir) => {
    invCurrentPage += dir;
    window.renderInventoryTable();
};

// ==========================================
// РЕДАГУВАННЯ ТА ВИДАЛЕННЯ
// ==========================================
window.editInv = (id) => {
    const item = window.globalInventory.find(i => i.id == id);
    if (item) {
        alert('Редагування в розробці');
    }
};

window.deleteInv = async (id) => {
    if (confirm('Видалити запис?')) {
        try {
            await apiRequest('delete_inventory', { id });
            await logAction("Склад", `Видалено запис з ID: ${id}`);
            await window.loadInventoryCrispy();
            showToast('Видалено', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    }
};

// ==========================================
// ІНІЦІАЛІЗАЦІЯ
// ==========================================
export function initInventoryLogic() {
    console.log("initInventoryLogic запущено");
    
    // Додаємо слухачі подій
    document.getElementById('filterLoc1')?.addEventListener('change', () => {
        invCurrentPage = 1;
        window.renderInventoryTable();
    });
    
    document.getElementById('invFilterStatus')?.addEventListener('change', () => {
        invCurrentPage = 1;
        window.renderInventoryTable();
    });
    
    document.getElementById('invFilterInvType')?.addEventListener('change', () => {
        invCurrentPage = 1;
        window.renderInventoryTable();
    });
    
    document.getElementById('invFilterPerson')?.addEventListener('change', () => {
        invCurrentPage = 1;
        window.renderInventoryTable();
    });
    
    document.getElementById('invSearch')?.addEventListener('input', () => {
        invCurrentPage = 1;
        window.renderInventoryTable();
    });
    
    // Ініціалізація форми приміток
    initNoteForm();
}

// ==========================================
// ІНІЦІАЛІЗАЦІЯ ФОРМИ ПРИМІТОК
// ==========================================
function initNoteForm() {
    const noteForm = document.getElementById('noteForm');
    if (!noteForm) return;
    
    // Видаляємо старий обробник, якщо був
    const newForm = noteForm.cloneNode(true);
    noteForm.parentNode.replaceChild(newForm, noteForm);
    
    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const targetType = document.getElementById('noteTargetType').value;
        const targetId = document.getElementById('noteTargetId').value;
        const noteText = document.getElementById('noteText').value.trim();
        const isPrivate = document.getElementById('noteIsPrivate')?.checked || false;
        
        if (!noteText) {
            showToast("Введіть текст примітки", "error");
            return;
        }
        
        const notePayload = {
            note_text: noteText,
            is_private: isPrivate ? 1 : 0
        };
        
        const typeMap = {
            'inventory': 'inventory_id',
            'room': 'room_id',
            'transfer': 'transfer_id',
            'laptop': 'laptop_id'
        };
        
        if (typeMap[targetType]) {
            notePayload[typeMap[targetType]] = targetId;
        }
        
        try {
            const result = await apiRequest('add_note', notePayload);
            
            if (result.success) {
                showToast("Примітку додано", "success");
                document.getElementById('noteText').value = '';
                if (document.getElementById('noteIsPrivate')) {
                    document.getElementById('noteIsPrivate').checked = false;
                }
                await loadNotes(targetType, targetId);
            } else {
                throw new Error(result.error || "Помилка додавання примітки");
            }
            
        } catch (err) {
            showToast("Помилка: " + err.message, "error");
        }
    });
}
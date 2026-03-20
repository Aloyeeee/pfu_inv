// js/modules/employee.js
import { showToast, renderSkeleton } from '../ui/ui-components.js';
import { getClearanceSheetDef } from '../core/templates.js'; 

window.empCurrentData = [];
window.empCurrentPage = 1;
window.empItemsPerPage = 50;
window.empSortColumn = 'location';
window.empSortAsc = true;

// ==========================================
// 1. АВТОПІДКАЗКА ПРИ ВВЕДЕННІ ПІБ (ВИПРАВЛЕНО)
// ==========================================
window.handleEmpNameInput = async () => {
    const input = document.getElementById('empSearchName');
    const dropdown = document.getElementById('empNameDropdown');
    if (!input || !dropdown) return;
    
    const val = input.value.trim();
    if (val.length < 2) { 
        dropdown.style.display = 'none'; 
        return; 
    }

    // Показуємо індикатор завантаження
    dropdown.innerHTML = '<div style="padding: 10px; text-align: center; color: #64748b;">⏳ Завантаження...</div>';
    dropdown.style.display = 'block';

    try {
        const response = await fetch(`api.php?action=search_employees_autocomplete&term=${encodeURIComponent(val)}`);
        const names = await response.json();
        
        dropdown.innerHTML = '';
        
        if (!names || names.length === 0) {
            dropdown.innerHTML = '<div style="padding: 10px; text-align: center; color: #64748b;">❌ Нічого не знайдено</div>';
            return;
        }

        names.forEach(name => {
            if (!name) return;
            
            const div = document.createElement('div');
            div.style.padding = '10px 12px';
            div.style.borderBottom = '1px solid #f1f5f9';
            div.style.cursor = 'pointer';
            div.style.fontSize = '14px';
            div.style.color = '#334155';
            div.style.transition = 'background-color 0.2s';
            
            div.onmouseover = () => div.style.backgroundColor = '#f8fafc';
            div.onmouseout = () => div.style.backgroundColor = 'white';
            
            div.innerHTML = `👤 <b>${name}</b>`;
            div.onclick = () => {
                input.value = name;
                dropdown.style.display = 'none';
                window.searchEmployee();
            };
            dropdown.appendChild(div);
        });
        
    } catch (err) {
        console.error("Помилка автопідказки:", err);
        dropdown.innerHTML = '<div style="padding: 10px; text-align: center; color: #ef4444;">❌ Помилка завантаження</div>';
    }
};

// ==========================================
// 2. ПОШУК МАЙНА ПРАЦІВНИКА (ВИПРАВЛЕНО)
// ==========================================
export async function loadEmployeeProfile(e) {
    e?.preventDefault();
    
    const inputElem = document.getElementById('empSearchName');
    if (!inputElem) return;
    
    const searchName = inputElem.value.trim();
    if (!searchName) {
        showToast("Введіть ПІБ працівника", "error");
        return;
    }

    // Ховаємо дропдаун
    document.getElementById('empNameDropdown').style.display = 'none';
    
    // Показуємо скелетон завантаження
    renderSkeleton('empTableBody', 5, 3);

    try {
        console.log("Пошук працівника:", searchName);
        
        const response = await fetch('api.php?action=search_employee', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: searchName })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        console.log("Результати пошуку:", result);
        
        window.empCurrentData = result.data || [];
        
        // Оновлюємо статистику
        const statsContainer = document.getElementById('empStatsContainer');
        const actionsContainer = document.getElementById('employeeActions');
        const elItems = document.getElementById('empTotalItems');
        const elPrice = document.getElementById('empTotalPrice');
        
        if (statsContainer) statsContainer.style.display = 'flex';
        if (actionsContainer) actionsContainer.style.display = 'flex';
        if (elItems) elItems.innerText = result.total || 0;
        if (elPrice) {
            const price = result.totalPrice || 0;
            elPrice.innerText = price.toLocaleString('uk-UA', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            }) + ' ₴';
        }
        
        window.empCurrentPage = 1;
        window.empSortColumn = 'location';
        window.empSortAsc = true;
        window.currentEmployeeData = { 
            name: searchName, 
            items: window.empCurrentData 
        };
        
        // Сортуємо та відображаємо
        sortEmployeeData();
        window.renderEmpTable();
        
        if (result.total > 0) {
            showToast(`Знайдено ${result.total} одиниць майна`, "success");
        } else {
            showToast(`За працівником нічого не знайдено`, "info");
        }
        
    } catch (err) {
        console.error("Помилка пошуку:", err);
        showToast("Помилка: " + err.message, "error");
        
        const tbody = document.getElementById('empTableBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color:#ef4444;">
                <div style="font-size: 24px; margin-bottom: 10px;">❌</div>
                <div style="font-size: 16px; font-weight: bold;">Помилка завантаження даних</div>
                <div style="font-size: 13px; color: #64748b; margin-top: 10px;">${err.message}</div>
            </td></tr>`;
        }
    }
}

window.searchEmployee = loadEmployeeProfile;

// ==========================================
// 3. СОРТУВАННЯ ДАНИХ
// ==========================================
function sortEmployeeData() {
    if (!window.empCurrentData || window.empCurrentData.length === 0) return;
    
    window.empCurrentData.sort((a, b) => {
        let valA, valB;
        
        switch (window.empSortColumn) {
            case 'location':
                valA = `${a.loc || ''} ${a.room || ''}`.toLowerCase();
                valB = `${b.loc || ''} ${b.room || ''}`.toLowerCase();
                break;
            case 'model':
                valA = (a.model || a.name || '').toLowerCase();
                valB = (b.model || b.name || '').toLowerCase();
                break;
            case 'inv':
                valA = (a.inv || 'Б/Н').toLowerCase();
                valB = (b.inv || 'Б/Н').toLowerCase();
                break;
            case 'price':
                valA = parseFloat(a.price || a.priceNum || 0);
                valB = parseFloat(b.price || b.priceNum || 0);
                break;
            case 'status':
                valA = a.source || '';
                valB = b.source || '';
                break;
            default:
                return 0;
        }
        
        if (typeof valA === 'number' && typeof valB === 'number') {
            return window.empSortAsc ? valA - valB : valB - valA;
        } else {
            valA = String(valA || '');
            valB = String(valB || '');
            return window.empSortAsc 
                ? valA.localeCompare(valB, 'uk')
                : valB.localeCompare(valA, 'uk');
        }
    });
}

// ==========================================
// 4. СОРТУВАННЯ ПРИ КЛІКУ НА ЗАГОЛОВОК
// ==========================================
window.sortEmployeeTable = (column) => {
    if (window.empSortColumn === column) {
        window.empSortAsc = !window.empSortAsc;
    } else {
        window.empSortColumn = column;
        window.empSortAsc = true;
    }
    
    sortEmployeeData();
    window.renderEmpTable();
    
    // Оновлюємо іконки сортування
    updateSortIcons();
};

function updateSortIcons() {
    document.querySelectorAll('#empTable th .sort-icon').forEach(icon => {
        icon.innerText = ' ↕️';
    });
    
    const activeTh = document.querySelector(`#empTable th[data-sort="${window.empSortColumn}"]`);
    if (activeTh) {
        const icon = activeTh.querySelector('.sort-icon');
        if (icon) {
            icon.innerText = window.empSortAsc ? ' ⬆️' : ' ⬇️';
        }
    }
}

// ==========================================
// 5. ВІДМАЛЬОВКА ТАБЛИЦІ
// ==========================================
window.renderEmpTable = () => {
    const tbody = document.getElementById('empTableBody');
    const pagination = document.getElementById('empPagination');
    if (!tbody || !pagination) return;
    
    if (window.empCurrentData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color:#64748b;">
            <div style="font-size: 24px; margin-bottom: 10px;">🔍</div>
            <div style="font-size: 16px;">За цим ПІБ не знайдено закріпленої техніки</div>
        </td></tr>`;
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';
    
    // Пагінація
    const itemsPerPageSelect = document.getElementById('empItemsPerPage');
    const itemsPerPage = (itemsPerPageSelect && itemsPerPageSelect.value !== 'all') 
        ? parseInt(itemsPerPageSelect.value) 
        : window.empCurrentData.length;
    
    const totalPages = Math.ceil(window.empCurrentData.length / itemsPerPage) || 1;
    
    if (window.empCurrentPage < 1) window.empCurrentPage = 1;
    if (window.empCurrentPage > totalPages) window.empCurrentPage = totalPages;

    const startIdx = (window.empCurrentPage - 1) * itemsPerPage;
    const pageData = window.empCurrentData.slice(startIdx, startIdx + itemsPerPage);

    // Рендеринг рядків
    let rowsHtml = '';
    pageData.forEach(item => {
        // Форматування локації
        let locText = '';
        if (item.source === 'Кабінет') {
            locText = `<b>${item.loc || 'Не вказано'}</b><br>Каб. ${item.room || '-'}`;
        } else if (item.source === 'Склад') {
            locText = `<b>${item.loc || 'Склад'}</b>`;
        } else {
            locText = `<b>На руках</b><br><span style="font-size:11px;">Видано особисто</span>`;
        }

        // Бейдж статусу
        let statusBadge = '';
        if (item.source === 'Кабінет') {
            statusBadge = `<span style="background: #ecfdf5; color: #059669; padding: 3px 8px; border-radius: 12px; font-size: 11px; border: 1px solid #a7f3d0;">🏢 Кабінет</span>`;
        } else if (item.source === 'Склад') {
            statusBadge = `<span style="background: #f1f5f9; color: #475569; padding: 3px 8px; border-radius: 12px; font-size: 11px; border: 1px solid #cbd5e1;">📦 Склад</span>`;
        } else {
            statusBadge = `<span style="background: #eff6ff; color: #2563eb; padding: 3px 8px; border-radius: 12px; font-size: 11px; border: 1px solid #bfdbfe;">📄 Видано</span>`;
        }

        // Назва моделі
        const modelName = item.model || item.name || 'Без назви';
        
        // Інвентарний номер
        const invDisplay = item.inv && item.inv !== 'Б/Н' 
            ? `<span style="color: var(--primary); font-weight: bold;">${item.inv}</span>`
            : '<span style="color: #94a3b8; font-weight: 600;">Б/Н</span>';
        
        // Серійний номер
        const snDisplay = item.sn && item.sn !== 'Б/Н' && item.sn !== ''
            ? `<br><span style="font-size: 11px; color: #64748b;">S/N: ${item.sn}</span>`
            : '';
        
        // Ціна
        const price = parseFloat(item.price || item.priceNum || 0);
        const priceText = price > 0 
            ? price.toLocaleString('uk-UA', { minimumFractionDigits: 2 }) + ' ₴'
            : '<span style="color: #94a3b8;">—</span>';

        rowsHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td data-label="Локація / Кабінет" style="padding: 12px 15px; font-size: 13px;">${locText}</td>
                <td data-label="Обладнання / Модель" style="padding: 12px 15px;">
                    <b>${modelName}</b>
                    <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${item.type || ''}</div>
                </td>
                <td data-label="Інв. № / Серійник" style="padding: 12px 15px;">
                    ${invDisplay}${snDisplay}
                </td>
                <td data-label="Вартість" style="padding: 12px 15px; text-align: right; font-weight: 600; color: #0f172a;">
                    ${priceText}
                </td>
                <td data-label="Статус" style="padding: 12px 15px; text-align: center;">
                    ${statusBadge}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml;

    // Оновлюємо пагінацію
    const elPageInfo = document.getElementById('empPageInfo');
    const elPrevBtn = document.getElementById('empPrevPage');
    const elNextBtn = document.getElementById('empNextPage');
    
    if (elPageInfo) {
        elPageInfo.innerText = `Сторінка ${window.empCurrentPage} з ${totalPages} (Всього: ${window.empCurrentData.length})`;
    }
    if (elPrevBtn) elPrevBtn.disabled = window.empCurrentPage === 1;
    if (elNextBtn) elNextBtn.disabled = window.empCurrentPage >= totalPages;
    
    updateSortIcons();
};

// ==========================================
// 6. ПАГІНАЦІЯ
// ==========================================
window.changeEmpPage = (step) => { 
    window.empCurrentPage += step; 
    window.renderEmpTable(); 
};

window.changeEmpItemsPerPage = () => { 
    window.empCurrentPage = 1; 
    window.renderEmpTable(); 
};

// ==========================================
// 7. ДРУК ОБХІДНОГО ТА ЕКСПОРТ
// ==========================================
export function printClearanceSheet() {
    if (!window.currentEmployeeData || !window.currentEmployeeData.items.length) {
        showToast("Немає даних для друку", "error");
        return;
    }
    
    const { name, items } = window.currentEmployeeData;

    const tableItems = items.map((item, idx) => {
        let location = '';
        if (item.source === 'Кабінет') {
            location = `Каб. ${item.room || '?'} (${item.loc || '?'})`;
        } else if (item.source === 'Склад') {
            location = item.loc || 'Склад';
        } else {
            location = 'На руках (Акт)';
        }
        
        const itemName = `${item.model || item.name || '?'} (Інв: ${item.inv || 'Б/Н'})`;
        return [idx + 1, item.source || '?', itemName, location];
    });

    const def = getClearanceSheetDef({
        name: name,
        dateStr: new Date().toLocaleDateString('uk-UA'),
        items: tableItems
    });

    if (window.downloadPDF) {
        window.downloadPDF(def, `Obkhidnyi_${name.replace(/\s+/g, '_')}.pdf`);
        showToast("PDF згенеровано успішно", "success");
    } else {
        showToast("Помилка генерації PDF", "error");
    }
}

export function exportEmployeeToExcel() {
    if (!window.currentEmployeeData || !window.currentEmployeeData.items.length) {
        return showToast("Немає даних для експорту", "error");
    }
    
    const { name, items } = window.currentEmployeeData;

    try {
        const exportData = items.map((item, idx) => {
            let location = '';
            if (item.source === 'Кабінет') {
                location = `Каб. ${item.room || '?'} (${item.loc || '?'})`;
            } else if (item.source === 'Склад') {
                location = item.loc || 'Склад';
            } else {
                location = 'На руках (Акт)';
            }
            
            return {
                "№": idx + 1,
                "Статус обліку": item.source || '-',
                "Найменування": item.model || item.name || '-',
                "Тип": item.type || '-',
                "Інвентарний №": item.inv || 'Б/Н',
                "Серійний №": item.sn || '-',
                "Місцезнаходження": location,
                "Вартість (₴)": parseFloat(item.price || item.priceNum || 0)
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        
        // Налаштування ширини колонок
        ws['!cols'] = [
            { wch: 5 },   // №
            { wch: 15 },  // Статус
            { wch: 40 },  // Найменування
            { wch: 20 },  // Тип
            { wch: 20 },  // Інвентарний №
            { wch: 20 },  // Серійний №
            { wch: 30 },  // Місцезнаходження
            { wch: 15 }   // Вартість
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, "Майно працівника");
        
        const fileName = `Mayno_${name.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('uk-UA')}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showToast("Excel файл успішно завантажено!", "success");
    } catch(e) { 
        console.error("Помилка експорту:", e);
        showToast("Помилка експорту: " + e.message, "error"); 
    }
}

// ==========================================
// 8. ІНІЦІАЛІЗАЦІЯ
// ==========================================
export function initEmployeeLogic() {
    console.log("initEmployeeLogic запущено");
    
    // Додаємо обробники для поля пошуку
    const searchInput = document.getElementById('empSearchName');
    if (searchInput) {
        searchInput.addEventListener('input', window.handleEmpNameInput);
        searchInput.addEventListener('focus', (e) => {
            if (e.target.value.length >= 2) {
                window.handleEmpNameInput();
            }
        });
    }
    
    // Додаємо обробники для сортування
    const ths = document.querySelectorAll('#empTable th');
    ths.forEach((th, index) => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            const columns = ['location', 'model', 'inv', 'price', 'status'];
            if (index < columns.length) {
                window.sortEmployeeTable(columns[index]);
            }
        });
        
        // Додаємо іконки сортування
        const icon = document.createElement('span');
        icon.className = 'sort-icon';
        icon.innerText = ' ↕️';
        th.appendChild(icon);
    });
}
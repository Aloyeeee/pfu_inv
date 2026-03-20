// js/modules/catalog.js
import { apiRequest } from './database.js';
import { logAction } from './audit.js';
import { showToast } from '../ui/ui-components.js';

// Змінні для пагінації
let catalogCurrentPage = 1;
let catalogItemsPerPage = 50;
let catalogFilteredData = [];

export function initCatalogLogic() {
    // Завантажуємо дані при ініціалізації
    loadCatalogData();
    
    // Слухачі подій
    document.getElementById('catalogFilterType')?.addEventListener('change', () => {
        catalogCurrentPage = 1;
        filterCatalogData();
        renderCatalogTable();
    });
    
    document.getElementById('catalogSearchName')?.addEventListener('input', () => {
        catalogCurrentPage = 1;
        filterCatalogData();
        renderCatalogTable();
    });
    
    // Форма додавання/редагування
    document.getElementById('catalogForm')?.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        const editId = document.getElementById('editCatId').value; 
        const data = { 
            type: document.getElementById('catType').value.trim(), 
            model: document.getElementById('catModel').value.trim() 
        }; 
        
        try { 
            if(editId) { 
                await apiRequest('update_catalog', { id: editId, ...data });
                await logAction("Довідник", `Оновлено: ${data.type} ${data.model}`);
                window.cancelCatalogEdit(); 
                showToast("Успішно оновлено!", "success");
            } else { 
                await apiRequest('add_catalog', data);
                await logAction("Довідник", `Додано: ${data.type} ${data.model}`);
                e.target.reset(); 
                showToast("Додано в довідник!", "success");
            } 
            
            // Оновлюємо дані
            await loadCatalogData();
            
        } catch (err) { 
            showToast("Помилка: " + err.message, "error"); 
        } 
        await logAction("Довідник", editId ? 
    `Оновлено: ${data.type} ${data.model}` : 
    `Додано: ${data.type} ${data.model}`);
    });
}

// Оновлення фільтрів
function updateCatalogFilters() {
    const catTypeList = document.getElementById('catTypeList');
    const filterTypeEl = document.getElementById('catalogFilterType');
    
    if (!window.catalogData) return;
    
    // Отримуємо унікальні типи
    const typesSet = new Set(window.catalogData.map(i => i.type));
    const sortedTypes = Array.from(typesSet).sort();
    
    // Оновлюємо datalist
    if (catTypeList) {
        catTypeList.innerHTML = sortedTypes.map(t => `<option value="${t}">`).join("");
    }
    
    // Оновлюємо фільтр
    if (filterTypeEl) {
        filterTypeEl.innerHTML = '<option value="all">Всі типи</option>' + 
            sortedTypes.map(t => `<option value="${t}">${t}</option>`).join("");
    }
}

// Фільтрація даних
function filterCatalogData() {
    if (!window.catalogData) return;
    
    const typeFilter = document.getElementById('catalogFilterType')?.value || 'all';
    const search = document.getElementById('catalogSearchName')?.value.toLowerCase() || '';
    
    let filtered = window.catalogData;
    
    if (typeFilter !== 'all') {
        filtered = filtered.filter(i => i.type === typeFilter);
    }
    
    if (search) {
        filtered = filtered.filter(i => i.model.toLowerCase().includes(search));
    }
    
    // Сортування
    filtered.sort((a, b) => a.type.localeCompare(b.type) || a.model.localeCompare(b.model));
    
    catalogFilteredData = filtered;
    
    // Оновлюємо лічильник
    const countEl = document.getElementById('catalogCount');
    if (countEl) {
        countEl.innerText = catalogFilteredData.length;
    }
}

// Функція рендерингу таблиці з пагінацією
window.renderCatalogTable = () => {
    const tbody = document.getElementById('catalogTableBody');
    if (!tbody || !catalogFilteredData) return;
    
    // Визначаємо кількість записів на сторінці
    const itemsPerPage = catalogItemsPerPage === 'all' ? catalogFilteredData.length : parseInt(catalogItemsPerPage);
    const totalPages = Math.ceil(catalogFilteredData.length / itemsPerPage) || 1;
    
    // Корегуємо поточну сторінку
    if (catalogCurrentPage < 1) catalogCurrentPage = 1;
    if (catalogCurrentPage > totalPages) catalogCurrentPage = totalPages;
    
    // Отримуємо дані для поточної сторінки
    const startIndex = (catalogCurrentPage - 1) * itemsPerPage;
    const pageData = catalogFilteredData.slice(startIndex, startIndex + itemsPerPage);
    
    // Рендеримо рядки
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 40px; color: var(--text-muted);">❓ Нічого не знайдено</td></tr>';
    } else {
        tbody.innerHTML = pageData.map(item => `
            <tr>
                <td data-label="Тип">${item.type}</td>
                <td data-label="Модель"><strong>${item.model}</strong></td>
                <td data-label="Дії" class="actions-col" style="${window.isAdmin && window.isAdmin() ? '' : 'display:none;'}">
                    <button class="btn-secondary" style="padding:4px 8px; font-size:12px;" onclick="window.editCatalog('${item.id}')">✏️</button> 
                    <button class="btn-secondary" style="padding:4px 8px; font-size:12px; color:red;" onclick="window.deleteCatalog('${item.id}')">🗑️</button>
                </td>
            </tr>
        `).join("");
    }
    
    // Оновлюємо інформацію про пагінацію
    updateCatalogPagination(totalPages);
};

// Оновлення пагінації
function updateCatalogPagination(totalPages) {
    const pageInfo = document.getElementById('catalogPageInfo');
    const prevBtn = document.getElementById('catalogPrevPage');
    const nextBtn = document.getElementById('catalogNextPage');
    
    if (pageInfo) {
        pageInfo.innerText = `Сторінка ${catalogCurrentPage} з ${totalPages}`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = catalogCurrentPage === 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = catalogCurrentPage === totalPages;
    }
}

// Зміна сторінки
window.changeCatalogPage = (step) => {
    catalogCurrentPage += step;
    renderCatalogTable();
};

// Зміна кількості записів на сторінці
window.changeCatalogItemsPerPage = () => {
    const select = document.getElementById('catalogItemsPerPage');
    if (select) {
        catalogItemsPerPage = select.value;
        catalogCurrentPage = 1;
        renderCatalogTable();
    }
};

// Редагування
window.editCatalog = (id) => { 
    const item = window.catalogData.find(i => i.id === id); 
    if(item) { 
        document.getElementById('editCatId').value = item.id; 
        document.getElementById('catType').value = item.type; 
        document.getElementById('catModel').value = item.model; 
        document.getElementById('catSubmitBtn').innerText = "💾 Оновити"; 
        document.getElementById('catCancelBtn').style.display = "block"; 
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
    } 
};

// Скасування редагування
window.cancelCatalogEdit = () => { 
    document.getElementById('catalogForm').reset(); 
    document.getElementById('editCatId').value = ""; 
    document.getElementById('catSubmitBtn').innerText = "💾 Зберегти"; 
    document.getElementById('catCancelBtn').style.display = "none"; 
};

// Видалення
window.deleteCatalog = async (id) => { 
    if(confirm("Видалити з бази?")) {
        try {
            await apiRequest('delete_catalog', { id });
            await logAction("Довідник", `Видалено позицію`);
            showToast("Позицію видалено", "success");
            await loadCatalogData(); // Перезавантажуємо дані
        } catch (e) { 
            showToast("Помилка видалення: " + e.message, "error"); 
        }
    }
    
await logAction("Довідник", `Видалено позицію з ID: ${id}`);
};

// Імпорт CSV
window.uploadCatalogCSV = () => {
    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput.files[0];
    if (!file) return showToast("Оберіть файл CSV!", "error");
    
    const btn = document.querySelector('button[onclick="window.uploadCatalogCSV()"]');
    btn.innerText = "⏳ Обробка..."; 
    btn.disabled = true;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const rows = e.target.result.split('\n').map(r => r.trim()).filter(r => r);
            
            // Видаляємо заголовок, якщо є
            if (rows.length > 0 && (rows[0].toLowerCase().includes('тип') || rows[0].toLowerCase().includes('type'))) {
                rows.shift();
            }

            let itemsToImport = [];
            for (const row of rows) {
                const cols = row.split(/[,;]/).map(c => c.trim());
                if (cols.length >= 2) {
                    itemsToImport.push({ type: cols[0], model: cols[1] });
                }
            }
            
            fileInput.value = ""; 
            
            if (itemsToImport.length === 0) {
                showToast("Немає даних для імпорту", "error");
                return;
            }
            
            const res = await apiRequest('import_catalog_csv', { items: itemsToImport });
            await logAction("Довідник", `Масовий імпорт CSV: ${res.added} позицій`);
            
            showToast(`Завантаження завершено! Додано: ${res.added}`, "success");
            
            // Оновлюємо дані
            await loadCatalogData();
            
        } catch(err) { 
            showToast("Помилка: " + err.message, "error"); 
        } finally { 
            btn.innerText = "Завантажити базу"; 
            btn.disabled = false; 
        }
    };
    reader.readAsText(file, 'UTF-8');
};

// Функція для очищення каталогу від сміття
window.cleanCatalog = async () => {
    if (!confirm("⚠️ Видалити всі записи з каталогу з некоректними назвами?")) return;
    
    try {
        const response = await fetch('api.php?action=clean_catalog');
        const result = await response.json();
        showToast(`Очищено ${result.deleted} записів`, "success");
        await loadCatalogData();
    } catch (err) {
        showToast("Помилка: " + err.message, "error");
    }
};

// ==========================================
// ОЧИЩЕННЯ ДОВІДНИКА ВІД СМІТТЯ
// ==========================================
window.cleanCatalog = async () => {
    if (!confirm("⚠️ УВАГА! Це видалить всі записи з довідника, які містять службову інформацію (інвентарні номери, ПІБ, статуси тощо).\n\nПродовжити?")) {
        return;
    }

    const btn = document.querySelector('button[onclick="window.cleanCatalog()"]');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Очищення...";
    btn.disabled = true;

    try {
        // Викликаємо API для очищення
        const response = await fetch('api.php?action=clean_catalog');
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        // Показуємо результат
        showToast(`✅ Довідник очищено! Видалено ${result.deleted} записів.`, "success");
        
        // Після очищення автоматично перезавантажуємо дані
        await loadCatalogData();
        
        // Оновлюємо всі залежні дані (інвентар, кабінети тощо)
        await refreshAllData();
        
    } catch (err) {
        console.error("Помилка очищення:", err);
        showToast("❌ Помилка: " + err.message, "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// ==========================================
// ПЕРЕЗАВАНТАЖЕННЯ ВСІХ ДАНИХ
// ==========================================
async function refreshAllData() {
    try {
        // Показуємо індикатор завантаження
        showToast("🔄 Оновлення даних...", "info");
        
        // Оновлюємо каталог
        window.catalogData = await apiRequest('get_catalog');
        
        // Оновлюємо інвентар (бо там є model_id, які могли змінитись)
        const inventoryResponse = await fetch('api.php?action=get_inventory');
        window.globalInventory = await inventoryResponse.json();
        
        // Оновлюємо кабінети
        const roomsResponse = await fetch('api.php?action=get_rooms');
        window.globalRoomsData = await roomsResponse.json();
        
        // Оновлюємо відображення всіх таблиць
        if (window.renderCatalogTable) window.renderCatalogTable();
        if (window.renderInventoryTable) window.renderInventoryTable();
        if (window.renderRoomsTable) window.renderRoomsTable();
        
        // Оновлюємо фільтри в каталозі
        updateCatalogFilters();
        
        showToast("✅ Дані успішно оновлено!", "success");
        
    } catch (err) {
        console.error("Помилка оновлення даних:", err);
        showToast("❌ Помилка оновлення даних", "error");
    }
}

// ==========================================
// ФУНКЦІЯ ЗАВАНТАЖЕННЯ ДАНИХ КАТАЛОГУ (оновлена)
// ==========================================
async function loadCatalogData() {
    try {
        const tbody = document.getElementById('catalogTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 40px; color: var(--text-muted);">⏳ Завантаження довідника...</td></tr>';
        }
        
        window.catalogData = await apiRequest('get_catalog');
        
        // Оновлюємо список типів для фільтра
        updateCatalogFilters();
        
        // Фільтруємо та відображаємо дані
        filterCatalogData();
        renderCatalogTable();
        
    } catch (err) {
        console.error("Помилка завантаження довідника:", err);
        showToast("Помилка завантаження довідника", "error");
    }
}
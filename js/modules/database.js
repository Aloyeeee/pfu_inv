// js/modules/database.js
// ФАЙЛ ПОВНІСТЮ ВІДВ'ЯЗАНО ВІД FIREBASE

import { showToast } from '../ui/ui-components.js';

// Глобальні змінні
window.transferCart = [];
window.refillCart = [];
window.globalInventory = [];
window.catalogData = [];
window.globalLaptops = [];
window.globalTransfers = [];
window.globalRefills = [];
window.globalRoomsData = [];

const API_URL = 'api.php'; // Шлях до вашого локального бекенду

// Універсальна функція для запитів
export async function apiRequest(action, data = null) {
    try {
        const options = { method: data ? 'POST' : 'GET' };
        if (data) {
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify({ action, ...data });
        }
        
        const url = data ? API_URL : `${API_URL}?action=${action}`;
        const response = await fetch(url, options);
        const result = await response.json();
        
        if (result.error) throw new Error(result.error);
        return result;
    } catch (error) {
        console.error(`Помилка API (${action}):`, error);
        throw error;
    }
}

// Головна функція завантаження ВСІХ даних при старті
export async function startDatabaseListeners() {
    try {
        // 1. Завантажуємо Каталог
        window.catalogData = await apiRequest('get_catalog');
        const typesSet = new Set(window.catalogData.map(item => item.type));
        
        const invTypeEl = document.getElementById('invType');
        if(invTypeEl) invTypeEl.innerHTML = `<option value="">-- Оберіть тип --</option>` + Array.from(typesSet).sort().map(t => `<option value="${t}">${t}</option>`).join("");
        
        const catFilterEl = document.getElementById('catalogFilterType');
        if(catFilterEl) catFilterEl.innerHTML = `<option value="all">Всі типи</option>` + Array.from(typesSet).sort().map(t => `<option value="${t}">${t}</option>`).join("");
        
        if(window.renderCatalogTable) window.renderCatalogTable();

        // 2. Завантажуємо Склад (через оптимізований Crispy Load)
        if (typeof window.loadInventoryCrispy === 'function') {
            await window.loadInventoryCrispy();
        } else {
            // Фолбек, якщо функція ще не підвантажилась
            window.globalInventory = await apiRequest('get_inventory');
            if (typeof window.updateInventoryFilters === 'function') window.updateInventoryFilters();
            if (window.renderInventoryTable) window.renderInventoryTable();
        }
        
        // Оновлюємо таблицю та статус "Для списання"
        if(window.renderInventoryTable) {
            window.renderInventoryTable();
        }
        
        // 3. Завантажуємо Журнали (Переміщення, Картриджі, Ноутбуки, Кабінети)
        window.globalTransfers = await apiRequest('get_transfers');
        if(window.renderTransferHistory) window.renderTransferHistory();

        window.globalRefills = await apiRequest('get_refills');
        if(window.renderRefillHistory) window.renderRefillHistory();

        window.globalLaptops = await apiRequest('get_laptops');
        if(window.renderLaptopsHistory) window.renderLaptopsHistory();
        
        window.globalRoomsData = await apiRequest('get_rooms');
        if(window.renderRoomsTable) window.renderRoomsTable();

    } catch (err) {
        showToast("Помилка завантаження бази даних. Перевірте з'єднання з сервером.", "error");
    }
}

// Тимчасова заглушка для прав адміністратора
// Пізніше ми прив'яжемо це до вашої таблиці users у MariaDB
window.isAdmin = () => window.currentUserRole === 'admin';
window.isAdmin = isAdmin;
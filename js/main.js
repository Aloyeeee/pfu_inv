// js/main.js
import './core/config.js';
import './ui/ui.js';
import './core/auth.js';
import './core/pdf.js'; 

import { startAuditListener } from './modules/audit.js';
import { startDashboard } from './modules/dashboard.js';
import { initDarkMode, toggleDarkMode } from './ui/ui-components.js';
import { initEmployeeLogic ,loadEmployeeProfile, printClearanceSheet, exportEmployeeToExcel } from './modules/employee.js';

import { initInventoryLogic } from './modules/inventory.js';
import { initLaptopsLogic } from './modules/laptops.js';
import { initTransferLogic } from './modules/transfer.js';
import './modules/refill.js';          // модуль ініціалізується сам, експорт не потрібен
import { initCatalogLogic } from './modules/catalog.js';
import { initSettingsLogic } from './modules/settings.js';
import { initPremiumFeatures } from './ui/premium.js';
import { initRoomsLogic } from './modules/rooms.js';
// Імпортуємо функції з notes.js
import { initNotesLogic, loadNotes, addNote } from './modules/notes.js';

// Ініціалізуємо тему
initDarkMode();
document.getElementById('themeToggleBtn')?.addEventListener('click', toggleDarkMode);

// Підключаємо події для МВО
document.getElementById('employeeSearchForm')?.addEventListener('submit', loadEmployeeProfile);
window.printClearanceSheet = printClearanceSheet;
window.exportEmployeeToExcel = exportEmployeeToExcel;

// Запускаємо логіку всіх вкладок
initInventoryLogic();
initLaptopsLogic();
initTransferLogic();
// initRefillLogic() — не потрібно, refill.js сам ініціалізується через DOMContentLoaded
initCatalogLogic();
initSettingsLogic();
initPremiumFeatures();
initRoomsLogic();
initEmployeeLogic();

// ВАЖЛИВО: Робимо функції глобальними ПЕРЕД викликом initNotesLogic
window.loadNotes = loadNotes;
window.addNote = addNote;

// Запускаємо логіку приміток (тільки один раз!)
initNotesLogic();

// Запускаємо глобальні слухачі
startAuditListener();
startDashboard();

// Ховаємо прелоадер
setTimeout(() => {
    const preloader = document.getElementById('global-preloader');
    if (preloader) {
        preloader.style.transform = 'scale(1.1)';
        preloader.style.opacity = '0';
        preloader.style.visibility = 'hidden';
        setTimeout(() => preloader.remove(), 800);
    }
}, 400);

window.addEventListener('load', () => {
    // Даємо час на завантаження компонентів через boot.js
    setTimeout(() => {
        document.querySelectorAll('.field input, .field select').forEach(el => {
            el.addEventListener('blur', () => {
                if (el.value !== "") el.closest('.field').classList.add('has-val');
                else el.closest('.field').classList.remove('has-val');
            });
            if (el.value !== "") el.closest('.field').classList.add('has-val');
        });
    }, 1000);
});

// Ініціалізація форми в модалці
document.addEventListener('DOMContentLoaded', () => {
    // Даємо час на завантаження модалки
    setTimeout(() => {
        const noteForm = document.getElementById('noteForm');
        if (noteForm) {
            // Видаляємо старі обробники
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
                
                // Збираємо контекст
                let contextStatus = null;
                let contextLocation = null;
                
                if (targetType === 'inventory' && window.globalInventory) {
                    const item = window.globalInventory.find(i => i.id == targetId);
                    if (item) {
                        contextStatus = item.status;
                        contextLocation = item.location;
                    }
                } else if (targetType === 'room' && window.globalRoomsData) {
                    const item = window.globalRoomsData.find(i => i.id == targetId);
                    if (item) {
                        contextStatus = item.status;
                        contextLocation = item.loc || item.location;
                    }
                } else if (targetType === 'transfer' && window.globalTransfers) {
                    const item = window.globalTransfers.find(i => i.id == targetId);
                    if (item) {
                        contextLocation = `${item.from || '?'} → ${item.to || '?'}`;
                    }
                } else if (targetType === 'laptop' && window.globalLaptops) {
                    const item = window.globalLaptops.find(i => i.id == targetId);
                    if (item) {
                        contextLocation = item.location;
                        contextStatus = item.status;
                    }
                }
                
                const notePayload = {
                    note_text: noteText,
                    is_private: isPrivate ? 1 : 0,
                    context_status: contextStatus,
                    context_location: contextLocation
                };
                
                // Додаємо ID в залежності від типу
                if (targetType === 'inventory') notePayload.inventory_id = targetId;
                if (targetType === 'room') notePayload.room_id = targetId;
                if (targetType === 'transfer') notePayload.transfer_id = targetId;
                if (targetType === 'laptop') notePayload.laptop_id = targetId;
                
                try {
                    await addNote(notePayload);
                    
                    // Очищаємо форму
                    document.getElementById('noteText').value = '';
                    if (document.getElementById('noteIsPrivate')) {
                        document.getElementById('noteIsPrivate').checked = false;
                    }
                    
                    // Перезавантажити список в модалці
                    const container = document.getElementById('noteListContainer');
                    if (container && window.loadNotes) {
                        await loadNotes(targetType, targetId, container);
                    }
                    
                    // Закриваємо модалку
                    const modal = document.getElementById('noteModal');
                    if (modal) modal.style.display = 'none';
                    
                } catch (err) {
                    console.error("Помилка додавання примітки:", err);
                    showToast("Помилка: " + err.message, "error");
                }
            });
        }
    }, 500);
});

// Перемикання теми
function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggleBtn');
    if (!themeToggle) return;
    
    // Перевіряємо збережену тему
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
    
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        
        // Зберігаємо вибір
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
        
        // Оновлюємо графіки якщо вони є
        if (window.charts) {
            Object.values(window.charts).forEach(chart => {
                if (chart && chart.update) {
                    chart.update();
                }
            });
        }
    });
}

// Викликаємо після завантаження DOM
document.addEventListener('DOMContentLoaded', initThemeToggle);
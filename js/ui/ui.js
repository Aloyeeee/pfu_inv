// js/ui/ui.js
import { pfuLocations, pfuStructure, pfuMVO } from '../core/config.js';

// ==========================================
// ГЛОБАЛЬНА ЛОГІКА ПЕРЕМИКАННЯ ТЕМИ
// ==========================================
window.initTheme = function() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    // Синхронізуємо текст кнопки після завантаження
    setTimeout(() => {
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.innerText = (savedTheme === 'dark') ? '☀️ Світла тема' : '🌙 Темна тема';
        }
    }, 500); // Чекаємо півсекунди, поки boot.js завантажить HTML
};

window.toggleTheme = function(e) {
    if (e) e.preventDefault();
    
    const isDarkNow = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDarkNow ? 'dark' : 'light');
    
    // Шукаємо кнопку і міняємо текст миттєво
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        themeBtn.innerText = isDarkNow ? '☀️ Світла тема' : '🌙 Темна тема';
    }
};

// Запускаємо відразу при старті
window.initTheme();

export function initDropdowns() {
    // 1. ЗАПОВНЮЄМО ВСІ СПИСКИ ВІДДІЛЕНЬ
    const locationIds = ['invLocation', 'trFrom', 'trTo', 'rfLocation', 'lpLocation', 'lpDestination', 'retLocation', 'roomLoc'];
    locationIds.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            let options = pfuLocations.map(loc => `<option value="${loc}">${loc}</option>`).join("");
            // Якщо це список "Куди видано" - додаємо пункт "Інше"
            if(id === 'lpDestination') {
                options += '<option value="other" style="font-weight:bold; color:#ea580c;">✏️ Інше (Вписати вручну)</option>';
            }
            el.innerHTML = options;
        }
    });
    
    // Фільтри відділень
    const filter1 = document.getElementById('filterLoc1');
    if(filter1) filter1.innerHTML = `<option value="all">Всі відділення</option>` + pfuLocations.map(loc => `<option value="${loc}">${loc}</option>`).join("");
    
    const roomFilterLoc = document.getElementById('roomFilterLoc');
    if(roomFilterLoc) roomFilterLoc.innerHTML = `<option value="all">Всі відділення</option>` + pfuLocations.map(loc => `<option value="${loc}">${loc}</option>`).join("");

    // 2. АВТОПІДКАЗКИ ДЛЯ МВО
    let datalist = document.getElementById('mvoList');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'mvoList';
        document.body.appendChild(datalist);
    }
    if (typeof pfuMVO !== 'undefined') datalist.innerHTML = pfuMVO.map(mvo => `<option value="${mvo}">`).join("");

    const personInputs = ['invPerson', 'roomPerson', 'rfPerson', 'trSentBy', 'trReceivedBy', 'lpUser', 'lpEncryptedFor', 'retReceiver'];
    personInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.setAttribute('list', 'mvoList');
    });

    // 3. ІЄРАРХІЯ СТРУКТУРИ (Управління -> Відділ -> Посада)
    const hierarchies = [
        { dir: 'lpUserDir', dept: 'lpUserDept', title: 'lpUserTitle' },
        { dir: 'lpEncryptedForDir', dept: 'lpEncryptedForDept', title: 'lpEncryptedForTitle' },
        { dir: 'retReceiverDir', dept: 'retReceiverDept', title: 'retReceiverTitle' }
    ];

    hierarchies.forEach(h => {
        const dirSelect = document.getElementById(h.dir);
        const deptSelect = document.getElementById(h.dept);
        const titleSelect = document.getElementById(h.title);

        if (!dirSelect || !deptSelect || !titleSelect) return;

        dirSelect.innerHTML = `<option value="">-- Оберіть управління --</option>` + Object.keys(pfuStructure).map(d => `<option value="${d}">${d}</option>`).join("");
        deptSelect.innerHTML = `<option value="">-- Спочатку оберіть управління --</option>`;
        deptSelect.disabled = true;
        titleSelect.innerHTML = `<option value="">-- Спочатку оберіть відділ --</option>`;
        titleSelect.disabled = true;

        dirSelect.addEventListener('change', (e) => {
            const selectedDir = e.target.value;
            if (selectedDir && pfuStructure[selectedDir]) {
                const depts = Object.keys(pfuStructure[selectedDir]);
                deptSelect.innerHTML = `<option value="">-- Оберіть відділ --</option>` + depts.map(d => `<option value="${d}">${d}</option>`).join("");
                deptSelect.disabled = false;
            } else {
                deptSelect.innerHTML = `<option value="">-- Спочатку оберіть управління --</option>`;
                deptSelect.disabled = true;
            }
            titleSelect.innerHTML = `<option value="">-- Спочатку оберіть відділ --</option>`;
            titleSelect.disabled = true;
        });

        deptSelect.addEventListener('change', (e) => {
            const selectedDir = dirSelect.value;
            const selectedDept = e.target.value;
            if (selectedDir && selectedDept && pfuStructure[selectedDir][selectedDept]) {
                const titles = pfuStructure[selectedDir][selectedDept];
                titleSelect.innerHTML = `<option value="">-- Оберіть посаду --</option>` + titles.map(t => `<option value="${t}">${t}</option>`).join("");
                titleSelect.disabled = false;
            } else {
                titleSelect.innerHTML = `<option value="">-- Спочатку оберіть відділ --</option>`;
                titleSelect.disabled = true;
            }
        });
    });
}

// Меню та вкладки
document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!sidebar || !overlay) return;
    if (e.target.closest('#openMenuBtn')) { sidebar.classList.add('open'); overlay.classList.add('active'); } 
    else if (e.target.closest('#closeMenuBtn') || e.target.closest('#sidebarOverlay')) { sidebar.classList.remove('open'); overlay.classList.remove('active'); }
});

window.showTab = (id) => {
    // 1. Ховаємо всі вкладки та забираємо клас active
    document.querySelectorAll('.tab-content').forEach(t => {
        t.style.display = 'none';
        t.classList.remove('active');
    });
    
    // 2. Знімаємо підсвітку з усіх пунктів меню
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // 3. Показуємо потрібну вкладку з плавною анімацією
    const tab = document.getElementById(id);
    if (tab) {
        tab.style.display = 'block';
        setTimeout(() => tab.classList.add('active'), 10); // Затримка для анімації
    }

    // 4. Підсвічуємо пункт меню в сайдбарі
    const activeMenuItem = document.querySelector(`.nav-item[onclick*="${id}"]`);
    if (activeMenuItem) activeMenuItem.classList.add('active');
    
    // 5. Ховаємо мобільне меню
    if (window.innerWidth <= 992) { 
        document.getElementById('sidebar')?.classList.remove('open'); 
        document.getElementById('sidebarOverlay')?.classList.remove('active'); 
    }

    // 6. Запускаємо рендеринг відповідних таблиць
    setTimeout(() => {
        if (id === 'inventory' && window.renderInventoryTable) window.renderInventoryTable();
        if (id === 'rooms' && window.renderRoomsTable) window.renderRoomsTable();
        if (id === 'transfer' && window.renderTransferHistory) window.renderTransferHistory();
        if (id === 'refill' && window.renderRefillHistory) window.renderRefillHistory();
        if (id === 'laptops' && window.renderLaptopsHistory) window.renderLaptopsHistory();
        if (id === 'catalog' && window.renderCatalogTable) window.renderCatalogTable();
    }, 50);
};

// Функція для перевірки заповненості полів (щоб мітки не наїжджали на текст)
window.updateFieldLabels = () => {
    document.querySelectorAll('.field input, .field select').forEach(el => {
        const field = el.closest('.field');
        if (el.value && el.value !== "") {
            field.classList.add('has-val');
        } else {
            field.classList.remove('has-val');
        }
    });
};

// Запускаємо перевірку щоразу, коли відкривається будь-яке модальне вікно
const observer = new MutationObserver(() => window.updateFieldLabels());
const modal = document.querySelector('.modal');
if (modal) {
    observer.observe(modal, { attributes: true, childList: true, subtree: true });
}

// Також додаємо слухач на введення тексту
document.addEventListener('input', (e) => {
    if (e.target.closest('.field')) {
        window.updateFieldLabels();
    }
});

// Викликайте це після заповнення форми даними
window.fixFloatingLabels = (containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.field input, .field select').forEach(el => {
        if (el.value !== "") {
            el.closest('.field').classList.add('has-val');
        } else {
            el.closest('.field').classList.remove('has-val');
        }
    });
};

window.openNoteModal = (targetType, targetId, title) => {
    const modal = document.getElementById('noteModal');
    if (!modal) return;
    
    document.getElementById('noteModalTitle').innerText = title;
    document.getElementById('noteTargetType').value = targetType;
    document.getElementById('noteTargetId').value = targetId;
    
    // Завантажити існуючі примітки
    const container = document.getElementById('noteListContainer');
    if (window.loadNotes) {
        window.loadNotes(targetType, targetId, container);
    }
    
    modal.style.display = 'flex';
};

// Додайте в кінець файлу ui.js після завантаження сторінки

// Ініціалізація обробників для сторінки приміток
document.addEventListener('DOMContentLoaded', () => {
    // Фільтр типу
    const typeFilter = document.getElementById('notesFilterType');
    if (typeFilter) {
        typeFilter.addEventListener('change', () => {
            if (window.filterGlobalNotes) window.filterGlobalNotes();
        });
    }
    
    // Фільтр об'єкта
    const objectFilter = document.getElementById('notesFilterObject');
    if (objectFilter) {
        objectFilter.addEventListener('change', () => {
            if (window.filterGlobalNotes) window.filterGlobalNotes();
        });
    }
    
    // Пошук
    const searchInput = document.getElementById('notesSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (window.filterGlobalNotes) window.filterGlobalNotes();
        });
    }
    
    // Кнопка скидання
    const clearBtn = document.getElementById('clearFiltersBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (window.clearNotesFilters) window.clearNotesFilters();
        });
    }
    
    // Кнопка експорту
    const exportBtn = document.getElementById('exportNotesBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (window.exportNotesToExcel) window.exportNotesToExcel();
        });
    }
});

// Додайте в кінець файлу ui.js

// Ініціалізація обробників для сторінки приміток
document.addEventListener('DOMContentLoaded', () => {
    // Чекаємо поки завантажаться всі скрипти
    setTimeout(() => {
        // Фільтр типу
        const typeFilter = document.getElementById('notesFilterType');
        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                if (typeof window.filterGlobalNotes === 'function') {
                    window.filterGlobalNotes();
                } else {
                    console.warn("filterGlobalNotes ще не завантажена");
                }
            });
        }
        
        // Фільтр об'єкта
        const objectFilter = document.getElementById('notesFilterObject');
        if (objectFilter) {
            objectFilter.addEventListener('change', () => {
                if (typeof window.filterGlobalNotes === 'function') {
                    window.filterGlobalNotes();
                }
            });
        }
        
        // Пошук
        const searchInput = document.getElementById('notesSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                if (typeof window.filterGlobalNotes === 'function') {
                    window.filterGlobalNotes();
                }
            });
        }
        
        // Кнопка скидання
        const clearBtn = document.getElementById('clearFiltersBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (typeof window.clearNotesFilters === 'function') {
                    window.clearNotesFilters();
                }
            });
        }
        
        // Кнопка експорту
        const exportBtn = document.getElementById('exportNotesBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                if (typeof window.exportNotesToExcel === 'function') {
                    window.exportNotesToExcel();
                }
            });
        }
    }, 500); // Даємо час на завантаження
});

// Додайте в кінець файлу ui.js

// Глобальний спостерігач для оновлення фільтрів при зміні вкладки
document.addEventListener('tabChanged', (e) => {
    if (e.detail.tab === 'notes') {
        console.log("Вкладка приміток активована, оновлюємо фільтри...");
        setTimeout(() => {
            if (typeof window.loadAllNotes === 'function') {
                window.loadAllNotes();
            }
        }, 300);
    }
});

// Періодична перевірка наявності фільтрів
setInterval(() => {
    if (document.getElementById('notesFilterType') && 
        document.getElementById('globalNotesList') &&
        !window._notesFiltersInitialized) {
        console.log("Фільтри знайдено, ініціалізуємо...");
        
        // Штучно викликаємо події для активації фільтрів
        const event = new Event('change');
        document.getElementById('notesFilterType')?.dispatchEvent(event);
        
        window._notesFiltersInitialized = true;
    }
}, 2000);
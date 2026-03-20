// js/modules/rooms.js
import { apiRequest } from './database.js';
import { getBuildingFormularDef } from '../core/templates.js';
import { logAction } from './audit.js';
import { showToast } from '../ui/ui-components.js';

let currentFilteredRoomsData = [];
window.tempWarehouseSpecs = null;
window.specsConflicts = [];

const cleanMVO = (name) => name ? name.replace(/\s*\(\s*\d+\s*\)\s*/g, '').trim() : '';

// ==========================================
// ПОКАЗ/ПРИХОВУВАННЯ ФОРМИ ДОДАВАННЯ
// ==========================================
window.toggleRoomForm = function() {
    const form = document.getElementById('roomFormContainer');
    if (form) {
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
    }
};

// ==========================================
// АВТОПОШУК ТА АВТОЗАПОВНЕННЯ
// ==========================================
window.handleRoomInvInput = async function() {
    const input = document.getElementById('roomInv');
    const dropdown = document.getElementById('roomInvDropdown');
    const noInvCheck = document.getElementById('noInvCheck');
    
    if (!input || !dropdown) return;
    
    const val = input.value.trim();
    
    if (noInvCheck && noInvCheck.checked) {
        dropdown.style.display = 'none';
        return;
    }
    
    if (val.length < 2) {
        dropdown.style.display = 'none';
        return;
    }

    if (!window.globalInventory) {
        dropdown.innerHTML = '<div style="padding: 15px; text-align: center;">⏳ Завантаження...</div>';
        dropdown.style.display = 'block';
        
        try {
            const response = await fetch('api.php?action=get_inventory');
            const data = await response.json();
            
            window.globalInventory = data.map(item => ({
                ...item,
                inv: item.inv || item.inv_number || 'Б/Н',
                name: item.name || item.model || item.model_name || 'Без назви',
                type: item.type || 'Обладнання',
                location: item.location || item.location_name || '',
                person: item.person || item.mvo || '',
                sn: item.sn || item.serial_number || ''
            }));
        } catch (e) {
            console.error("Помилка завантаження:", e);
            dropdown.innerHTML = '<div style="padding: 15px; color: #ef4444; text-align: center;">❌ Помилка</div>';
            return;
        }
    }

    const searchTerm = val.toLowerCase();
    const filtered = window.globalInventory
        .filter(item => {
            if (item.status === 'Списано') return false;
            const invStr = String(item.inv || '').toLowerCase();
            const nameStr = String(item.name || '').toLowerCase();
            const typeStr = String(item.type || '').toLowerCase();
            return invStr.includes(searchTerm) || nameStr.includes(searchTerm) || typeStr.includes(searchTerm);
        })
        .slice(0, 15);

    dropdown.innerHTML = '';
    
    if (filtered.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

    filtered.forEach(item => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.style.padding = '12px 15px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #e2e8f0';
        
        const invDisplay = item.inv && item.inv !== 'Б/Н' ? 
            `<span style="color: #0ea5e9; font-weight: 600;">${item.inv}</span>` : 
            '<span style="color: #f59e0b; font-weight: 600;">Б/Н</span>';
        
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between;">
                <span><strong>${invDisplay}</strong> — ${item.name}</span>
                <span style="color: #64748b; font-size: 11px;">${item.type}</span>
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
                📍 ${item.location || 'Немає'} | 👤 ${cleanMVO(item.person || '')}
            </div>
        `;
        
        div.onclick = () => {
            fillRoomFormFromInventory(item);
            input.focus();
            dropdown.style.display = 'none';
        };
        
        dropdown.appendChild(div);
    });
    
    dropdown.style.display = 'block';
};

// ==========================================
// ФУНКЦІЯ ЗАПОВНЕННЯ ФОРМИ
// ==========================================
function fillRoomFormFromInventory(item) {
    console.log("Заповнення форми:", item);
    
    const invInput = document.getElementById('roomInv');
    const noInvCheck = document.getElementById('noInvCheck');
    if (invInput) {
        if (item.inv && item.inv !== 'Б/Н') {
            invInput.value = item.inv;
            if (noInvCheck && noInvCheck.checked) {
                noInvCheck.checked = false;
                window.toggleNoInvMode();
            }
        }
    }
    
    const typeEl = document.getElementById('roomType');
    if (typeEl && item.type) {
        let found = false;
        for (let i = 0; i < typeEl.options.length; i++) {
            if (typeEl.options[i].value === item.type) {
                typeEl.selectedIndex = i;
                found = true;
                break;
            }
        }
        if (!found) {
            const opt = document.createElement('option');
            opt.value = item.type;
            opt.text = item.type;
            opt.selected = true;
            typeEl.appendChild(opt);
        }
        typeEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    setTimeout(() => {
        const modelEl = document.getElementById('roomModel');
        if (modelEl && item.name) {
            let found = false;
            for (let i = 0; i < modelEl.options.length; i++) {
                if (modelEl.options[i].value === item.name) {
                    modelEl.selectedIndex = i;
                    found = true;
                    break;
                }
            }
            if (!found) {
                const opt = document.createElement('option');
                opt.value = item.name;
                opt.text = item.name;
                opt.selected = true;
                modelEl.appendChild(opt);
            }
        }
    }, 100);
    
    if (item.location) document.getElementById('roomLoc').value = item.location;
    if (item.sn) document.getElementById('roomSN').value = item.sn;
    if (item.person) document.getElementById('roomMVO').value = cleanMVO(item.person);
    
    const statusEl = document.getElementById('roomStatus');
    if (statusEl && item.status) {
        const statusMap = {
            'В роботі': 'В роботі',
            'На складі': 'В роботі',
            'Експлуатується': 'В роботі',
            'Списано': 'Списано',
            'Для списання': 'Для списання',
            'Готується на списання': 'Готується на списання',
            'В ремонті': 'В ремонті'
        };
        statusEl.value = statusMap[item.status] || 'В роботі';
    }
    
    setTimeout(updateFieldLabels, 150);
}

// ==========================================
// БЛОКУВАННЯ/РОЗБЛОКУВАННЯ ПОЛІВ
// ==========================================
window.toggleNoInvMode = () => {
    const checkEl = document.getElementById('noInvCheck');
    const roomInv = document.getElementById('roomInv');
    const roomMVO = document.getElementById('roomMVO');
    const dropdown = document.getElementById('roomInvDropdown');
    const roomMVOLabel = document.getElementById('roomMVOLabel');
    const roomModel = document.getElementById('roomModel');
    const roomType = document.getElementById('roomType');
    
    if (!checkEl || !roomInv || !roomMVO) return;

    if (checkEl.checked) {
        roomInv.value = "Б/Н";
        roomInv.disabled = true;
        roomInv.readOnly = true;
        roomInv.style.backgroundColor = "#f1f5f9";
        roomInv.style.borderColor = "#ef4444";
        
        roomMVO.disabled = false;
        roomMVO.readOnly = false;
        roomMVO.style.backgroundColor = "#ffffff";
        roomMVO.style.borderColor = "#cbd5e1";
        
        if (roomType) {
            roomType.disabled = false;
            roomType.style.backgroundColor = "#ffffff";
        }
        if (roomModel) {
            roomModel.disabled = false;
            roomModel.style.backgroundColor = "#ffffff";
        }
        
        if (roomMVOLabel) {
            roomMVOLabel.innerText = "МВО (Введіть вручну)";
        }
        
        if (dropdown) dropdown.style.display = 'none';
        
    } else {
        roomInv.disabled = false;
        roomInv.readOnly = false;
        roomInv.style.backgroundColor = "#ffffff";
        roomInv.style.borderColor = "#cbd5e1";
        
        roomMVO.disabled = false;
        roomMVO.readOnly = false;
        roomMVO.style.backgroundColor = "#ffffff";
        roomMVO.style.borderColor = "#cbd5e1";
        roomMVO.placeholder = "";
        
        if (roomType) {
            roomType.disabled = false;
            roomType.style.backgroundColor = "#ffffff";
        }
        if (roomModel) {
            roomModel.disabled = false;
            roomModel.style.backgroundColor = "#ffffff";
        }
        
        if (roomMVOLabel) {
            roomMVOLabel.innerText = "МВО (Матеріально-відповідальна особа)";
        }
    }
    
    updateFieldLabels();
};

// ==========================================
// ОНОВЛЕННЯ ЛЕЙБЛІВ
// ==========================================
function updateFieldLabels() {
    document.querySelectorAll('.field input, .field select, .field textarea').forEach(el => {
        const wrapper = el.closest('.field');
        if (wrapper) {
            if (el.value && el.value.toString().trim() !== '') {
                wrapper.classList.add('has-val');
                const label = wrapper.querySelector('label');
                if (label) {
                    label.style.transform = 'translateY(-24px) scale(0.85)';
                    label.style.color = 'var(--primary)';
                }
            } else {
                wrapper.classList.remove('has-val');
                const label = wrapper.querySelector('label');
                if (label) {
                    label.style.transform = '';
                    label.style.color = '';
                }
            }
        }
    });
}

// ==========================================
// ЗАВАНТАЖЕННЯ JSON ФАЙЛІВ
// ==========================================
window.handleQuickJsonUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const itemId = window.currentUploadItemId;
    if (!itemId) {
        showToast("Спочатку додайте техніку в кабінет", "error");
        event.target.value = '';
        return;
    }
    
    console.log("Завантаження JSON для ID:", itemId);
    showToast("⏳ Завантаження характеристик...", "info");
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const specsData = JSON.parse(e.target.result);
            console.log("JSON дані:", specsData);
            
            let roomAssignmentId = null;
            
            if (window.globalRoomsData) {
                const roomItem = window.globalRoomsData.find(item => 
                    item.inventory_id == itemId || item.id == itemId
                );
                if (roomItem) {
                    roomAssignmentId = roomItem.id;
                }
            }
            
            if (!roomAssignmentId) {
                try {
                    const response = await fetch(`api.php?action=get_room_by_inventory&inventory_id=${itemId}`);
                    const data = await response.json();
                    if (data && data.id) {
                        roomAssignmentId = data.id;
                    }
                } catch (err) {
                    console.error("Помилка отримання room_assignment_id:", err);
                }
            }
            
            const targetId = roomAssignmentId || itemId;
            console.log("Відправка оновлення для ID:", targetId);
            
            const result = await apiRequest('batch_update_specs', { 
                updates: [{ 
                    id: targetId, 
                    specs: specsData 
                }] 
            });
            
            console.log("Результат збереження:", result);
            
            if (result && result.success) {
                showToast('✅ Характеристики успішно прикріплено!', 'success');
                event.target.value = '';
                window.currentUploadItemId = null;
                window.globalRoomsData = await apiRequest('get_rooms');
                window.renderRoomsTable();
            } else {
                showToast('❌ Помилка при збереженні на сервері', 'error');
            }
            
        } catch (err) {
            console.error("Помилка читання JSON:", err);
            showToast('❌ Помилка читання JSON файлу: ' + err.message, 'error');
            event.target.value = '';
        }
    };
    reader.readAsText(file);
};

window.handleSpecsUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    let successCount = 0;
    let failCount = 0;
    let updates = [];
    window.specsConflicts = [];
    
    showToast(`⏳ Обробка ${files.length} файлів...`, "info");

    for (let file of files) {
        try {
            const text = await file.text();
            const specsData = JSON.parse(text);
            
            const hostname = specsData.Hostname || specsData.hostname;
            if (!hostname) {
                window.specsConflicts.push({ 
                    file: file.name, 
                    specs: specsData, 
                    reason: "Немає Hostname в файлі" 
                });
                failCount++;
                continue;
            }
            
            console.log(`\n=== Обробка файлу ${file.name} ===`);
            console.log("Hostname з файлу:", hostname);
            
            let targetPC = null;
            
            if (window.globalRoomsData) {
                targetPC = findPCByHostname(hostname, window.globalRoomsData);
            }
            
            if (!targetPC) {
                const invInfo = extractFullInvNumber(file.name);
                if (invInfo) {
                    console.log("Інвентарний номер з назви файлу:", invInfo);
                    targetPC = findPCByFullInvNumber(invInfo.full, window.globalRoomsData);
                }
            }
            
            if (!targetPC && specsData.SerialNumber) {
                console.log("Пошук за серійним номером:", specsData.SerialNumber);
                targetPC = window.globalRoomsData.find(item => 
                    item.sn && item.sn === specsData.SerialNumber
                );
            }
            
            if (targetPC) {
                updates.push({ 
                    id: targetPC.id, 
                    specs: specsData,
                    hostname: hostname,
                    inv: targetPC.inv,
                    room: targetPC.room
                });
                successCount++;
                console.log(`✅ ЗНАЙДЕНО: Каб.${targetPC.room} | Інв: ${targetPC.inv} | Host: ${targetPC.hostname}`);
            } else {
                window.specsConflicts.push({ 
                    file: file.name, 
                    specs: specsData, 
                    hostname: hostname,
                    reason: "Не знайдено в базі"
                });
                failCount++;
                console.log(`❌ НЕ ЗНАЙДЕНО: ${hostname}`);
            }
            
        } catch (err) {
            console.error("Помилка файлу:", file.name, err);
            window.specsConflicts.push({ 
                file: file.name, 
                reason: "Помилка парсингу JSON: " + err.message 
            });
            failCount++;
        }
    }

    if (updates.length > 0) {
        try {
            console.log("\n=== Відправка оновлень на сервер ===");
            console.log("Кількість оновлень:", updates.length);
            
            const result = await apiRequest('batch_update_specs', { updates });
            
            console.log("Результат від сервера:", result);
            
            if (result && result.success) {
                showToast(`✅ Успішно оновлено конфігурації для ${successCount} ПК!`, "success");
                window.globalRoomsData = await apiRequest('get_rooms');
                window.renderRoomsTable();
            } else {
                showToast("❌ Помилка при збереженні на сервері: " + (result.error || 'Невідома помилка'), "error");
            }
            
        } catch (err) {
            console.error("Помилка API:", err);
            showToast("❌ Помилка збереження: " + err.message, "error");
        }
    }
    
    if (window.specsConflicts.length > 0) {
        renderSpecsConflicts();
        const modal = document.getElementById('specsConflictModal');
        if (modal) modal.style.display = 'flex';
        showToast(`⚠️ ${window.specsConflicts.length} файлів потребують ручної прив'язки.`, "warning");
        
        console.log("\n=== КОНФЛІКТИ ===");
        console.log(window.specsConflicts);
    }

    event.target.value = "";
};

function extractFullInvNumber(text) {
    if (!text) return null;
    
    const patterns = [
        /(\d{5,9})[_\\.\/\\\\-](\d+)/i,
        /(\d{5,9})[_\\.\/\\\\-](\w+)/i,
        /(\d{5,9})/i
    ];
    
    for (let pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            if (match[2]) {
                return {
                    full: match[0],
                    inv: match[1],
                    index: match[2],
                    separator: text.includes('_') ? '_' : 
                               text.includes('.') ? '.' :
                               text.includes('/') ? '/' :
                               text.includes('\\') ? '\\' : '-'
                };
            } else {
                return {
                    full: match[1],
                    inv: match[1],
                    index: null,
                    separator: null
                };
            }
        }
    }
    return null;
}

function findPCByFullInvNumber(searchText, data) {
    if (!searchText || !data) return null;
    
    const invInfo = extractFullInvNumber(searchText);
    if (!invInfo) return null;
    
    console.log("Пошук за інвентарним номером:", invInfo);
    
    let exactMatch = data.find(item => {
        if (!item.inv) return false;
        const itemInv = String(item.inv).trim();
        const itemInvInfo = extractFullInvNumber(itemInv);
        
        if (invInfo.index && itemInvInfo && itemInvInfo.index) {
            return itemInvInfo.full === invInfo.full;
        } else if (!invInfo.index && !itemInvInfo.index) {
            return itemInvInfo.inv === invInfo.inv;
        } else if (invInfo.index && !itemInvInfo.index) {
            return itemInvInfo.inv === invInfo.inv;
        } else if (!invInfo.index && itemInvInfo.index) {
            return itemInvInfo.inv === invInfo.inv;
        }
        return false;
    });
    
    if (exactMatch) {
        console.log("Знайдено точний збіг:", exactMatch);
        return exactMatch;
    }
    
    const invOnlyMatch = data.find(item => {
        if (!item.inv) return false;
        const itemInvInfo = extractFullInvNumber(String(item.inv));
        return itemInvInfo && itemInvInfo.inv === invInfo.inv;
    });
    
    if (invOnlyMatch) {
        console.log("Знайдено збіг за інвентарним номером без індексу:", invOnlyMatch);
    }
    
    return invOnlyMatch;
}

function findPCByHostname(hostname, data) {
    if (!hostname || !data) return null;
    
    console.log("Пошук за hostname:", hostname);
    
    let found = data.find(item => 
        item.hostname && item.hostname.toLowerCase() === hostname.toLowerCase()
    );
    if (found) {
        console.log("Знайдено точний збіг hostname:", found);
        return found;
    }
    
    const invInfo = extractFullInvNumber(hostname);
    if (invInfo) {
        console.log("Витягнуто інвентарний номер з hostname:", invInfo);
        found = findPCByFullInvNumber(invInfo.full, data);
        if (found) return found;
    }
    
    return null;
}

// ==========================================
// РЕНДЕРИНГ ТАБЛИЦІ
// ==========================================
window.renderRoomsTable = () => {
    console.log("renderRoomsTable called");
    
    const tbody = document.getElementById('roomsTableBody');
    if (!tbody) return;
    
    if (!window.globalRoomsData || window.globalRoomsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">❓ Техніку не знайдено</td></tr>';
        return;
    }

    const filterLoc = document.getElementById('roomFilterLoc')?.value || 'all';
    const filterNum = document.getElementById('roomFilterNum')?.value.toLowerCase() || '';
    const filterStatus = document.getElementById('roomFilterStatus')?.value || 'all';
    const filterInvType = document.getElementById('roomFilterInvType')?.value || 'all';
    const filterSearch = document.getElementById('roomFilterSearch')?.value.toLowerCase() || '';

    let filtered = [...window.globalRoomsData];

    if (filterLoc !== 'all') {
        filtered = filtered.filter(i => (i.loc || i.location) === filterLoc);
    }
    
    if (filterNum) {
        filtered = filtered.filter(i => String(i.room || '').toLowerCase().includes(filterNum));
    }
    
    if (filterStatus !== 'all') {
        filtered = filtered.filter(i => i.status === filterStatus);
    }
    
    if (filterInvType !== 'all') {
        if (filterInvType === 'no_inv') {
            filtered = filtered.filter(i => !i.inv || i.inv === 'Б/Н');
        } else if (filterInvType === 'has_inv') {
            filtered = filtered.filter(i => i.inv && i.inv !== 'Б/Н');
        }
    }
    
    if (filterSearch) {
        filtered = filtered.filter(i => 
            (i.model && i.model.toLowerCase().includes(filterSearch)) ||
            (i.inv && String(i.inv).toLowerCase().includes(filterSearch)) ||
            (i.person && i.person.toLowerCase().includes(filterSearch)) ||
            (i.pcUser && i.pcUser.toLowerCase().includes(filterSearch)) ||
            (i.room && String(i.room).toLowerCase().includes(filterSearch)) ||
            (i.hostname && i.hostname.toLowerCase().includes(filterSearch))
        );
    }

    filtered.sort((a, b) => {
        const locA = (a.loc || a.location || '').toLowerCase();
        const locB = (b.loc || b.location || '').toLowerCase();
        
        if (locA < locB) return -1;
        if (locA > locB) return 1;
        
        const roomA = a.room || '';
        const roomB = b.room || '';
        
        const numA = parseInt(roomA);
        const numB = parseInt(roomB);
        
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        
        if (roomA < roomB) return -1;
        if (roomA > roomB) return 1;
        
        return 0;
    });

    currentFilteredRoomsData = filtered;

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">❓ Техніку не знайдено</td></tr>';
        return;
    }

    let currentLoc = '';
    let html = '';

    // БЕЗПЕЧНА ПЕРЕВІРКА ПРАВ АДМІНІСТРАТОРА (виправлено помилку з TypeError)
    const isAdminUser = typeof window.isAdmin === 'function' ? window.isAdmin() : !!window.isAdmin;

    filtered.forEach(item => {
        const itemLoc = item.loc || item.location || 'Не вказано';
        
        if (itemLoc !== currentLoc) {
            currentLoc = itemLoc;
            html += `<tr class="location-header" style="background: var(--primary-light);">
                <td colspan="6" style="padding: 8px 18px; font-weight: 700; color: var(--primary);">
                    📍 ${currentLoc}
                </td>
            </tr>`;
        }
        
        const statusColor = item.status === 'В роботі' ? '#16a34a' : 
            (item.status === 'В ремонті' ? '#2563eb' : 
            (item.status === 'Готується на списання' ? '#8b5cf6' : 
            (item.status === 'Для списання' ? '#dc2626' : 
            (item.status === 'Списано' ? '#94a3b8' : '#64748b'))));
        
        const invDisplay = item.inv && item.inv !== 'Б/Н' ? 
            `<span style="color: #0ea5e9; font-weight: 600;">${item.inv}</span>` : 
            '<span style="color: #f59e0b; font-weight: 600;">Б/Н</span>';
        
        const hasSpecs = item.specs ? 
            `<span style="background: #10b98120; color: #10b981; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 5px;">✓ JSON</span>` : 
            '';

        // Екрануємо одинарні лапки для уникнення помилок у викликах onclick
        const safeRoomName = String(item.room || '?').replace(/'/g, "\\'");

        html += `
        <tr>
            <td data-label="Локація"><b>${item.loc || item.location || 'Не вказано'}</b><br>Каб. ${item.room || '-'}</td>
            <td data-label="Техніка">
                <b>${item.model || 'Без назви'}</b> ${hasSpecs}<br>
                <span style="font-size: 11px; color: #64748b;">${item.type || '-'}</span>
            </td>
            <td data-label="Номери">
                ${invDisplay}<br>
                ${item.sn ? 'S/N: ' + item.sn : ''}
                ${item.ip ? '<br>IP: ' + item.ip : ''}
                ${item.hostname ? '<br>Host: ' + item.hostname : ''}
            </td>
            <td data-label="Відповідальні">
                <b>Користувач:</b> ${item.person || item.pcUser || 'Немає'}<br>
                <b>МВО:</b> ${cleanMVO(item.mvo || 'Не призначено')}
            </td>
            <td data-label="Статус">
                <span style="color: ${statusColor}; font-weight: 600; font-size: 12px;">● ${item.status || 'В роботі'}</span>
            </td>
            <td data-label="Дії" class="actions-col" style="${isAdminUser ? 'display: flex; flex-direction: column; gap: 5px; min-width: 250px;' : 'display:none;'}">
                <div style="display: flex; gap: 5px; width: 100%;">
                    <button class="btn-secondary" style="flex: 1; padding: 6px 8px; font-size: 12px;" onclick="window.editRoomItem('${item.id}')">✏️ Редагувати</button>
                    <button class="btn-secondary" style="flex: 1; padding: 6px 8px; font-size: 12px; color: #ef4444;" onclick="window.deleteRoomItem('${item.id}')">🗑️ Видалити</button>
                </div>
                <div style="display: flex; gap: 5px; width: 100%;">
                    <button class="btn-secondary" style="flex: 1; padding: 6px 8px; font-size: 12px;" onclick="window.openNoteModal('room', '${item.id}', 'Каб. ${safeRoomName}')">📝 Примітка</button>
                    ${item.specs ? 
                        `<button class="btn-secondary" style="flex: 1; padding: 6px 8px; font-size: 12px;" onclick="window.openSpecsModal('${item.id}')">📊 Характеристики</button>` : 
                        `<button class="btn-secondary" style="flex: 1; padding: 6px 8px; font-size: 12px; opacity: 0.5;" disabled>📊 Характеристики</button>`
                    }
                </div>
            </td>
        </tr>`;
    });

    tbody.innerHTML = html;
    
    if (window.updateRoomsCounter) window.updateRoomsCounter();
};

// ==========================================
// ПРИМІТКИ
// ==========================================
window.openNoteModal = async function(targetType, targetId, title) {
    console.log(`Відкриття приміток: ${targetType} ID: ${targetId}`);
    
    const modal = document.getElementById('noteModal');
    if (!modal) {
        console.error("❌ Модальне вікно noteModal не знайдено в DOM!");
        showToast("Помилка: вікно приміток не знайдено", "error");
        return;
    }
    
    // Заповнюємо заголовок та приховані поля
    document.getElementById('noteModalTitle').innerText = title || 'Примітки';
    document.getElementById('noteTargetType').value = targetType;
    document.getElementById('noteTargetId').value = targetId;
    
    // Завантажуємо список приміток
    await loadNotes(targetType, targetId);
    
    // Показуємо вікно
    modal.style.display = 'flex';
    modal.style.zIndex = '10000';
    
    console.log("✅ Модальне вікно приміток відкрито", modal);
};

window.closeNoteModal = function() {
    const modal = document.getElementById('noteModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('noteForm').reset();
    }
};

async function loadNotes(targetType, targetId) {
    const container = document.getElementById('noteListContainer');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 20px;">⏳ Завантаження...</div>';
    
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
        if (!response.ok) throw new Error("HTTP Помилка: " + response.status); // Додав перевірку
        const notes = await response.json();
        
        if (!notes || notes.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #64748b;">📭 Немає приміток</div>';
            return;
        }
        
        let html = '';
        notes.forEach(note => {
            const date = new Date(note.created_at).toLocaleString('uk-UA');
            html += `
                <div style="border-bottom:1px solid #e2e8f0; padding:15px 0;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <div>
                            <strong style="color: #0052b4;">${note.creator_name || 'Система'}</strong>
                            ${note.is_private ? '<span style="background:#f97316; color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:5px;">🔒</span>' : ''}
                        </div>
                        <span style="color:#64748b; font-size:11px;">🕒 ${date}</span>
                    </div>
                    <div style="font-size:13px; white-space:pre-wrap; background:#f8fafc; padding:10px; border-radius:8px;">
                        ${note.note_text.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
        
    } catch (err) {
        console.error("Помилка завантаження приміток:", err);
        container.innerHTML = '<div style="text-align: center; padding: 20px; color:#ef4444;">❌ Помилка завантаження</div>';
    }
}

document.getElementById('noteForm')?.addEventListener('submit', async (e) => {
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

// ==========================================
// ЕКСПОРТ З ВИБОРОМ ПОЛІВ (КАБІНЕТИ)
// ==========================================
window.openRoomExportModal = function() {
    let modal = document.getElementById('roomExportModal');
    
    // Якщо вікно випадково стерлося з HTML, JS створює його самостійно
    if (!modal) {
        const modalHtml = `
        <div id="roomExportModal" class="modal">
            <div class="modal-content small">
                <div class="modal-header">
                    <h2>📥 Експорт кабінетів в Excel</h2>
                    <button class="btn-secondary" onclick="window.closeRoomExportModal()" style="padding: 6px 12px;">✖ Закрити</button>
                </div>
                <div class="modal-body">
                    <p style="color: #64748b; margin-bottom: 15px;">Оберіть поля для вивантаження (<b id="roomExportCount" style="color: #0ea5e9;">0</b> записів):</p>
                    <div class="export-fields-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <label class="custom-checkbox"><input type="checkbox" name="roomExportField" value="loc" checked> 🏢 Будівля</label>
                        <label class="custom-checkbox"><input type="checkbox" name="roomExportField" value="room" checked> 🚪 Кабінет</label>
                        <label class="custom-checkbox"><input type="checkbox" name="roomExportField" value="type" checked> 💻 Тип</label>
                        <label class="custom-checkbox"><input type="checkbox" name="roomExportField" value="model" checked> 📱 Модель</label>
                        <label class="custom-checkbox"><input type="checkbox" name="roomExportField" value="inv" checked> 🔢 Інвентарний №</label>
                        <label class="custom-checkbox"><input type="checkbox" name="roomExportField" value="sn"> 🔢 Серійний №</label>
                        <label class="custom-checkbox"><input type="checkbox" name="roomExportField" value="ip"> 🌐 IP-адреса</label>
                        <label class="custom-checkbox"><input type="checkbox" name="roomExportField" value="hostname"> 💻 Hostname</label>
                        <label class="custom-checkbox"><input type="checkbox" name="roomExportField" value="person" checked> 👤 Користувач</label>
                        <label class="custom-checkbox"><input type="checkbox" name="roomExportField" value="mvo" checked> 🔰 МВО</label>
                        <label class="custom-checkbox"><input type="checkbox" name="roomExportField" value="status" checked> 📊 Статус</label>
                    </div>
                </div>
                <div class="modal-footer" style="justify-content: space-between;">
                    <div style="display: flex; gap: 10px;">
                        <button class="btn-secondary" onclick="document.querySelectorAll('#roomExportModal input[name=roomExportField]').forEach(cb => cb.checked = true)">✅ Всі</button>
                        <button class="btn-secondary" onclick="document.querySelectorAll('#roomExportModal input[name=roomExportField]').forEach(cb => cb.checked = false)">❌ Жодного</button>
                    </div>
                    <button class="btn-primary" onclick="window.exportRoomTableWithFields()">📥 Завантажити</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = document.getElementById('roomExportModal');
    }
    
    // Оновлюємо лічильник записів
    const countEl = document.getElementById('roomExportCount');
    if (countEl && currentFilteredRoomsData) {
        countEl.innerText = currentFilteredRoomsData.length;
    }
    
    modal.style.display = 'flex';
    modal.style.zIndex = '10000';
};

window.closeRoomExportModal = function() {
    const modal = document.getElementById('roomExportModal');
    if (modal) modal.style.display = 'none';
};

window.exportRoomTableWithFields = function() {
    // 1. Перевірка наявності даних
    if (!currentFilteredRoomsData || currentFilteredRoomsData.length === 0) {
        if (typeof showToast === 'function') showToast("Немає даних для експорту. Змініть фільтри.", "error");
        return;
    }
    
    // 2. Збір вибраних полів з модального вікна
    const selectedFields = [];
    document.querySelectorAll('#roomExportModal input[name="roomExportField"]:checked').forEach(cb => {
        selectedFields.push(cb.value);
    });
    
    if (selectedFields.length === 0) {
        if (typeof showToast === 'function') showToast("Виберіть хоча б одне поле для експорту", "error");
        return;
    }
    
    // 3. Мапінг назв колонок
    const fieldMap = {
        'loc': 'Будівля',
        'room': 'Кабінет',
        'type': 'Тип',
        'model': 'Модель',
        'inv': 'Інвентарний №',
        'sn': 'Серійний №',
        'ip': 'IP-адреса',
        'hostname': 'Hostname',
        'person': 'Користувач',
        'mvo': 'МВО',
        'status': 'Статус'
    };
    
    // 4. Формування даних для Excel
    const exportData = currentFilteredRoomsData.map(item => {
        const row = {};
        selectedFields.forEach(field => {
            const header = fieldMap[field] || field;
            let value = '-';
            
            switch(field) {
                case 'loc': value = item.loc || item.location || '-'; break;
                case 'model': value = item.model || item.name || '-'; break;
                case 'inv': value = (!item.inv || item.inv === 'Б/Н') ? 'Б/Н' : item.inv; break;
                case 'person': value = item.person || item.pcUser || '-'; break;
                case 'mvo': value = item.mvo ? item.mvo.replace(/\s*\(\s*\d+\s*\)\s*/g, '').trim() : '-'; break;
                default: value = item[field] || '-';
            }
            
            row[header] = value;
        });
        return row;
    });
    
    // 5. Генерація Excel файлу
    try {
        const xlsxLib = typeof XLSX !== 'undefined' ? XLSX : window.XLSX;
        if (!xlsxLib) {
            if (typeof showToast === 'function') showToast("Бібліотека XLSX не завантажена", "error");
            return;
        }
        
        const ws = xlsxLib.utils.json_to_sheet(exportData);
        
        // Автоматичне налаштування ширини колонок
        const colWidths = [];
        selectedFields.forEach(field => {
            const headerText = fieldMap[field];
            let maxLength = headerText.length;
            exportData.forEach(row => {
                const cellValue = String(row[headerText] || '');
                if (cellValue.length > maxLength) maxLength = cellValue.length;
            });
            // Обмежуємо максимальну ширину, щоб таблиця не була безкінечною
            colWidths.push({ wch: Math.min(maxLength + 2, 50) }); 
        });
        ws['!cols'] = colWidths;

        const wb = xlsxLib.utils.book_new();
        xlsxLib.utils.book_append_sheet(wb, ws, 'Кабінети');
        
        const dateStr = new Date().toLocaleDateString('uk-UA').replace(/\./g, '-');
        xlsxLib.writeFile(wb, `Kabinetny_oblik_${dateStr}.xlsx`);
        
        if (typeof showToast === 'function') showToast(`✅ Експортовано ${exportData.length} записів`, 'success');
        window.closeRoomExportModal();
        
    } catch (e) {
        console.error("Помилка експорту кабінетів:", e);
        if (typeof showToast === 'function') showToast('Помилка експорту: ' + e.message, 'error');
    }
};

// ==========================================
// КОНФЛІКТИ JSON
// ==========================================
function renderSpecsConflicts() {
    const tbody = document.getElementById('conflictTableBody');
    if (!tbody) return;

    const allPCs = [];
    
    if (window.globalRoomsData) {
        allPCs.push(...window.globalRoomsData.filter(item => 
            item.type && (item.type.toLowerCase().includes('пк') || 
                         item.type.toLowerCase().includes('комп') ||
                         item.type.toLowerCase().includes('ноутбук') ||
                         item.type.toLowerCase().includes('workstation') ||
                         item.type.toLowerCase().includes('персональний'))
        ));
    }

    allPCs.sort((a, b) => {
        const locA = (a.loc || a.location || '').toLowerCase();
        const locB = (b.loc || b.location || '').toLowerCase();
        if (locA < locB) return -1;
        if (locA > locB) return 1;
        
        const roomA = a.room || '';
        const roomB = b.room || '';
        return roomA.localeCompare(roomB, undefined, {numeric: true});
    });

    const pcOptions = allPCs
        .map(i => {
            const location = i.room ? `Каб.${i.room}` : 'Склад';
            const locFull = i.loc || i.location || 'Не вказано';
            const invDisplay = i.inv && i.inv !== 'Б/Н' ? i.inv : 'Б/Н';
            const hostDisplay = i.hostname ? ` (${i.hostname})` : '';
            return `<option value="${i.id}">${locFull} | ${location} | ${i.model || i.name} ${hostDisplay} (Інв: ${invDisplay})</option>`;
        })
        .join("");

    tbody.innerHTML = window.specsConflicts.map((c, idx) => {
        const specsPreview = c.specs ? 
            `<div style="font-size:10px; background:#f1f5f9; padding:5px; margin-top:5px; border-radius:4px; max-height:60px; overflow:auto;">
                <b>Hostname:</b> ${c.specs.Hostname || c.specs.hostname || '-'}<br>
                <b>OS:</b> ${c.specs.OS || c.specs.os || '-'}<br>
                <b>CPU:</b> ${c.specs.Processor ? c.specs.Processor.substring(0, 40) + '...' : '-'}
            </div>` : '';
        
        return `
        <tr id="conflict-row-${idx}">
            <td data-label="Дані з файлу" style="max-width: 300px;">
                <b style="color:var(--primary)">${c.hostname || 'Невідомо'}</b><br>
                <span style="font-size:11px; color:var(--text-muted)">📄 ${c.file}</span><br>
                <span style="font-size:10px; color:#ef4444">${c.reason || ''}</span>
                ${specsPreview}
            </td>
            <td data-label="Оберіть ПК з бази">
                <select id="conflict-select-${idx}" style="width:100%; max-width: 100%; height: 38px; padding: 4px 8px; border-radius: 8px;">
                    <option value="">-- Оберіть ПК зі списку --</option>
                    ${pcOptions}
                </select>
            </td>
            <td data-label="Дія" class="actions-col">
                <button class="btn-primary" style="padding:6px 12px; font-size:12px;" onclick="window.resolveSpecsConflict(${idx})">💾 Прив'язати</button>
                <button class="btn-secondary" style="padding:6px 12px; font-size:12px; margin-top:5px;" onclick="window.previewSpecsData(${idx})">👁️ Перегляд</button>
            </td>
        </tr>
    `}).join("");
}

window.previewSpecsData = (idx) => {
    const conflict = window.specsConflicts[idx];
    if (!conflict || !conflict.specs) return;
    
    const modal = document.getElementById('specsPreviewModal');
    const content = document.getElementById('specsPreviewContent');
    
    if (modal && content) {
        content.innerHTML = `<pre style="background: var(--bg-body); padding: 15px; border-radius: 8px; overflow: auto; max-height: 400px;">${JSON.stringify(conflict.specs, null, 2)}</pre>`;
        modal.style.display = 'flex';
    }
};

window.closeSpecsPreviewModal = () => {
    const modal = document.getElementById('specsPreviewModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.resolveSpecsConflict = async (idx) => {
    const conflict = window.specsConflicts[idx];
    const select = document.getElementById(`conflict-select-${idx}`);
    
    if (!select || !select.value) {
        showToast("Будь ласка, оберіть ПК зі списку!", "error");
        return;
    }

    try {
        await apiRequest('batch_update_specs', { 
            updates: [{ 
                id: select.value, 
                specs: conflict.specs 
            }] 
        });
        
        showToast(`✅ Характеристики успішно прив'язані!`, "success");
        
        const row = document.getElementById(`conflict-row-${idx}`);
        if (row) row.remove();
        
        window.specsConflicts.splice(idx, 1);
        
        if (window.specsConflicts.length === 0) {
            const modal = document.getElementById('specsConflictModal');
            if (modal) modal.style.display = 'none';
        }
        
        window.globalRoomsData = await apiRequest('get_rooms');
        window.renderRoomsTable();
        
    } catch (err) {
        showToast("❌ Помилка збереження: " + err.message, "error");
    }
};

// ==========================================
// ІНІЦІАЛІЗАЦІЯ
// ==========================================
export function initRoomsLogic() {
    console.log("initRoomsLogic запущено");
    
    // Завантажуємо локації для фільтра
    fetch('api.php?action=get_locations')
        .then(res => res.json())
        .then(locations => {
            const filterLoc = document.getElementById('roomFilterLoc');
            const formLoc = document.getElementById('roomLoc');
            if (filterLoc) {
                filterLoc.innerHTML = '<option value="all">Всі локації</option>' + 
                    locations.map(l => `<option value="${l.name}">${l.name}</option>`).join('');
            }
            if (formLoc) {
                formLoc.innerHTML = '<option value="">Виберіть локацію</option>' + 
                    locations.map(l => `<option value="${l.name}">${l.name}</option>`).join('');
            }
        })
        .catch(err => console.error("Помилка завантаження локацій:", err));
    
    // Завантажуємо типи техніки
    fetch('api.php?action=get_equipment_types')
        .then(res => res.json())
        .then(types => {
            const typeEl = document.getElementById('roomType');
            if (typeEl) {
                typeEl.innerHTML = '<option value="">Виберіть тип</option>' + 
                    types.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
            }
        })
        .catch(err => console.error("Помилка завантаження типів:", err));
    
    // Ініціалізація подій
    const noInvCheck = document.getElementById('noInvCheck');
    if (noInvCheck) {
        noInvCheck.addEventListener('change', window.toggleNoInvMode);
    }
    
    const roomInv = document.getElementById('roomInv');
    if (roomInv) {
        roomInv.addEventListener('input', window.handleRoomInvInput);
        roomInv.addEventListener('focus', (e) => {
            if (e.target.value.length >= 2) {
                window.handleRoomInvInput();
            }
        });
        
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('roomInvDropdown');
            if (dropdown && e.target !== roomInv && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }
    
    ['roomFilterLoc', 'roomFilterStatus', 'roomFilterInvType'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', window.renderRoomsTable);
    });
    ['roomFilterNum', 'roomFilterSearch'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', window.renderRoomsTable);
    });
    
    if (noInvCheck) {
        window.toggleNoInvMode();
    }
    
    // Завантажуємо дані складу
    if (!window.globalInventory) {
        fetch('api.php?action=get_inventory')
            .then(res => res.json())
            .then(data => {
                window.globalInventory = data.map(item => ({
                    ...item,
                    inv: item.inv || item.inv_number || 'Б/Н',
                    name: item.name || item.model || item.model_name || 'Без назви',
                    type: item.type || 'Обладнання',
                    location: item.location || item.location_name || '',
                    person: item.person || item.mvo || '',
                    sn: item.sn || item.serial_number || ''
                }));
                console.log("Початкове завантаження складу:", window.globalInventory.length);
            })
            .catch(err => console.error("Помилка завантаження складу:", err));
    }
}

// ==========================================
// ЗБЕРЕЖЕННЯ / РЕДАГУВАННЯ
// ==========================================
document.getElementById('roomAddForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('editRoomItemId')?.value;
    
    const locValue = document.getElementById('roomLoc').value;
    const roomValue = document.getElementById('roomNum').value;
    const mvoValue = cleanMVO(document.getElementById('roomMVO').value);
    const personValue = document.getElementById('roomPerson').value;
    const invValue = document.getElementById('roomInv').value === 'Б/Н' ? 'Б/Н' : document.getElementById('roomInv').value;
    const typeValue = document.getElementById('roomType').value;
    const modelValue = document.getElementById('roomModel').value;
    const statusValue = document.getElementById('roomStatus')?.value || 'В роботі';
    const snValue = document.getElementById('roomSN')?.value || '';
    const ipValue = document.getElementById('roomIP')?.value || '';
    const hostnameValue = document.getElementById('roomHostname')?.value || '';
    
    console.log("Збереження форми:", {
        editId: editId || 'новий запис',
        loc: locValue,
        room: roomValue,
        mvo: mvoValue,
        person: personValue,
        inv: invValue,
        type: typeValue,
        model: modelValue,
        status: statusValue,
        sn: snValue,
        ip: ipValue,
        hostname: hostnameValue
    });
    
    const newData = {
        loc: locValue, 
        room: roomValue, 
        mvo: mvoValue,      
        person: personValue, 
        inv: invValue, 
        type: typeValue, 
        model: modelValue,
        status: statusValue, 
        sn: snValue, 
        ip: ipValue,
        hostname: hostnameValue, 
        price: 0,
        specs: window.tempWarehouseSpecs || null
    };

    try {
        if (editId) {
            console.log("Оновлення запису з ID:", editId);
            await apiRequest('update_room_item', { id: editId, ...newData });
            showToast("Успішно оновлено!", "success");
            await logAction("Кабінети", `Оновлено техніку ${newData.inv} в каб. ${newData.room}`);
        } else {
            console.log("Додавання нового запису");
            const res = await apiRequest('add_room_item', newData);
            console.log("Відповідь сервера:", res);
            
            if (res && res.id) {
                window.currentUploadItemId = res.id;
            }
            showToast("Успішно додано!", "success");
            await logAction("Кабінети", `Додано техніку ${newData.inv} в каб. ${newData.room}`);
            
            const t = newData.type.toLowerCase();
            if ((t.includes('пк') || t.includes('ноутбук') || t.includes('комп')) && !newData.specs) {
                if (confirm(`Техніку "${newData.model}" успішно додано!\n\nБажаєте одразу завантажити файл конфігурації (.json) з флешки для неї?`)) {
                    document.getElementById('quickJsonUpload').click();
                }
            }
        }
        
        window.cancelRoomEdit(); 
        window.globalRoomsData = await apiRequest('get_rooms');
        window.renderRoomsTable();
    
    } catch (error) { 
        console.error("Помилка збереження:", error);
        showToast("Помилка при збереженні: " + error.message, "error"); 
    }
    
});

window.editRoomItem = (id) => {
    console.log("editRoomItem called with id:", id);
    
    const item = window.globalRoomsData.find(i => String(i.id) === String(id));
    
    if (!item) {
        console.error("Запис не знайдено:", id);
        console.log("Доступні записи:", window.globalRoomsData);
        showToast("Запис не знайдено", "error");
        return;
    }
    
    console.log("Редагуємо запис:", item);
    
    document.getElementById('editRoomItemId').value = item.id;
    document.getElementById('roomLoc').value = item.loc || item.location || '';
    document.getElementById('roomNum').value = item.room || '';
    document.getElementById('roomPerson').value = item.person || item.pcUser || '';
    document.getElementById('roomInv').value = item.inv || '';
    
    const checkEl = document.getElementById('noInvCheck');
    if (checkEl) {
        if (!item.inv || item.inv === 'Б/Н' || item.inv === '') {
            checkEl.checked = true;
        } else {
            checkEl.checked = false;
        }
        window.toggleNoInvMode();
    }
    
    document.getElementById('roomMVO').value = cleanMVO(item.mvo || '');
    
    const typeEl = document.getElementById('roomType');
    if (typeEl && item.type) {
        console.log("Встановлюємо тип:", item.type);
        typeEl.value = item.type;
        
        const event = new Event('change', { bubbles: true });
        typeEl.dispatchEvent(event);
        
        setTimeout(() => {
            const modelEl = document.getElementById('roomModel');
            if (modelEl && item.model) {
                console.log("Встановлюємо модель:", item.model);
                modelEl.innerHTML = `<option value="${item.model}" selected>${item.model}</option>`;
                modelEl.value = item.model;
            }
            
            document.getElementById('roomStatus').value = item.status || 'В роботі';
            document.getElementById('roomSN').value = item.sn || '';
            document.getElementById('roomIP').value = item.ip || '';
            document.getElementById('roomHostname').value = item.hostname || '';
            
            updateFieldLabels();
        }, 200);
    }
    
    document.getElementById('roomSubmitBtn').innerHTML = '💾 Зберегти зміни';
    document.getElementById('roomCancelBtn').style.display = 'inline-block';
    
    window.tempWarehouseSpecs = item.specs || null;
    
    document.getElementById('roomAddForm').scrollIntoView({ behavior: 'smooth' });
    const formContainer = document.getElementById('roomFormContainer');
    if (formContainer && formContainer.style.display === 'none') {
        formContainer.style.display = 'block';
    }
};

window.cancelRoomEdit = () => {
    console.log("cancelRoomEdit called");
    
    const form = document.getElementById('roomAddForm');
    if (form) form.reset();
    
    document.getElementById('editRoomItemId').value = '';
    
    const checkEl = document.getElementById('noInvCheck');
    if (checkEl) {
        checkEl.checked = false;
        window.toggleNoInvMode();
    }
    
    window.tempWarehouseSpecs = null;
    
    document.getElementById('roomSubmitBtn').innerHTML = '✅ Внести в базу кабінету';
    document.getElementById('roomCancelBtn').style.display = 'none';
    
    updateFieldLabels();
};

window.deleteRoomItem = async (id) => {
    console.log("deleteRoomItem called with id:", id);
    
    if (!confirm("Прибрати цю техніку з кабінету? (На складі вона залишиться)")) {
        return;
    }
    
    const item = window.globalRoomsData.find(i => String(i.id) === String(id));
    if (!item) {
        showToast("Запис не знайдено", "error");
        return;
    }
    
    try {
        await apiRequest('delete_room_item', { id, inventory_id: item.inventory_id });
        await logAction("Кабінети", `Видалено одиницю техніки з кабінету (ID: ${id})`);
        showToast("Прибрано успішно", "success");
        
        window.globalRoomsData = await apiRequest('get_rooms');
        window.renderRoomsTable();
        
    } catch (e) {
        console.error("Помилка видалення:", e);
        showToast("Помилка: " + e.message, "error");
    }
};

// ==========================================
// ХАРАКТЕРИСТИКИ (КРАСИВЕ ВІДОБРАЖЕННЯ) - ГАРАНТОВАНИЙ СКРОЛ
// ==========================================
window.openSpecsModal = (id) => {
    const item = window.globalRoomsData.find(i => String(i.id) === String(id));
    if (!item || !item.specs) {
        if (typeof showToast === 'function') showToast("Характеристики відсутні", "warning");
        return;
    }
    
    let s;
    try { s = typeof item.specs === 'string' ? JSON.parse(item.specs) : item.specs; } 
    catch (err) { return; }

    // Використовуємо новий ID (specsModalV2), щоб ігнорувати зламані вікна в index.html
    let modal = document.getElementById('specsModalV2');
    if (!modal) {
        const modalHtml = `
        <div id="specsModalV2" class="modal" style="display: none; position: fixed; z-index: 99999; left: 0; top: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: 20px; box-sizing: border-box;">
            
            <div class="modal-content large" style="background: white; border-radius: 16px; width: 100%; max-width: 950px; display: flex; flex-direction: column; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); max-height: 90vh; overflow: hidden; position: relative;">
                
                <div class="modal-header" style="padding: 15px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; flex-shrink: 0;">
                    <h2 style="margin: 0; font-size: 20px; color: #0f172a;">🔍 Конфігурація (AIDA64)</h2>
                    <button class="btn-secondary" onclick="document.getElementById('specsModalV2').style.display='none'" style="padding: 6px 12px; font-size: 13px; cursor: pointer; border-radius: 8px; background: white; border: 1px solid #cbd5e1;">✖ Закрити</button>
                </div>
                
                <div class="modal-body" id="specsContentV2" style="padding: 0; background: var(--bg-body, #f8fafc); overflow-y: auto; flex: 1 1 auto; min-height: 0;"></div>
                
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = document.getElementById('specsModalV2');
    }

    const getVal = (val, defaultVal = 'Не вказано') => val ? val : defaultVal;

    // Логічні диски
    let logicalDisksHtml = '<div style="color: #64748b;">Немає даних</div>';
    if (s.LogicalDisks && Array.isArray(s.LogicalDisks)) {
        logicalDisksHtml = s.LogicalDisks.map(d => `<div style="padding: 6px 0; border-bottom: 1px dashed #cbd5e1; display: flex; gap: 8px;"><span style="color:#8b5cf6;">💿</span> <span style="word-break: break-word;">${d}</span></div>`).join('');
    } else if (s.LogicalDisks) {
        logicalDisksHtml = `<div style="display: flex; gap: 8px;"><span style="color:#8b5cf6;">💿</span> <span style="word-break: break-word;">${s.LogicalDisks}</span></div>`;
    }

    // Встановлене ПЗ
    let softwareHtml = '<div style="font-size: 12px; color: #64748b;">Немає даних</div>';
    if (s.Software && Array.isArray(s.Software)) {
        softwareHtml = s.Software.map(sw => `<div style="padding: 6px 0; border-bottom: 1px dashed #e2e8f0; display: flex; gap: 8px; font-size: 12px;"><span style="color:#f59e0b;">🔸</span> <span style="word-break: break-word;">${sw}</span></div>`).join('');
    }

    const osName = getVal(s.OS);
    const osBadge = osName.includes('Windows 10') ? '🪟 Win 10' : (osName.includes('Windows 11') ? '🪟 Win 11' : '🐧 Linux / Інше');

    let html = `
        <div style="background: white; padding: 20px 25px; border-bottom: 1px solid #e2e8f0; flex-shrink: 0;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
                <h3 style="color: #0ea5e9; margin: 0; font-size: 22px; display: flex; align-items: center; gap: 10px;">
                    🖥️ ${getVal(s.Hostname, item.hostname || item.model || 'ПК')}
                </h3>
                <span style="display: inline-block; padding: 6px 12px; background: #d1fae5; color: #059669; border-radius: 8px; font-weight: 700; font-size: 13px;">
                    ${osBadge}
                </span>
            </div>
            <div style="color: #64748b; font-size: 14px; display: flex; gap: 15px; flex-wrap: wrap; align-items: center;">
                <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 6px;">📍 ${item.loc || 'Не вказано'} | Каб. ${item.room || '-'}</span>
                <span>👤 Користувач: <b style="color: #334155;">${item.person || item.pcUser || '-'}</b></span>
                <span style="margin-left: auto;">Оновлено: <b style="color: #334155;">${s.LastUpdate ? s.LastUpdate.split(' ')[0] : '-'}</b></span>
            </div>
        </div>

        <div class="specs-grid" style="padding: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; background: var(--bg-body, #f8fafc);">
            
            <div class="spec-block" style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
                <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 15px; border-bottom: 2px solid #e0f2fe; padding-bottom: 8px;">⚙️ Основна система</h4>
                <div class="spec-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #f1f5f9; font-size: 13px;"><span style="color: #64748b; min-width: 80px;">Процесор:</span><span style="font-weight: 600; color: #1e293b; text-align: right; word-break: break-word;">${getVal(s.Processor)}</span></div>
                <div class="spec-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #f1f5f9; font-size: 13px;"><span style="color: #64748b; min-width: 80px;">Пам'ять:</span><span style="font-weight: 600; color: #0284c7; text-align: right; word-break: break-word;">${getVal(s.RAM)}</span></div>
                <div class="spec-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #f1f5f9; font-size: 13px;"><span style="color: #64748b; min-width: 80px;">Плата:</span><span style="font-weight: 600; color: #1e293b; text-align: right; word-break: break-word;">${getVal(s.Motherboard).replace(/\(S\/N.*\)/, '')}</span></div>
                <div class="spec-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #f1f5f9; font-size: 13px;"><span style="color: #64748b; min-width: 80px;">BIOS:</span><span style="font-weight: 600; color: #1e293b; text-align: right; word-break: break-word;">${getVal(s.BIOS)}</span></div>
                <div class="spec-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #f1f5f9; font-size: 13px;"><span style="color: #64748b; min-width: 80px;">ОС:</span><span style="font-weight: 600; color: #1e293b; text-align: right; word-break: break-word;">${osName}</span></div>
                <div class="spec-row" style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px;"><span style="color: #64748b; min-width: 80px;">Uptime:</span><span style="font-weight: 600; color: #ea580c; text-align: right; word-break: break-word;">${s.OS_Details ? s.OS_Details.split('|').pop().replace('Без перезавантаження:', '').trim() : '-'}</span></div>
            </div>

            <div class="spec-block" style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
                <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 15px; border-bottom: 2px solid #e0f2fe; padding-bottom: 8px;">🛡️ Мережа та Безпека</h4>
                <div class="spec-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #f1f5f9; font-size: 13px;"><span style="color: #64748b; min-width: 80px;">Мережа:</span><span style="font-family: monospace; font-size: 12px; font-weight: 600; color: #1e293b; text-align: right; word-break: break-word;">${getVal(s.Network).replace(/\|/g, '<br>')}</span></div>
                <div class="spec-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #f1f5f9; font-size: 13px;"><span style="color: #64748b; min-width: 80px;">Антивірус:</span><span style="font-weight: 600; color: #16a34a; text-align: right; word-break: break-word;">${getVal(s.Antivirus)}</span></div>
                <div class="spec-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #f1f5f9; font-size: 13px;"><span style="color: #64748b; min-width: 80px;">Security:</span><span style="font-weight: 600; font-size: 12px; color: #1e293b; text-align: right; word-break: break-word;">${getVal(s.Security).replace(/\|/g, '<br>')}</span></div>
                <div class="spec-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #f1f5f9; font-size: 13px;"><span style="color: #64748b; min-width: 80px;">Віддалено:</span><span style="font-weight: 600; color: #ea580c; text-align: right; word-break: break-word;">${getVal(s.RemoteAccess)}</span></div>
                <div class="spec-row" style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px;"><span style="color: #64748b; min-width: 80px;">Адміни:</span><span style="font-weight: 500; font-size: 11px; color: #1e293b; text-align: right; word-break: break-word;">${s.Users && s.Users.Admins ? s.Users.Admins.replace(/,/g, ', ') : '-'}</span></div>
            </div>

            <div class="spec-block" style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
                <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 15px; border-bottom: 2px solid #e0f2fe; padding-bottom: 8px;">💾 Диски та Периферія</h4>
                <div style="font-size: 13px; margin-bottom: 10px;">
                    <div style="color: #64748b; margin-bottom: 5px;">Фізичні диски:</div>
                    <div style="font-weight: 600; line-height: 1.5; color: #1e293b; word-break: break-word;">${getVal(s.Disks).replace(/\|/g, '<br>')}</div>
                </div>
                <div style="font-size: 13px; margin-bottom: 15px; background: #f1f5f9; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="color: #64748b; font-weight: 600; margin-bottom: 8px;">Логічні диски:</div>
                    ${logicalDisksHtml}
                </div>
                <div class="spec-row" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #f1f5f9; font-size: 13px;"><span style="color: #64748b; min-width: 80px;">Монітор:</span><span style="font-weight: 600; color: #1e293b; text-align: right; word-break: break-word;">${getVal(s.Monitors)}</span></div>
                <div class="spec-row" style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px;"><span style="color: #64748b; min-width: 80px;">Відео:</span><span style="font-weight: 600; color: #1e293b; text-align: right; word-break: break-word;">${getVal(s.GPU)}</span></div>
            </div>

            <div class="spec-block" style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);">
                <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 15px; border-bottom: 2px solid #e0f2fe; padding-bottom: 8px; display: flex; justify-content: space-between;">
                    <span>📦 Встановлене ПЗ</span>
                    <span style="background: #e0f2fe; color: #0369a1; padding: 2px 10px; border-radius: 12px; font-size: 12px;">
                        ${s.Software ? s.Software.length : 0} шт.
                    </span>
                </h4>
                <div style="font-size: 13px; margin-bottom: 12px; background: #fff7ed; color: #c2410c; padding: 10px; border-radius: 8px; font-weight: 600; border: 1px solid #ffedd5;">
                    📄 Office: ${getVal(s.Office)}
                </div>
                <div style="max-height: 250px; overflow-y: auto; padding-right: 10px;">
                    ${softwareHtml}
                </div>
            </div>
        </div>
    `;
    
    const contentEl = document.getElementById('specsContentV2');
    if (contentEl) contentEl.innerHTML = html;
    
    modal.style.display = 'flex';
    modal.style.zIndex = '99999';
};
// ==========================================
// ФОРМУЛЯР КСЗІ
// ==========================================
window.openBuildingFormularModal = function() {
    const modal = document.getElementById('buildingFormularModal');
    if (modal) {
        if (typeof window.loadLocations === 'function') {
            window.loadLocations();
        }
        modal.style.display = 'flex';
    } else {
        console.error("Модальне вікно buildingFormularModal не знайдено в HTML!");
        if (typeof showToast === 'function') {
            showToast("Помилка: модальне вікно не знайдено", "error");
        }
    }
};

window.closeBuildingFormularModal = function() {
    const modal = document.getElementById('buildingFormularModal');
    if (modal) modal.style.display = 'none';
};

// ==========================================
// ЛІЧИЛЬНИК ЗАПИСІВ
// ==========================================
window.updateRoomsCounter = function() {
    const counter = document.getElementById('roomsTotalCount');
    if (counter && window.globalRoomsData) {
        counter.innerText = window.globalRoomsData.length;
    }
};

export { updateFieldLabels };
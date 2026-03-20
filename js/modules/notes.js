// js/modules/notes.js
import { apiRequest } from './database.js';
import { showToast } from '../ui/ui-components.js';

// ========== ГЛОБАЛЬНІ ЗМІННІ ==========
window.allNotes = [];
window.filteredNotes = [];

// ========== ОСНОВНА ФУНКЦІЯ ЗАВАНТАЖЕННЯ ПРИМІТОК (ЕКСПОРТУЄТЬСЯ) ==========
export async function loadNotes(targetType, targetId, containerElement) {
    if (!containerElement) return;
    
    containerElement.innerHTML = '<div style="text-align: center; padding: 20px;"><p>⏳ Завантаження...</p></div>';
    
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
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const notes = await response.json();
        renderModalNotes(notes, containerElement);
        return notes;
    } catch (err) {
        console.error("Помилка завантаження приміток:", err);
        containerElement.innerHTML = '<div style="text-align: center; padding: 20px;"><p style="color:#ef4444;">❌ Помилка завантаження</p></div>';
        return [];
    }
}

// ========== ФУНКЦІЇ ДЛЯ РОБОТИ З МОДАЛКОЮ ==========
window.closeNoteModal = () => {
    const modal = document.getElementById('noteModal');
    if (modal) {
        modal.style.display = 'none';
        const form = document.getElementById('noteForm');
        if (form) form.reset();
    }
};

window.openNoteModal = (targetType, targetId, title, additionalData = {}) => {
    console.log(`Відкриття приміток: ${targetType} ID: ${targetId}`);
    
    const modal = document.getElementById('noteModal');
    if (!modal) {
        showToast("Помилка: модальне вікно не знайдено", "error");
        return;
    }
    
    document.getElementById('noteModalTitle').innerText = title || 'Примітки';
    document.getElementById('noteTargetType').value = targetType;
    document.getElementById('noteTargetId').value = targetId;
    window.currentNoteContext = additionalData;
    
    const container = document.getElementById('noteListContainer');
    if (container) {
        loadNotes(targetType, targetId, container);
    }
    
    modal.style.display = 'flex';
};

// ========== ФУНКЦІЯ ПЕРЕХОДУ ДО ОБ'ЄКТА ==========
window.navigateToObject = (note) => {
    if (!note || !note.object_type) return;
    
    console.log("Навігація до об'єкта:", note);
    
    const modal = document.getElementById('noteModal');
    if (modal) modal.style.display = 'none';
    
    switch (note.object_type) {
        case 'inventory':
            window.showTab('inventory');
            setTimeout(() => {
                const rows = document.querySelectorAll('#inventoryTableBody tr');
                rows.forEach(row => {
                    if (row.dataset && row.dataset.id == note.inventory_id) {
                        row.style.backgroundColor = '#fef3c7';
                        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setTimeout(() => row.style.backgroundColor = '', 2000);
                    }
                });
            }, 500);
            break;
            
        case 'room':
            window.showTab('rooms');
            setTimeout(() => {
                const rows = document.querySelectorAll('#roomsTableBody tr');
                rows.forEach(row => {
                    const roomCell = row.querySelector('td[data-label="Локація"]');
                    if (roomCell && note.object_details) {
                        const roomText = roomCell.innerText;
                        if (roomText.includes(note.object_details.room_number)) {
                            row.style.backgroundColor = '#fef3c7';
                            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            setTimeout(() => row.style.backgroundColor = '', 2000);
                        }
                    }
                });
            }, 500);
            break;
            
        case 'transfer':
            window.showTab('transfer');
            setTimeout(() => {
                const rows = document.querySelectorAll('#inTransitBody tr');
                if (rows.length > 0 && note.transfer_id) {
                    const targetRow = rows[note.transfer_id - 1] || rows[0];
                    targetRow.style.backgroundColor = '#fef3c7';
                    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => targetRow.style.backgroundColor = '', 2000);
                }
            }, 500);
            break;
            
        case 'laptop':
            window.showTab('laptops');
            setTimeout(() => {
                const rows = document.querySelectorAll('#laptopsTableBody tr');
                if (rows.length > 0 && note.laptop_loan_id) {
                    const targetRow = rows[note.laptop_loan_id - 1] || rows[0];
                    targetRow.style.backgroundColor = '#fef3c7';
                    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => targetRow.style.backgroundColor = '', 2000);
                }
            }, 500);
            break;
    }
};

// ========== ФУНКЦІЇ ФІЛЬТРАЦІЇ ==========
window.filterGlobalNotes = () => {
   console.log("=== filterGlobalNotes викликано ===");
   console.log("Всього приміток:", window.allNotes?.length || 0);
   
   const typeFilter = document.getElementById('notesFilterType')?.value || 'all';
   const objectFilter = document.getElementById('notesFilterObject')?.value || 'all';
   const searchText = document.getElementById('notesSearch')?.value.toLowerCase() || '';
   
   console.log("Поточні фільтри:", { typeFilter, objectFilter, searchText });
   
   if (!window.allNotes || window.allNotes.length === 0) {
       console.log("Немає даних для фільтрації");
       window.filteredNotes = [];
       renderFilteredNotes();
       updateStatistics();
       return;
   }
   
   window.filteredNotes = window.allNotes.filter(note => {
       if (typeFilter !== 'all' && note.object_type !== typeFilter) return false;
       
       if (objectFilter !== 'all') {
           const parts = objectFilter.split('-');
           if (parts.length < 2) return false;
           
           const objType = parts[0];
           const objId = parseInt(parts[1]);
           
           if (note.object_type !== objType) return false;
           
           switch (objType) {
               case 'inventory':
                   if (note.inventory_id != objId) return false;
                   break;
               case 'room':
                   if (note.room_assignment_id != objId) return false;
                   break;
               case 'transfer':
                   if (note.transfer_id != objId) return false;
                   break;
               case 'laptop':
                   if (note.laptop_loan_id != objId) return false;
                   break;
               default:
                   return false;
           }
       }
       
       if (searchText) {
           const textMatch = note.note_text?.toLowerCase().includes(searchText) || false;
           const authorMatch = (note.creator_name || '').toLowerCase().includes(searchText);
           const objectMatch = (note.object_name || '').toLowerCase().includes(searchText);
           const locationMatch = (note.context_location || '').toLowerCase().includes(searchText);
           return textMatch || authorMatch || objectMatch || locationMatch;
       }
       
       return true;
   });
   
   console.log(`Відфільтровано: ${window.filteredNotes.length} з ${window.allNotes.length}`);
   
   renderFilteredNotes();
   updateStatistics();
};

window.clearNotesFilters = () => {
   console.log("clearNotesFilters викликано");
   
   const typeSelect = document.getElementById('notesFilterType');
   const objectSelect = document.getElementById('notesFilterObject');
   const searchInput = document.getElementById('notesSearch');
   
   if (typeSelect) typeSelect.value = 'all';
   if (searchInput) searchInput.value = '';
   
   if (typeof window.updateObjectsFilter === 'function') {
       window.updateObjectsFilter();
   }
   
   setTimeout(() => {
       if (objectSelect) objectSelect.value = 'all';
       window.filteredNotes = [...window.allNotes];
       renderFilteredNotes();
       updateStatistics();
   }, 100);
};

// ========== ФУНКЦІЇ ЕКСПОРТУ ==========
window.exportNotesToExcel = () => {
    console.log("exportNotesToExcel викликано");
    
    if (!window.filteredNotes || window.filteredNotes.length === 0) {
        showToast("Немає даних для експорту", "error");
        return;
    }
    
    try {
        const exportData = window.filteredNotes.map(note => {
            let typeText = {
                'inventory': 'Склад',
                'room': 'Кабінет',
                'transfer': 'Переміщення',
                'laptop': 'Ноутбук'
            }[note.object_type] || note.object_type || 'Інше';
            
            return {
                'Дата': new Date(note.created_at).toLocaleString('uk-UA'),
                'Автор': note.creator_name || 'Система',
                'Тип': typeText,
                'Об\'єкт': note.object_name || '',
                'Примітка': note.note_text || '',
                'Локація': note.context_location || '',
                'Статус': note.context_status || ''
            };
        });
        
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Примітки");
        
        const fileName = `System_Notes_${new Date().toLocaleDateString('uk-UA').replace(/\./g, '-')}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showToast(`Експортовано ${exportData.length} приміток`, "success");
    } catch (err) {
        console.error("Помилка експорту:", err);
        showToast("Помилка експорту: " + err.message, "error");
    }
};

// ========== ФУНКЦІЯ ВИДАЛЕННЯ ==========
window.deleteNote = async (noteId) => {
    if (!confirm("Видалити цю примітку?")) return;
    
    try {
        await apiRequest('delete_note', { id: noteId });
        showToast("Примітку видалено", "success");
        await window.loadAllNotes();
    } catch (err) {
        showToast("Помилка видалення: " + err.message, "error");
    }
};

// ========== ФУНКЦІЯ ЗАВАНТАЖЕННЯ ВСІХ ПРИМІТОК ==========
window.loadAllNotes = async () => {
    console.log("loadAllNotes викликано");
    
    const container = document.getElementById('globalNotesList');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 40px;"><p>⏳ Завантаження приміток...</p></div>';
    
    try {
        const response = await fetch('api.php?action=get_notes');
        window.allNotes = await response.json();
        window.filteredNotes = [...window.allNotes];
        
        console.log(`Завантажено ${window.allNotes.length} приміток`);
        
        updateObjectsFilter();
        renderFilteredNotes();
        updateStatistics();
        
    } catch (err) {
        console.error("Помилка завантаження приміток:", err);
        container.innerHTML = '<div style="text-align: center; padding: 40px;"><p style="color:#ef4444;">❌ Помилка завантаження даних</p></div>';
    }
};

// ========== ФУНКЦІЇ ВІДОБРАЖЕННЯ ==========
function renderModalNotes(notes, container) {
    if (!notes || notes.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px;"><p style="color:var(--text-muted);">📭 Немає приміток</p></div>';
        return;
    }

    let html = '';
    notes.forEach(note => {
        const date = new Date(note.created_at).toLocaleString('uk-UA');
        const isCurrentUser = note.created_by === window.currentUserName;
        
        html += `
            <div style="border-bottom:1px solid var(--border-light); padding:15px 0;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <div>
                        <strong style="color:var(--primary);">${note.creator_name || 'Система'}</strong>
                        ${note.creator_role === 'admin' ? '<span style="background:#059669; color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:5px;">Адмін</span>' : ''}
                        ${note.is_private ? '<span style="background:#f97316; color:white; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:5px;">🔒</span>' : ''}
                    </div>
                    <span style="color:var(--text-muted); font-size:11px;">🕒 ${date}</span>
                </div>
                <div style="font-size:13px; white-space:pre-wrap; background:var(--bg-body); padding:10px; border-radius:8px;">
                    ${note.note_text.replace(/\n/g, '<br>')}
                </div>
                ${note.context_location ? `
                    <div style="font-size:11px; color:var(--text-muted); margin-top:8px;">
                        📍 ${note.context_location}
                    </div>
                ` : ''}
            </div>
        `;
    });
    container.innerHTML = html;
}

function renderFilteredNotes() {
   const container = document.getElementById('globalNotesList');
   if (!container) {
       console.error("Container globalNotesList не знайдено!");
       return;
   }
   
   console.log("Рендеринг приміток, кількість:", window.filteredNotes?.length || 0);
   
   if (!window.filteredNotes || window.filteredNotes.length === 0) {
       container.innerHTML = '<div style="text-align: center; padding: 60px;"><p style="color:var(--text-muted);">📭 Нічого не знайдено</p></div>';
       return;
   }
   
   let html = '';
   window.filteredNotes.forEach(note => {
       const date = new Date(note.created_at).toLocaleString('uk-UA', {
           day: '2-digit', month: '2-digit', year: 'numeric',
           hour: '2-digit', minute: '2-digit'
       });
       
       const isCurrentUser = note.created_by === window.currentUserName;
       const isAdmin = window.isAdmin && window.isAdmin();
       
       let typeIcon = '📦';
       let typeName = 'Склад';
       if (note.object_type === 'room') {
           typeIcon = '🏢';
           typeName = 'Кабінет';
       } else if (note.object_type === 'transfer') {
           typeIcon = '🔄';
           typeName = 'Переміщення';
       } else if (note.object_type === 'laptop') {
           typeIcon = '💻';
           typeName = 'Ноутбук';
       }
       
       const noteJson = JSON.stringify(note).replace(/"/g, '&quot;');
       
       html += `
           <div class="note-card ${note.is_private ? 'private' : ''}" 
                data-note-id="${note.id}"
                data-object-type="${note.object_type || ''}"
                data-object-id="${note.object_details?.id || ''}">
               
               <div class="note-header">
                   <div class="note-author">
                       <span class="note-author-name">${note.creator_name || 'Система'}</span>
                       ${note.creator_role === 'admin' ? '<span class="note-badge admin">👑 Адмін</span>' : ''}
                       ${isCurrentUser ? '<span class="note-badge you">👤 Ви</span>' : ''}
                       ${note.is_private ? '<span class="note-badge private">🔒 Приватне</span>' : ''}
                       <span class="note-badge" style="background:var(--primary-light); color:var(--primary);">${typeIcon} ${typeName}</span>
                   </div>
                   <div class="note-date">
                       🕒 ${date}
                       ${isAdmin ? `
                           <button class="note-delete" onclick="event.stopPropagation(); window.deleteNote(${note.id})" title="Видалити">
                               ✕
                           </button>
                       ` : ''}
                   </div>
               </div>
               
               <div class="note-object-link" onclick="window.navigateToObject(${noteJson})">
                   <i>${typeIcon}</i> 
                   <span><b>${note.object_name || 'Об\'єкт'}</b></span>
                   <span style="margin-left: auto;">↗️</span>
               </div>
               
               <div class="note-text">
                   ${note.note_text.replace(/\n/g, '<br>')}
               </div>
               
               ${note.context_location ? `
                   <div class="note-context">
                       <span>📍 ${note.context_location}</span>
                       ${note.context_status ? `<span>● Статус: ${note.context_status}</span>` : ''}
                   </div>
               ` : ''}
           </div>
       `;
   });
   
   container.innerHTML = html;
   console.log("Рендеринг завершено, кількість карток:", container.querySelectorAll('.note-card').length);
}

function updateObjectsFilter() {
   const typeFilter = document.getElementById('notesFilterType')?.value || 'all';
   const objectSelect = document.getElementById('notesFilterObject');
   
   if (!objectSelect) return;
   
   console.log("Оновлення списку об'єктів для типу:", typeFilter);
   
   objectSelect.innerHTML = '<option value="all">📌 Всі об\'єкти</option>';
   
   const objects = new Map();
   
   window.allNotes.forEach(note => {
       if (!note.object_type || !note.object_details) return;
       
       if (typeFilter !== 'all' && note.object_type !== typeFilter) return;
       
       const objType = note.object_type;
       const objId = note.object_details.id;
       
       if (!objId) return;
       
       const key = `${objType}-${objId}`;
       
       if (!objects.has(key)) {
           let name = '';
           let details = note.object_details;
           
           switch (objType) {
               case 'inventory':
                   name = `📦 ${details.model_name || 'Техніка'} (Інв: ${details.inv_number || 'Б/Н'})`;
                   break;
               case 'room':
                   name = `🏢 Каб. ${details.room_number || '?'} (${details.location_name || '?'})`;
                   break;
               case 'transfer':
                   name = `🔄 ${details.from_location || '?'} → ${details.to_location || '?'}`;
                   break;
               case 'laptop':
                   name = `💻 ${details.model || 'Ноутбук'} (${details.user_name || '?'})`;
                   break;
           }
           
           objects.set(key, { type: objType, id: objId, name: name });
       }
   });
   
   Array.from(objects.values())
       .sort((a, b) => a.name.localeCompare(b.name))
       .forEach(obj => {
           const option = document.createElement('option');
           option.value = `${obj.type}-${obj.id}`;
           option.textContent = obj.name;
           objectSelect.appendChild(option);
       });
}

window.updateObjectsFilter = updateObjectsFilter;

function updateStatistics() {
   const totalEl = document.getElementById('notesTotalCount');
   const invEl = document.getElementById('notesInventoryCount');
   const roomEl = document.getElementById('notesRoomsCount');
   const transEl = document.getElementById('notesTransfersCount');
   const laptopEl = document.getElementById('notesLaptopsCount');
   
   if (totalEl) totalEl.textContent = window.filteredNotes.length;
   
   const counts = {
       inventory: window.filteredNotes.filter(n => n.object_type === 'inventory').length,
       room: window.filteredNotes.filter(n => n.object_type === 'room').length,
       transfer: window.filteredNotes.filter(n => n.object_type === 'transfer').length,
       laptop: window.filteredNotes.filter(n => n.object_type === 'laptop').length
   };
   
   if (invEl) invEl.textContent = counts.inventory;
   if (roomEl) roomEl.textContent = counts.room;
   if (transEl) transEl.textContent = counts.transfer;
   if (laptopEl) laptopEl.textContent = counts.laptop;
}

// ========== ФУНКЦІЯ ДОДАВАННЯ ПРИМІТКИ ==========
export async function addNote(noteData) {
    try {
        const result = await apiRequest('add_note', noteData);
        if (result.success) {
            showToast("Примітку додано", "success");
            await window.loadAllNotes();
            return result.id;
        }
    } catch (err) {
        showToast("Помилка: " + err.message, "error");
        throw err;
    }
}

// ========== ІНІЦІАЛІЗАЦІЯ ==========
export function initNotesLogic() {
    console.log("initNotesLogic запущено");
    
    if (document.getElementById('globalNotesList')) {
        window.loadAllNotes();
    }
    
    const initModalForm = () => {
        const noteForm = document.getElementById('noteForm');
        if (!noteForm) {
            setTimeout(initModalForm, 100);
            return;
        }
        
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
                await addNote(notePayload);
                
                document.getElementById('noteText').value = '';
                if (document.getElementById('noteIsPrivate')) {
                    document.getElementById('noteIsPrivate').checked = false;
                }
                
                const container = document.getElementById('noteListContainer');
                if (container) {
                    await loadNotes(targetType, targetId, container);
                }
                
                window.closeNoteModal();
                
            } catch (err) {
                console.error("Помилка додавання примітки:", err);
            }
        });
    };
    
    initModalForm();
}

// ========== ГЛОБАЛЬНІ ФУНКЦІЇ ДЛЯ HTML ОБРОБНИКІВ ==========
window.onFilterTypeChange = function() {
   console.log("onFilterTypeChange викликано");
   if (typeof window.updateObjectsFilter === 'function') {
       window.updateObjectsFilter();
   }
};

window.applyNotesFilters = function() {
   console.log("applyNotesFilters викликано");
   
   const container = document.getElementById('globalNotesList');
   if (container) {
       container.style.opacity = '0.5';
   }
   
   if (typeof window.filterGlobalNotes === 'function') {
       window.filterGlobalNotes();
   }
   
   setTimeout(() => {
       if (container) {
           container.style.opacity = '1';
       }
   }, 300);
};
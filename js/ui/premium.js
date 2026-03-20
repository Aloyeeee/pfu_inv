// js/ui/premium.js

export function initPremiumFeatures() {
   initFloatingLabels();
   observeDynamicForms(); // Спостерігає за появою нових полів на льоту
   initCommandPalette();
}

// 1. АВТОМАТИЧНІ ПЛАВАЮЧІ МІТКИ (Floating Labels)
function applyFloatingLabels(container = document) {
   container.querySelectorAll('.field').forEach(field => {
       // Уникаємо повторного застосування
       if (field.dataset.floatingApplied === "true") return;
       
       const label = field.querySelector('label');
       const input = field.querySelector('input, select');
       
       if (label && input && !input.classList.contains('no-float')) {
           // Переміщуємо label ПІСЛЯ input
           field.appendChild(label);
           
           // Хитрий трюк для CSS: порожній placeholder для input
           if (input.tagName === 'INPUT') {
               if(!input.placeholder) input.placeholder = ' ';
           }
           
           // Для Select: додаємо/забираємо клас залежно від того, чи вибрано щось
           if (input.tagName === 'SELECT') {
               const checkVal = () => { 
                   if(input.value && input.value !== "") field.classList.add('has-val'); 
                   else field.classList.remove('has-val'); 
               };
               input.addEventListener('change', checkVal);
               setTimeout(checkVal, 100); 
           }
           
           field.dataset.floatingApplied = "true";
       }
   });
}

function initFloatingLabels() {
   applyFloatingLabels();
}

// Спостерігач за ДОМ-деревом (якщо ви відкрили модалку або додали нове поле)
function observeDynamicForms() {
   const observer = new MutationObserver((mutations) => {
       mutations.forEach(mutation => {
           if (mutation.addedNodes.length) {
               mutation.addedNodes.forEach(node => {
                   if (node.nodeType === 1) { // Якщо це елемент
                       if (node.classList && node.classList.contains('field')) {
                           applyFloatingLabels(node.parentElement);
                       } else {
                           applyFloatingLabels(node);
                       }
                   }
               });
           }
       });
   });
   observer.observe(document.body, { childList: true, subtree: true });
}

// 2. ГЛОБАЛЬНИЙ ПОШУК (CTRL + K)
function initCommandPalette() {
   if (document.getElementById('commandPalette')) return;

   const paletteHtml = `
       <div id="commandPalette">
           <div class="palette-content">
               <div style="position: relative;">
                   <span style="position: absolute; left: 20px; top: 22px; font-size: 1.2rem; color: var(--text-muted);">🔍</span>
                   <input type="text" id="paletteInput" placeholder="Шукати техніку (Кабінет, Склад, ПІБ, Інв. №)..." autocomplete="off" style="padding-left: 55px;">
               </div>
               <div class="results" id="paletteResults"></div>
           </div>
       </div>
   `;
   document.body.insertAdjacentHTML('beforeend', paletteHtml);
   
   const palette = document.getElementById('commandPalette');
   const input = document.getElementById('paletteInput');
   const results = document.getElementById('paletteResults');

   document.addEventListener('keydown', (e) => {
       // Ctrl+K або Cmd+K (на Mac)
       if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
           e.preventDefault();
           palette.style.display = 'flex';
           setTimeout(() => input.focus(), 50);
       }
       if (e.key === 'Escape' && palette.style.display === 'flex') {
           palette.style.display = 'none';
       }
   });

   palette.addEventListener('click', (e) => {
       if (e.target === palette) palette.style.display = 'none';
   });

   input.addEventListener('input', () => {
       const val = input.value.toLowerCase().trim();
       if (!val) { results.innerHTML = ''; return; }

       let html = '';
       let count = 0;

       // Пошук 1: Кабінети
       if (window.globalRoomsData) {
           window.globalRoomsData.forEach(item => {
               if (count > 6) return;
               const searchStr = `${item.inv} ${item.model} ${item.person} ${item.room} ${item.loc}`.toLowerCase();
               if (searchStr.includes(val)) {
                   html += `
                   <div class="result-item" onclick="window.showTab('rooms'); document.getElementById('commandPalette').style.display='none';">
                       <span style="font-size: 22px;">🚪</span> 
                       <div style="line-height: 1.3;">
                           <b>${item.model}</b> <span style="color:var(--text-muted); font-size: 12px;">(Каб. ${item.room})</span><br>
                           <span style="font-size:12px; color:var(--text-muted);">Інв: <b>${item.inv || 'Б/Н'}</b> • Кор: ${item.person || 'Немає'}</span>
                       </div>
                   </div>`;
                   count++;
               }
           });
       }

       // Пошук 2: Склад (якщо залишилося місце в списку)
       if (window.globalInventory && count <= 8) {
           window.globalInventory.forEach(item => {
               if (count > 8 || item.status === 'Для списання') return;
               const searchStr = `${item.inv} ${item.name} ${item.model} ${item.person}`.toLowerCase();
               if (searchStr.includes(val)) {
                   // Перевіряємо чи ця техніка вже не показана як кабінетна
                   const existsInRooms = window.globalRoomsData && window.globalRoomsData.some(r => r.inv && item.inv && r.inv === item.inv);
                   if (!existsInRooms) {
                       html += `
                       <div class="result-item" onclick="window.showTab('inventory'); document.getElementById('commandPalette').style.display='none';">
                           <span style="font-size: 22px;">📦</span> 
                           <div style="line-height: 1.3;">
                               <b>${item.name || item.model}</b> <span style="color:var(--text-muted); font-size: 12px;">(Склад)</span><br>
                               <span style="font-size:12px; color:var(--text-muted);">Інв: <b>${item.inv || 'Б/Н'}</b> • МВО: ${item.person || 'Немає'}</span>
                           </div>
                       </div>`;
                       count++;
                   }
               }
           });
       }
       
       if (html === '') html = `<div style="padding: 30px; text-align: center; color: var(--text-muted);">Нічого не знайдено 📭</div>`;
       results.innerHTML = html;
   });
}

// 3. КРАСИВИЙ ПОРОЖНІЙ СТАН ТАБЛИЦЬ
window.getEmptyStateHtml = (colspan, title, subtitle) => {
   return `<tr><td colspan="${colspan}" style="padding: 0; background: transparent; border: none;">
       <div class="empty-state">
           <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
           </svg>
           <h3>${title}</h3>
           <p>${subtitle}</p>
       </div>
   </td></tr>`;
};


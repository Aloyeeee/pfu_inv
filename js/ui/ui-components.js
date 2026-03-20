// ui-components.js

// 1. TOAST NOTIFICATIONS (Спливаючі повідомлення)
export function showToast(message, type = 'success') {
   let container = document.getElementById('toastContainer');
   if (!container) {
       container = document.createElement('div');
       container.id = 'toastContainer';
       document.body.appendChild(container);
   }

   const toast = document.createElement('div');
   toast.className = `toast ${type}`;
   toast.innerHTML = `
       <span>${message}</span>
       <span class="close-toast" onclick="this.parentElement.remove()">✕</span>
   `;
   
   container.appendChild(toast);

   // Автоматичне видалення через 4 секунди
   setTimeout(() => {
       if (toast.parentElement) {
           toast.style.animation = 'slideInUp 0.3s ease reverse forwards';
           setTimeout(() => toast.remove(), 300);
       }
   }, 4000);
}

// 2. SKELETON LOADING (Анімація завантаження таблиць)
export function renderSkeleton(tbodyId, columnsCount, rowsCount = 5) {
   const tbody = document.getElementById(tbodyId);
   if (!tbody) return;
   
   let html = '';
   for (let i = 0; i < rowsCount; i++) {
       html += `<tr class="skeleton-row">`;
       for (let j = 0; j < columnsCount; j++) {
           html += `<td><div class="skeleton"></div></td>`;
       }
       html += `</tr>`;
   }
   tbody.innerHTML = html;
}

// 3. DARK MODE (Темна тема)
export function initDarkMode() {
   const isDark = localStorage.getItem('darkMode') === 'true';
   if (isDark) document.body.classList.add('dark-mode');
   
   const btn = document.getElementById('themeToggleBtn');
   if(btn) btn.innerHTML = isDark ? '☀️ Світла тема' : '🌙 Темна тема';
}

export function toggleDarkMode() {
   const isDark = document.body.classList.toggle('dark-mode');
   localStorage.setItem('darkMode', isDark);
   const btn = document.getElementById('themeToggleBtn');
   if(btn) btn.innerHTML = isDark ? '☀️ Світла тема' : '🌙 Темна тема';
}
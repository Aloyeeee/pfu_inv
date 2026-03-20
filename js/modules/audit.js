// js/modules/audit.js
import { apiRequest } from './database.js';

export async function logAction(actionType, details) {
    try {
        await apiRequest('add_audit_log', { action: actionType, details: details });
        
        // Якщо відкрита сторінка аудиту, оновлюємо її
        const auditTable = document.getElementById('auditTableBody');
        if (auditTable) {
            loadAuditLogs();
        }
        
        // Оновлюємо останні дії на дашборді
        const recentList = document.getElementById('recentActionsList');
        if (recentList) {
            loadAuditLogs();
        }
    } catch (e) { 
        console.error("Помилка запису в журнал:", e); 
    }
}

export async function loadAuditLogs() {
    try {
        const logs = await apiRequest('get_audit_logs');
        
        // Оновлюємо таблицю аудиту
        const tbody = document.getElementById('auditTableBody');
        if (tbody) {
            if (!logs || logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">📭 Журнал порожній</td></tr>';
            } else {
                tbody.innerHTML = logs.map(l => {
                    let actionColor = l.action.includes('Видалено') || l.action.includes('Списано') ? 'color: #dc2626;' : 'color: var(--primary);';
                    return `<tr>
                        <td data-label="Дата та час">${new Date(l.date).toLocaleString('uk-UA')}</td>
                        <td data-label="Користувач"><b>${l.user}</b></td>
                        <td data-label="Модуль" style="${actionColor} font-weight:600;">${l.action}</td>
                        <td data-label="Деталі дії">${l.details}</td>
                    </tr>`;
                }).join("");
            }
        }
        
        // Оновлюємо останні дії на дашборді
        const recentList = document.getElementById('recentActionsList');
        if (recentList) {
            if (!logs || logs.length === 0) {
                recentList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">Ще немає активності</div>';
            } else {
                recentList.innerHTML = logs.slice(0, 6).map(l => 
                    `<div style="padding: 12px 15px; border-bottom: 1px solid var(--border-light);">
                        <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">
                            🕒 ${new Date(l.date).toLocaleString('uk-UA')} • 👤 ${l.user}
                        </div>
                        <div style="font-size:13px; color:var(--text-dark);">
                            <b>${l.action}:</b> ${l.details}
                        </div>
                    </div>`
                ).join("");
            }
        }
    } catch (e) { 
        console.error("Помилка завантаження логів:", e); 
    }
}

export const startAuditListener = loadAuditLogs;
// js/modules/transfer.js
import { apiRequest } from './database.js';
import { getTransferDef } from '../core/templates.js';
import { logAction } from './audit.js';
import { showToast } from '../ui/ui-components.js';

let transferCart = [];

// Робимо globalTransfers глобальною змінною
window.globalTransfers = [];

export function initTransferLogic() {
    
    // Якщо змінили відправника - очищаємо кошик
    document.getElementById('trFrom')?.addEventListener('change', () => {
        transferCart = [];
        window.renderTransferCart();
        const trInv = document.getElementById('trInv');
        if (trInv) trInv.value = '';
    });
    
    // АВТОПОШУК ТЕХНІКИ
    window.handleTransferInvInput = () => {
        const fromLoc = document.getElementById('trFrom')?.value;
        const input = document.getElementById('trInv');
        const dropdown = document.getElementById('trInvDropdown');

        if (!fromLoc) {
            showToast("Спочатку оберіть відправника (Звідки)!", "error");
            input.value = ''; dropdown.style.display = 'none'; return;
        }

        const val = input.value.trim().toLowerCase();
        if (!window.globalInventory || val === '') { dropdown.style.display = 'none'; return; }

        // Шукаємо техніку ТІЛЬКИ на локації відправника
        const filtered = window.globalInventory.filter(i =>
            i.location === fromLoc &&
            i.status !== 'Для списання' &&
            (
                (i.inv && String(i.inv).toLowerCase().includes(val)) ||
                (i.name && String(i.name).toLowerCase().includes(val)) ||
                (i.model && String(i.model).toLowerCase().includes(val))
            )
        );

        dropdown.innerHTML = '';
        if (filtered.length === 0) { dropdown.style.display = 'none'; return; }

        filtered.forEach(item => {
            const div = document.createElement('div');
            div.style.padding = '10px 12px'; div.style.borderBottom = '1px solid #f1f5f9'; div.style.cursor = 'pointer'; div.style.fontSize = '13px';
            div.onmouseover = () => div.style.background = '#f8fafc'; div.onmouseout = () => div.style.background = 'white';
            
            const invText = item.inv ? `<strong style="color:var(--primary)">${item.inv}</strong>` : `<strong style="color:#94a3b8">Б/Н</strong>`;
            div.innerHTML = `${invText} — <span>${item.name || item.model}</span>`;

            div.onclick = () => {
                if (transferCart.find(i => i.id === item.id)) {
                    showToast("Ця техніка вже додана в акт!", "error");
                } else {
                    transferCart.push(item);
                    window.renderTransferCart();
                    showToast("Додано в акт", "success");
                }
                input.value = '';
                dropdown.style.display = 'none';
            };
            dropdown.appendChild(div);
        });
        dropdown.style.display = 'block';
    };

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#trInv') && !e.target.closest('#trInvDropdown')) {
            const drop = document.getElementById('trInvDropdown');
            if (drop) drop.style.display = 'none';
        }
    });

    window.removeTransferItem = (idx) => { transferCart.splice(idx, 1); window.renderTransferCart(); };

    window.renderTransferCart = () => {
        const tbody = document.getElementById('transferCartBody');
        if (!tbody) return;
        
        if (transferCart.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Акт порожній</td></tr>`;
            return;
        }
        
        tbody.innerHTML = transferCart.map((i, idx) => `
            <tr>
                <td data-label="Модель"><b>${i.name || i.model}</b></td>
                <td data-label="Номер">${i.inv || 'Б/Н'}</td>
                <td data-label="Дії" style="text-align:center;">
                    <button type="button" class="btn-secondary" style="padding:4px 12px; color:red;" onclick="window.removeTransferItem(${idx})">✖</button>
                </td>
            </tr>
        `).join("");
    };

    document.getElementById('transferForm')?.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        if(!transferCart.length) return showToast("Акт порожній! Додайте техніку.", "error");
        
        const f = document.getElementById('trFrom').value;
        const t = document.getElementById('trTo').value;
        const sender = document.getElementById('trSentBy').value;
        const receiver = document.getElementById('trReceivedBy').value;
        const btn = e.target.querySelector('button[type="submit"]');
        
        if (f === t) return showToast("Неможливо зробити переміщення в межах однієї будівлі!", "error");
        
        btn.innerText = "⏳ Оформлення..."; btn.disabled = true;
        
        try {
            // 1. Формуємо PDF
            const pdfItems = transferCart.map(i => ({ model: i.name || i.model, inv: i.inv || 'Б/Н' }));
            const def = getTransferDef({ from: f, to: t, sender: sender, receiver: receiver, items: pdfItems });
            if (window.downloadPDF) window.downloadPDF(def, `Akt_Peremischennya_${Date.now()}.pdf`);

            // 2. Відправляємо на наш SQL-сервер
            await apiRequest('add_transfer', { 
                from: f, to: t, sender: sender, receiver: receiver, items: transferCart 
            });
            
            await logAction("Переміщення", `Створено Акт. З ${f} до ${t}`);
            showToast("Акт оформлено! Техніку переміщено.", "success");
            
            transferCart = []; window.renderTransferCart(); e.target.reset();
            
            // Оновлюємо дані на сайті
            window.globalTransfers = await apiRequest('get_transfers');
            window.renderTransferHistory();
            window.globalInventory = await apiRequest('get_inventory'); // Бо техніка змінила локацію
            if(window.renderInventoryTable) window.renderInventoryTable();

        } catch (err) { 
            showToast("Помилка: " + err.message, "error"); 
        } finally {
            btn.innerText = "Створити та завантажити Акт"; btn.disabled = false;
        }
        await logAction("Переміщення", `Створено акт переміщення з ${f} до ${t} (${transferCart.length} од.)`);
    }
    );

    // ВИПРАВЛЕНО: Функція завантаження акту
    window.downloadTransferAct = (id) => { 
        console.log("downloadTransferAct викликано з id:", id);
        console.log("globalTransfers:", window.globalTransfers);
        
        const t = window.globalTransfers?.find(x => x.id == id); 
        if(!t) {
            console.error("Акт не знайдено з id:", id);
            showToast("Акт не знайдено в історії!", "error");
            return; 
        }
        
        console.log("Знайдено акт:", t);
        
        // Перевіряємо, чи items є масивом, якщо ні - парсимо
        let items = t.items;
        if (typeof items === 'string') {
            try {
                items = JSON.parse(items);
            } catch (e) {
                console.error("Помилка парсингу items:", e);
                items = [];
            }
        }
        
        const def = getTransferDef({ 
            from: t.from, 
            to: t.to, 
            sender: t.sender || "_________", 
            receiver: t.receiver || "_________", 
            items: items 
        }); 
        
        if(window.downloadPDF) {
            window.downloadPDF(def, `Akt_Peremischennya_${id}.pdf`); 
        } else {
            console.error("window.downloadPDF не знайдено!");
            showToast("Помилка: функція створення PDF не доступна", "error");
        }
    };

    // ВИПРАВЛЕНО: Функція рендеру історії
    window.renderTransferHistory = () => {
        const tb = document.getElementById('inTransitBody'); 
        if(!tb || !window.globalTransfers) return;
        
        tb.innerHTML = ""; 
        if(window.globalTransfers.length === 0) {
            tb.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Історія порожня</td></tr>`;
            return;
        }

        window.globalTransfers.forEach(i => { 
            // Переконуємося, що items - масив
            let items = i.items;
            if (typeof items === 'string') {
                try {
                    items = JSON.parse(items);
                } catch (e) {
                    items = [];
                }
            }
            
            const itemsHtml = Array.isArray(items) 
                ? items.map(x => `• ${x.model || x.name || '?'} <span style="color:#64748b; font-size:11px;">(${x.inv || 'Б/Н'})</span>`).join('<br>')
                : '• Дані недоступні';
            
            const downloadBtn = `<button class="btn-secondary" style="height:28px; font-size:11px; padding:0 8px; width:100%;" onclick="window.downloadTransferAct('${i.id}')">📄 Завантажити Акт</button>`;
            
            tb.innerHTML += `
            <tr>
                <td data-label="Дата">${new Date(i.date).toLocaleDateString('uk-UA')}</td>
                <td data-label="Маршрут"><b>${i.from}</b> <br>➔<br> <b>${i.to}</b></td>
                <td data-label="Техніка">${itemsHtml}</td>
                <td data-label="Статус"><span style="color: #059669; font-weight: 600; font-size: 12px; background: #d1fae5; padding: 3px 8px; border-radius: 12px;">✅ Завершено</span></td>
                <td data-label="Дії" class="actions-col">
                    ${downloadBtn}
                    <button class="btn-secondary" style="height:28px; font-size:11px; padding:0 8px; margin-top:5px; width:100%;" onclick="window.openNoteModal('transfer', '${i.id}', 'Акт переміщення')">📝 Примітка</button>
                </td>
            </tr>`;
        });
    };

    // Завантажуємо історію при ініціалізації
    loadTransferHistory();
    
}

// Функція для завантаження історії
async function loadTransferHistory() {
    try {
        window.globalTransfers = await apiRequest('get_transfers');
        window.renderTransferHistory();
    } catch (err) {
        console.error("Помилка завантаження історії переміщень:", err);
    }
}
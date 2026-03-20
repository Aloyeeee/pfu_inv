// js/modules/laptops.js
import { apiRequest } from './database.js'; // Змінили на локальний API
import { monthsUa, pfuLocations } from '../core/config.js';
import { getLaptopDef, getLaptopReturnDef } from '../core/templates.js';
import { logAction } from './audit.js';
import { showToast } from '../ui/ui-components.js';

export function initLaptopsLogic() {
    
    // 1. ГАРАНТОВАНЕ ЗАПОВНЕННЯ СПИСКІВ ЛОКАЦІЙ
    const locOptions = pfuLocations.map(loc => `<option value="${loc}">${loc}</option>`).join("");
    
    const lpLocEl = document.getElementById('lpLocation');
    if (lpLocEl && !lpLocEl.innerHTML.includes('<option')) {
        lpLocEl.innerHTML = locOptions;
    }

    const destSelect = document.getElementById('lpDestination');
    if (destSelect) {
        destSelect.innerHTML = locOptions + '<option value="other" style="font-weight:bold; color:#ea580c;">✏️ Інше (Вписати вручну)</option>';
    }

    // 2. ПОКАЗ/СХОВАННЯ ПОЛЯ ДЛЯ РУЧНОГО ВВОДУ АДРЕСИ
    document.getElementById('lpDestination')?.addEventListener('change', (e) => {
        const otherWrapper = document.getElementById('lpDestinationOtherWrapper');
        const otherInput = document.getElementById('lpDestinationOther');
        if (e.target.value === 'other') {
            otherWrapper.style.display = 'block';
            otherInput.required = true;
        } else {
            otherWrapper.style.display = 'none';
            otherInput.required = false;
            otherInput.value = '';
        }
    });

// ЗБЕРЕЖЕННЯ ФОРМИ (ВИДАЧА НОУТБУКА)
document.getElementById('laptopsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    let finalDestination = document.getElementById('lpDestination').value;
    if (finalDestination === 'other') {
        finalDestination = document.getElementById('lpDestinationOther').value.trim();
    }

    // Створюємо дату в правильному форматі для MySQL
    const now = new Date();
    const mysqlDate = now.getFullYear() + '-' + 
                      String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(now.getDate()).padStart(2, '0') + ' ' + 
                      String(now.getHours()).padStart(2, '0') + ':' + 
                      String(now.getMinutes()).padStart(2, '0') + ':' + 
                      String(now.getSeconds()).padStart(2, '0');

    const data = { 
        date: mysqlDate, // Використовуємо правильний формат
        location: document.getElementById('lpLocation').value,         
        destination: finalDestination,                                 
        
        user: document.getElementById('lpUser').value, 
        userTitle: document.getElementById('lpUserTitle').value, 
        userDir: document.getElementById('lpUserDir').value, 
        userDept: document.getElementById('lpUserDept').value, 
        
        encryptedFor: document.getElementById('lpEncryptedFor').value, 
        encryptedForTitle: document.getElementById('lpEncryptedForTitle').value, 
        encryptedForDir: document.getElementById('lpEncryptedForDir').value, 
        encryptedForDept: document.getElementById('lpEncryptedForDept').value, 
        
        model: document.getElementById('lpModel').value, 
        inv: document.getElementById('lpInv').value || 'Б/Н', 
        sn: document.getElementById('lpSN').value, 
        
        tokenModel: document.getElementById('tkModel').value || 'Захищений носій',
        tokenInv: document.getElementById('tkInv').value || 'Б/Н', 
        tokenSn: document.getElementById('tkSN').value 
    };

    const btn = e.target.querySelector('button[type="submit"]');
    const origText = btn.innerText;
    btn.innerText = "⏳ Оформлення...";
    btn.disabled = true;

    try { 
        // 1. Формуємо PDF
        const d = new Date();
        const def = getLaptopDef({ 
            dateStr: `${d.getDate()} ${monthsUa[d.getMonth()]} ${d.getFullYear()} року`, 
            sender: data.user, 
            senderTitle: data.userTitle, 
            senderDir: data.userDir, 
            senderDept: data.userDept, 
            receiver: data.encryptedFor, 
            receiverTitle: data.encryptedForTitle, 
            receiverDir: data.encryptedForDir, 
            receiverDept: data.encryptedForDept, 
            model: data.model, 
            sn: data.sn, 
            inv: data.inv, 
            tokenModel: data.tokenModel, 
            tokenSn: data.tokenSn, 
            tokenInv: data.tokenInv 
        });
        
        if(window.downloadPDF) window.downloadPDF(def, `Akt_Vydacha_Noutbuk_${Date.now()}.pdf`);
        
        // 2. Зберігаємо в SQL-базу
        console.log("Відправляємо дані:", data); // Для дебагу
        const result = await apiRequest('add_laptop', data); 
        console.log("Результат:", result);
        
        await logAction("Робочі станції", `Видано ноутбук ${data.model} для ${data.encryptedFor}`);
        
        showToast("Видачу зафіксовано. Акт завантажено!", "success");
        e.target.reset(); 
        
        document.getElementById('lpInv').style.borderColor = '#93c5fd';
        document.getElementById('lpInv').style.backgroundColor = '#eff6ff';
        document.getElementById('tkInv').style.borderColor = '#c4b5fd';
        document.getElementById('tkInv').style.backgroundColor = '#faf5ff';
        
        const otherWrapper = document.getElementById('lpDestinationOtherWrapper');
        if(otherWrapper) {
            otherWrapper.style.display = 'none';
            document.getElementById('lpDestinationOther').required = false;
        }

        // Оновлюємо таблицю
        window.globalLaptops = await apiRequest('get_laptops');
        window.renderLaptopsHistory();

    } catch (err) { 
        console.error("Помилка:", err);
        showToast(err.message, "error"); 
    } finally {
        btn.innerText = origText;
        btn.disabled = false;
    }
    
    await logAction("Ноутбуки", `Видано ноутбук ${data.model} (${data.inv}) для ${data.encryptedFor}`);
});

    // 4. ЗБЕРЕЖЕННЯ ФОРМИ (ПОВЕРНЕННЯ НОУТБУКА)
    document.getElementById('returnLaptopForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const origText = btn.innerText;
        btn.innerText = "⏳ Збереження...";
        btn.disabled = true;

        const id = document.getElementById('returnLpId').value;
        const retData = {
            id: id,
            returnDate: new Date().toISOString(),
            returnLocation: document.getElementById('retLocation')?.value || 'Склад',
            receivedBy: document.getElementById('retReceiver').value,
            receivedByTitle: document.getElementById('retReceiverTitle')?.value || '',
            receivedByDir: document.getElementById('retReceiverDir')?.value || '',
            receivedByDept: document.getElementById('retReceiverDept')?.value || ''
        };

        try {
            await apiRequest('return_laptop', retData);
            await logAction("Робочі станції", `Повернення ноутбука з ID: ${id}`);
            showToast("Ноутбук успішно повернуто!", "success");
            
            window.closeReturnModal();
            window.globalLaptops = await apiRequest('get_laptops');
            window.renderLaptopsHistory();
        } catch(err) {
            showToast(err.message, "error");
        } finally {
            btn.innerText = origText;
            btn.disabled = false;
        }
        
await logAction("Ноутбуки", `Повернено ноутбук (ID: ${id})`);
    });

    window.renderLaptopsHistory = () => {
        const tb = document.getElementById('laptopsTableBody'); 
        if(!tb || !window.globalLaptops) return;
      
        tb.innerHTML = ""; 
      
        if(window.globalLaptops.length === 0) {
            tb.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Журнал порожній</td></tr>`;
            return;
        }

        window.globalLaptops.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(i => { 
            const isRet = i.status === 'returned';
            const retBtn = isRet ? `<span style="color:var(--primary); font-size:11px;"><b>Повернуто:</b> ${new Date(i.returnDate).toLocaleDateString('uk-UA')}<br>в ${i.returnLocation}<br>Прийняв: ${i.receivedBy}</span>` 
                              : `<button class="btn-secondary" style="padding:4px 8px; font-size:11px; color:#ea580c; border-color:#ea580c; margin-bottom:5px; width:100%;" onclick="window.openReturnModal('${i.id}', '${i.user}', '${i.encryptedFor}', '${i.model}')">↩ Повернути</button>`;
            
            const dlIssueBtn = `<button class="btn-secondary" style="padding:4px 8px; font-size:11px; margin-bottom:5px; width:100%;" onclick="window.downloadLaptopAct('${i.id}')">📄 Акт видачі</button>`;
            const dlRetBtn = isRet ? `<button class="btn-secondary" style="padding:4px 8px; font-size:11px; width:100%;" onclick="window.downloadLaptopReturnAct('${i.id}')">📄 Акт повернення</button>` : '';
          
            const receiverDeptStr = i.encryptedForDept && i.encryptedForDept !== "Без відділу / Загальний склад" ? i.encryptedForDept : "";
            const senderDeptStr = i.userDept && i.userDept !== "Без відділу / Загальний склад" ? i.userDept : "";
            const destStr = i.destination ? `<br><span style="color:var(--primary); font-weight:600;">➔ ${i.destination}</span>` : '';

            // js/modules/laptops.js - всередині window.renderLaptopsHistory

tb.innerHTML += `<tr>
<td data-label="Дата">${new Date(i.date).toLocaleDateString('uk-UA')}</td>
<td data-label="Локація (Де / Куди)"><span style="font-size:11px; color:#64748b;">Видано з: ${i.location}</span>${destStr}</td>
<td data-label="Номери"><b>${i.model}</b><br><span style="font-size:11px;">S/N (Н): ${i.sn}<br>S/N (Т): ${i.tokenSn}</span></td>
<td data-label="Кому видано"><b>${i.encryptedFor}</b><br><span style="font-size:11px;">${i.encryptedForTitle}</span><br><span style="font-size:10px; color:#64748b;">${receiverDeptStr}</span></td>
<td data-label="Хто видав"><b>${i.user}</b><br><span style="font-size:11px;">${i.userTitle}</span><br><span style="font-size:10px; color:#64748b;">${senderDeptStr}</span></td>
<td data-label="Дії" class="actions-col" style="${window.isAdmin && window.isAdmin() ? 'display:flex; flex-direction:column;' : 'display:none;'}">
    ${dlIssueBtn}
    ${retBtn}
    ${dlRetBtn}
    <!-- НОВА КНОПКА ПРИМІТКИ -->
    <button class="btn-secondary" style="padding:4px 8px; font-size:11px; margin-top:5px; width:100%;" onclick="window.openNoteModal('laptop', '${i.id}', 'Ноутбук ${i.model}')">📝 Примітка</button>
</td>
</tr>`;
        }
        );
    };

    window.downloadLaptopAct = (id) => { 
        const lp = window.globalLaptops.find(x => x.id == id); if(!lp) return; 
        const d = new Date(lp.date); 
        const def = getLaptopDef({ 
            dateStr: `${d.getDate()} ${monthsUa[d.getMonth()]} ${d.getFullYear()} року`, 
            sender: lp.user, senderTitle: lp.userTitle, senderDir: lp.userDir, senderDept: lp.userDept, 
            receiver: lp.encryptedFor, receiverTitle: lp.encryptedForTitle, receiverDir: lp.encryptedForDir, receiverDept: lp.encryptedForDept, 
            model: lp.model, sn: lp.sn, inv: lp.inv, 
            tokenSn: lp.tokenSn, tokenInv: lp.tokenInv, tokenModel: lp.tokenModel 
        }); 
        window.downloadPDF(def, `Akt_Vydacha_Noutbuk_${new Date(lp.date).getTime()}.pdf`); 
    };

    window.downloadLaptopReturnAct = (id) => { 
        const lp = window.globalLaptops.find(x => x.id == id); if(!lp || lp.status !== 'returned') return; 
        const d = new Date(lp.returnDate); 
        const def = getLaptopReturnDef({ 
            dateStr: `${d.getDate()} ${monthsUa[d.getMonth()]} ${d.getFullYear()} року`, 
            sender: lp.encryptedFor, senderTitle: lp.encryptedForTitle, senderDir: lp.encryptedForDir, senderDept: lp.encryptedForDept, 
            receiver: lp.receivedBy, receiverTitle: lp.receiverTitle, receiverDir: lp.receiverDir, receiverDept: lp.receiverDept, 
            model: lp.model, sn: lp.sn, inv: lp.inv, 
            tokenSn: lp.tokenSn, tokenInv: lp.tokenInv, tokenModel: lp.tokenModel 
        }); 
        window.downloadPDF(def, `Akt_Povernennya_Noutbuk_${new Date(lp.returnDate).getTime()}.pdf`); 
    };
}

// 5. ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ МОДАЛКИ ПОВЕРНЕННЯ ТА ПОШУКУ
window.openReturnModal = (id, user, encryptedFor, model) => { 
    const lp = window.globalLaptops.find(x => x.id == id); 
    if(!lp) return; 
    document.getElementById('returnLpId').value = lp.id; 
    document.getElementById('returnLpInfo').innerHTML = `Повертається: <b>${lp.model}</b><br>Від: <b>${lp.encryptedFor}</b>`; 
    document.getElementById('retReceiver').value = lp.user || ''; 
    document.getElementById('returnModal').style.display = 'flex'; 
};

window.closeReturnModal = () => { 
    document.getElementById('returnModal').style.display = 'none'; 
    document.getElementById('returnLaptopForm')?.reset(); 
};

window.handleLaptopInvInput = () => {
    const input = document.getElementById('lpInv');
    const dropdown = document.getElementById('lpInvDropdown');
    const val = input.value.trim().toLowerCase();
    
    if (!window.globalInventory || val === '') { dropdown.style.display = 'none'; input.style.borderColor = '#93c5fd'; input.style.backgroundColor = '#eff6ff'; return; }

    const exactMatch = window.globalInventory.find(i => i.inv && String(i.inv).toLowerCase() === val && i.status !== 'Для списання');
    if (exactMatch) {
        document.getElementById('lpModel').value = exactMatch.name || exactMatch.model || '';
        document.getElementById('lpSN').value = exactMatch.sn || '';
        input.style.borderColor = '#10b981'; input.style.backgroundColor = '#f0fdf4';
        dropdown.style.display = 'none';
        return;
    }

    const filtered = window.globalInventory.filter(i => {
        if (i.status === 'Для списання') return false;
        const isLaptop = (i.type && i.type.toLowerCase().includes('ноутбук')) || (i.name && i.name.toLowerCase().includes('ноутбук'));
        if (!isLaptop) return false;
        return (i.inv && String(i.inv).toLowerCase().includes(val)) || (i.name && i.name.toLowerCase().includes(val));
    });

    dropdown.innerHTML = '';
    if (filtered.length === 0) { dropdown.style.display = 'none'; return; }

    filtered.forEach(item => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.innerHTML = `<strong class="text-primary">${item.inv || 'Б/Н'}</strong> — ${item.name || item.model} <span class="muted-small">(S/N: ${item.sn || '-'})</span>`;
        div.onclick = () => {
            input.value = item.inv || ''; document.getElementById('lpModel').value = item.name || item.model || ''; document.getElementById('lpSN').value = item.sn || '';
            input.style.borderColor = '#10b981'; input.style.backgroundColor = '#f0fdf4'; dropdown.style.display = 'none';
        };
        dropdown.appendChild(div);
    });
    dropdown.style.display = 'block';
};

window.handleTokenInvInput = () => {
    const input = document.getElementById('tkInv'); const dropdown = document.getElementById('tkInvDropdown'); const val = input.value.trim().toLowerCase();
    if (!window.globalInventory || val === '') { dropdown.style.display = 'none'; input.style.borderColor = '#c4b5fd'; input.style.backgroundColor = '#faf5ff'; return; }

    const exactMatch = window.globalInventory.find(i => i.inv && String(i.inv).toLowerCase() === val && i.status !== 'Для списання');
    if (exactMatch) {
        document.getElementById('tkModel').value = exactMatch.name || exactMatch.model || '';
        document.getElementById('tkSN').value = exactMatch.sn || '';
        input.style.borderColor = '#10b981'; input.style.backgroundColor = '#f0fdf4';
        dropdown.style.display = 'none';
        return;
    }

    const filtered = window.globalInventory.filter(i => {
        if (i.status === 'Для списання') return false;
        return (i.inv && String(i.inv).toLowerCase().includes(val)) || (i.name && i.name.toLowerCase().includes(val));
    });

    dropdown.innerHTML = '';
    if (filtered.length === 0) { dropdown.style.display = 'none'; return; }

    filtered.forEach(item => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.innerHTML = `<strong style="color:#8b5cf6;">${item.inv || 'Б/Н'}</strong> — ${item.name || item.model} <span class="muted-small">(S/N: ${item.sn || '-'})</span>`;
        div.onclick = () => {
            input.value = item.inv || ''; document.getElementById('tkModel').value = item.name || item.model || ''; document.getElementById('tkSN').value = item.sn || '';
            input.style.borderColor = '#10b981'; input.style.backgroundColor = '#f0fdf4'; dropdown.style.display = 'none';
        };
        dropdown.appendChild(div);
    });
    dropdown.style.display = 'block';
};

document.addEventListener('click', (e) => {
    const lpIn = document.getElementById('lpInv'); const lpDr = document.getElementById('lpInvDropdown');
    if (lpIn && lpDr && e.target !== lpIn && !lpDr.contains(e.target)) lpDr.style.display = 'none';
    const tkIn = document.getElementById('tkInv'); const tkDr = document.getElementById('tkInvDropdown');
    if (tkIn && tkDr && e.target !== tkIn && !tkDr.contains(e.target)) tkDr.style.display = 'none';
});
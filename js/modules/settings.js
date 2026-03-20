// js/modules/settings.js
import { apiRequest } from './database.js';

// Допоміжна функція для виклику сповіщень
function notify(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

export function initSettingsLogic() {
    console.log("initSettingsLogic запущено");

    // ==========================================
    // ЛОГІКА ПЕРЕМИКАННЯ ТАБІВ
    // ==========================================
    window.showSettingsTab = function(tabId, btnElement) {
        // Ховаємо всі таби
        document.querySelectorAll('.settings-tab').forEach(tab => tab.classList.remove('active'));
        const activeTab = document.getElementById('settings-' + tabId);
        if (activeTab) activeTab.classList.add('active');
        
        // Знімаємо клас active з усіх кнопок у хедері
        document.querySelectorAll('#settingsTabsContainer .btn-secondary').forEach(btn => {
            btn.classList.remove('active');
            btn.style.backgroundColor = "";
            btn.style.color = "";
            btn.style.borderColor = "";
        });
        
        // Якщо передано елемент, робимо його активним
        if (btnElement) {
            btnElement.classList.add('active');
            btnElement.style.backgroundColor = "var(--primary-light)";
            btnElement.style.color = "var(--primary)";
            btnElement.style.borderColor = "var(--primary)";
        }
    };

    // Відкриваємо перший таб при завантаженні модуля
    setTimeout(() => {
        if (!document.querySelector('.settings-tab.active')) {
            const firstBtn = document.querySelector('#settingsTabsContainer .btn-secondary');
            if (firstBtn) window.showSettingsTab('general', firstBtn);
        }
    }, 100);

    // ==========================================
    // ЗОВНІШНІЙ ВИГЛЯД (ТЕМНА ТЕМА) - ВИПРАВЛЕНО
    // ==========================================
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        // За замовчуванням СВІТЛА ТЕМА - видаляємо клас dark-mode
        document.body.classList.remove('dark-mode');
        // Але якщо користувач раніше вмикав темну тему, то застосовуємо її
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
        }
        
        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            
            // Оновлюємо текст кнопки (опціонально)
            if (isDark) {
                themeBtn.innerHTML = '☀️ Світла тема';
            } else {
                themeBtn.innerHTML = '🌙 Темна тема';
            }
        });
        
        // Встановлюємо початковий текст кнопки
        if (document.body.classList.contains('dark-mode')) {
            themeBtn.innerHTML = '☀️ Світла тема';
        } else {
            themeBtn.innerHTML = '🌙 Темна тема';
        }
    }

    // ==========================================
    // МОДАЛКА ЗНИЩЕННЯ БАЗИ ДАНИХ
    // ==========================================
    window.openWipeModal = () => { 
        const m = document.getElementById('wipeModal'); 
        if(m) {
            m.style.display = 'flex'; 
            document.body.classList.add('modal-open'); 
        }
    };
    
    window.closeWipeModal = () => { 
        const m = document.getElementById('wipeModal'); 
        if(m) {
            m.style.display = 'none'; 
            document.body.classList.remove('modal-open');
        }
        const p = document.getElementById('wipePassword'); 
        if(p) p.value = ''; 
    };

    const wipeForm = document.getElementById('wipeDatabaseForm');
    if (wipeForm) {
        wipeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pwd = document.getElementById('wipePassword').value;
            const btn = e.target.querySelector('button[type="submit"]');
            
            const originalText = btn.innerText;
            btn.innerText = "⏳ Знищення...";
            btn.disabled = true;

            try {
                await apiRequest('wipe_database', { password: pwd });
                notify("БАЗУ АБСОЛЮТНО ОЧИЩЕНО! Всі дані успішно видалено.", "success");
                
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
                
            } catch(err) {
                notify(err.message || "Помилка очищення! Перевірте правильність пароля.", "error");
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }

    // ==========================================
    // КЕРУВАННЯ БАЗОЮ
    // ==========================================
    window.clearEntireInventory = async () => {
        if (!confirm("УВАГА! Це видалить усі записи з таблиці інвентарю. Ви впевнені?")) return;
        try {
            await apiRequest('clear_inventory');
            notify("Склад успішно очищено!", "success");
        } catch (err) { notify(err.message, "error"); }
    };

    window.fixInventory = async () => {
        try {
            const res = await apiRequest('fix_inventory');
            notify(res.message || "Склад успішно виправлено!", "success");
        } catch (err) { notify(err.message, "error"); }
    };

    window.checkInventoryHealth = async () => {
        try {
            const res = await apiRequest('check_health');
            alert("🔍 Звіт перевірки бази:\n\n" + res.details);
        } catch (err) { notify(err.message, "error"); }
    };

    // ==========================================
    // МАСОВІ ОПЕРАЦІЇ
    // ==========================================
    window.removeDuplicates = async () => {
        if (!confirm("Видалити дублікати інвентарних номерів?")) return;
        try {
            const res = await apiRequest('remove_duplicates');
            notify(res.message || "Дублікати успішно видалено!", "success");
        } catch (err) { notify(err.message, "error"); }
    };

    window.recalculatePrices = async () => {
        try {
            const res = await apiRequest('recalculate_prices');
            notify(res.message || "Ціни успішно оновлено!", "success");
        } catch (err) { notify(err.message, "error"); }
    };

    // ==========================================
    // ОБСЛУГОВУВАННЯ
    // ==========================================
    window.clearCache = async () => {
        try {
            const res = await apiRequest('clear_cache');
            notify(res.message || "Кеш системи очищено", "success");
        } catch (err) { notify(err.message, "error"); }
    };

    // ==========================================
    // 🔐 ЗМІНА ПАРОЛЯ
    // ==========================================
    window.changePassword = () => {
        const formHTML = `
            <form id="changePasswordForm" onsubmit="window.submitPasswordChange(event)">
                <div class="form-grid">
                    <div class="field">
                        <input type="password" id="oldPass" required placeholder=" ">
                        <label>Поточний пароль *</label>
                    </div>
                    <div class="field">
                        <input type="password" id="newPass" required minlength="6" placeholder=" ">
                        <label>Новий пароль (мін. 6 символів) *</label>
                    </div>
                    <div class="field" style="grid-column: 1 / -1;">
                        <input type="password" id="confirmPass" required minlength="6" placeholder=" ">
                        <label>Підтвердіть новий пароль *</label>
                    </div>
                </div>
                <div style="margin-top: 15px; text-align: right;">
                    <button type="submit" class="btn-primary">💾 Оновити пароль</button>
                </div>
            </form>
        `;
        showSettingsInlineCard('settings-general', '🔐 Зміна пароля', formHTML);
    };

    window.submitPasswordChange = async (e) => {
        e.preventDefault();
        const current = document.getElementById('oldPass').value;
        const newPass = document.getElementById('newPass').value;
        const confirmPass = document.getElementById('confirmPass').value;

        if (newPass !== confirmPass) {
            notify("Нові паролі не співпадають!", "error");
            return;
        }

        try {
            await apiRequest('change_password', { current_password: current, new_password: newPass });
            notify("Пароль успішно змінено!", "success");
            document.getElementById('dynamicSettingsCard').remove();
        } catch (err) {
            notify(err.message || "Помилка зміни пароля", "error");
        }
    };

    // ==========================================
    // 👥 КОРИСТУВАЧІ
    // ==========================================
    window.showUserManager = () => {
        const formHTML = `
            <form onsubmit="window.submitNewUser(event)">
                <div class="form-grid">
                    <div class="field">
                        <input type="text" id="newUserLogin" required placeholder=" ">
                        <label>Логін *</label>
                    </div>
                    <div class="field">
                        <input type="password" id="newUserPassword" required minlength="6" placeholder=" ">
                        <label>Пароль *</label>
                    </div>
                    <div class="field" style="grid-column: 1 / -1;">
                        <select id="newUserRole" required>
                            <option value="user">Звичайний користувач</option>
                            <option value="admin">Адміністратор</option>
                        </select>
                        <label>Роль *</label>
                    </div>
                </div>
                <div style="margin-top: 15px; text-align: right;">
                    <button type="submit" class="btn-primary">💾 Зберегти</button>
                </div>
            </form>
        `;
        showSettingsInlineCard('settings-general', '➕ Додати користувача', formHTML);
    };

    window.submitNewUser = async (e) => {
        e.preventDefault();
        const data = {
            username: document.getElementById('newUserLogin').value.trim(), 
            password: document.getElementById('newUserPassword').value,
            role: document.getElementById('newUserRole').value,
            full_name: document.getElementById('newUserLogin').value.trim()
        };
        
        if (!data.username || !data.password) {
            notify("Заповніть всі обов'язкові поля", "error");
            return;
        }

        try {
            await apiRequest('add_user', data);
            notify("Користувача успішно додано!", "success");
        } catch (err) {
            notify(err.message, "error");
        }
    };

    window.showUserList = async () => {
        notify("Завантаження списку користувачів...", "info");
        try {
            const res = await fetch('api.php?action=get_users_list');
            const data = await res.json();
            
            if (data.success && data.users) {
                let html = `
                    <table style="width:100%; text-align:left; border-collapse: collapse; margin-top: 10px;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border-light); color: var(--text-muted);">
                                <th style="padding: 10px;">ID</th>
                                <th>Логін</th>
                                <th>Роль</th>
                                <th style="text-align: right;">Дії</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                data.users.forEach(u => {
                    const roleBadge = u.role === 'admin' 
                        ? '<span style="background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 10px;">Адмін</span>'
                        : '<span style="background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 10px;">Користувач</span>';
                        
                    html += `
                        <tr style="border-bottom: 1px solid var(--border-light);">
                            <td style="padding: 12px 10px;">${u.id}</td>
                            <td><b>${u.username}</b></td>
                            <td>${roleBadge}</td>
                            <td style="text-align: right;">
                                <button class="btn-secondary" onclick="window.deleteUser(${u.id})" style="padding: 4px 8px; color: #ef4444;">🗑️ Видалити</button>
                            </td>
                        </tr>
                    `;
                });
                html += `</tbody></table>`;
                showSettingsInlineCard('settings-general', '📋 Список користувачів', html);
            }
        } catch (err) {
            notify(err.message, "error");
        }
    };

    window.deleteUser = async (id) => {
        if (!confirm("Видалити користувача?")) return;
        try {
            await apiRequest('delete_user', { id });
            notify("Користувача видалено", "success");
        } catch (err) {
            notify(err.message, "error");
        }
    };

    // ==========================================
    // 📄 ПЕРЕГЛЯД ЛОГІВ
    // ==========================================
    window.viewLogs = async () => {
        notify("Завантаження журналів...", "info");
        try {
            const res = await fetch('api.php?action=get_system_logs');
            const data = await res.json();
            if (data.success) {
                const html = `
                    <div style="background: #1e293b; color: #10b981; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 13px; max-height: 400px; overflow-y: auto;">
                        ${data.logs || 'Логи порожні'}
                    </div>
                `;
                showSettingsInlineCard('settings-maintenance', '📄 Журнал системи', html);
            }
        } catch (err) {
            notify(err.message, "error");
        }
    };

    // ==========================================
    // 📝 РЕКВІЗИТИ
    // ==========================================
    document.querySelector('[onclick*="docs"]')?.addEventListener('click', async () => {
        try {
            const res = await fetch('api.php?action=get_requisites');
            const data = await res.json();
            if (data.success && data.data) {
                if(data.data.org_name) document.getElementById('orgName').value = data.data.org_name;
                if(data.data.org_edrpou) document.getElementById('orgEDRPOU').value = data.data.org_edrpou;
                if(data.data.org_director) document.getElementById('orgDirector').value = data.data.org_director;
                if(data.data.inv_prefix) document.getElementById('invPrefix').value = data.data.inv_prefix;
                if(data.data.pagination) document.getElementById('defaultPagination').value = data.data.pagination;
            }
        } catch(err) { console.error(err); }
    });

    window.saveRequisites = async (e) => {
        e.preventDefault();
        const payload = {
            org_name: document.getElementById('orgName').value,
            org_edrpou: document.getElementById('orgEDRPOU').value,
            org_director: document.getElementById('orgDirector').value,
            inv_prefix: document.getElementById('invPrefix').value,
            pagination: document.getElementById('defaultPagination').value
        };
        try {
            await apiRequest('save_requisites', payload);
            notify("Реквізити збережено", "success");
        } catch(err) { notify(err.message, "error"); }
    };

    // ==========================================
    // СЕСІЇ
    // ==========================================
    document.querySelector('[onclick*="sessions"]')?.addEventListener('click', async () => {
        const tbody = document.getElementById('sessionsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Завантаження...</td></tr>';
        try {
            const res = await fetch('api.php?action=get_active_sessions');
            const data = await res.json();
            if (data.success) {
                tbody.innerHTML = data.sessions.map(s => `
                    <tr style="${s.is_current ? 'background: #f0fdf4;' : ''}">
                        <td><b>${s.user}</b></td>
                        <td>${s.ip}</td>
                        <td>${s.last_seen}</td>
                        <td style="color:var(--text-muted); font-size:12px;">${s.agent}</td>
                        <td>${s.is_current ? '<span style="color:#10b981;">Поточна</span>' : ''}</td>
                    </tr>
                `).join('');
            }
        } catch(err) { 
            tbody.innerHTML = '<tr><td colspan="5">Помилка</td></tr>'; 
        }
    });

    window.killAllOtherSessions = async () => {
        if(!confirm("Усі інші користувачі будуть викинуті з системи. Продовжити?")) return;
        try {
            await apiRequest('kill_other_sessions');
            notify("Усі сесії, крім вашої, успішно завершено.", "success");
        } catch(err) { notify(err.message, "error"); }
    };
}
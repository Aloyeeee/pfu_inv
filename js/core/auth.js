// js/modules/auth.js
import { fetchSystemData } from './config.js'; 
import { initDropdowns } from '../ui/ui.js';
import { startDatabaseListeners } from '../modules/database.js';

window.currentUserRole = 'viewer';
window.currentUserName = '';

// Функція приховування прелоадера
function hidePreloader() {
    const preloader = document.getElementById('global-preloader');
    if (preloader) {
        preloader.style.opacity = '0';
        setTimeout(() => {
            preloader.style.display = 'none';
            document.body.classList.remove('modal-open');
        }, 500);
    }
}

// Показуємо прелоадер при спробі входу
function showPreloader() {
    const preloader = document.getElementById('global-preloader');
    if (preloader) {
        preloader.style.display = 'flex';
        preloader.style.opacity = '1';
        document.body.classList.add('modal-open');
    }
}

export async function checkSession() {
    try {
        const res = await fetch('api.php?action=check_session');
        const data = await res.json();
        if (data.logged_in) {
            await handleLoginSuccess(data.user);
        } else {
            showLoginScreen();
            hidePreloader(); // Приховуємо лоадер, щоб побачити форму входу
        }
    } catch (e) { 
        showLoginScreen(); 
        hidePreloader();
    }
}

function showLoginScreen() {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    if(loginScreen) loginScreen.style.display = 'flex';
    if(mainApp) mainApp.style.display = 'none';
    
    // Додаємо анімацію для поля вводу при завантаженні
    setTimeout(() => {
        const firstInput = document.querySelector('#loginForm input');
        if (firstInput) {
            firstInput.focus();
            firstInput.classList.add('pulse-animation');
            setTimeout(() => firstInput.classList.remove('pulse-animation'), 1000);
        }
    }, 500);
}

async function handleLoginSuccess(user) {
    window.currentUserRole = user.role;
    window.currentUserName = user.username;

    // Завантажуємо дані системи
    await fetchSystemData();
    initDropdowns();
    
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    if(loginScreen) loginScreen.style.display = 'none';
    if(mainApp) mainApp.style.display = 'flex';
    
    // Автоматично відкриваємо дашборд
    if (window.showTab) window.showTab('dashboard');

    const emailDisp = document.getElementById('userEmailDisplay');
    if(emailDisp) emailDisp.innerText = user.username;
    
    // Керування видимістю колонок адміна
    const isAdmin = user.role === 'admin';
    document.querySelectorAll('.actions-col').forEach(el => el.style.display = isAdmin ? 'table-cell' : 'none');
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? 'flex' : 'none');

    // Запускаємо слухачі бази (включаючи Crispy Load)
    await startDatabaseListeners();
    
    // В самому кінці приховуємо сірий екран
    hidePreloader();
    
    // Показуємо вітальний тост
    if (window.showToast) {
        window.showToast(`👋 Ласкаво просимо, ${user.username}!`, "success");
    }
}

// ОНОВЛЕНА ФОРМА ВХОДУ З ПОКРАЩЕНОЮ АНІМАЦІЄЮ
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const origText = btn.innerText;
    
    // Анімація кнопки
    btn.innerHTML = '<span class="spinner"></span> Перевірка...';
    btn.disabled = true;
    
    // Показуємо прелоадер
    showPreloader();
    
    const loginInput = document.getElementById('loginEmail') || document.getElementById('newUserLogin');
    const passwordInput = document.getElementById('loginPassword');

    try {
        const res = await fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                action: 'login', 
                username: loginInput.value.trim(), 
                password: passwordInput.value 
            })
        });
        
        const data = await res.json();
        if (data.success) {
            await handleLoginSuccess(data.user);
        } else {
            throw new Error(data.error || "Невірний логін або пароль");
        }
    } catch (error) { 
        // Ховаємо прелоадер при помилці
        hidePreloader();
        
        // Показуємо помилку з анімацією
        const loginCard = document.querySelector('.login-card');
        loginCard.classList.add('shake-animation');
        setTimeout(() => loginCard.classList.remove('shake-animation'), 500);
        
        if (window.showToast) {
            window.showToast("❌ " + error.message, "error");
        } else {
            alert("❌ Помилка: " + error.message);
        }
    } finally { 
        btn.innerHTML = origText;
        btn.disabled = false;
    }
});

// Додаємо CSS для анімацій
const style = document.createElement('style');
style.textContent = `
    .spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-radius: 50%;
        border-top-color: #fff;
        animation: spin 0.8s linear infinite;
        margin-right: 8px;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    .pulse-animation {
        animation: pulse 1s ease-out;
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.02); box-shadow: 0 0 0 4px rgba(5, 150, 105, 0.2); }
        100% { transform: scale(1); }
    }
    
    .shake-animation {
        animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
    }
    
    @keyframes shake {
        10%, 90% { transform: translateX(-1px); }
        20%, 80% { transform: translateX(2px); }
        30%, 50%, 70% { transform: translateX(-4px); }
        40%, 60% { transform: translateX(4px); }
    }
`;
document.head.appendChild(style);

// ВИХІД ІЗ СИСТЕМИ
window.logout = async function() {
    if (!confirm("Ви впевнені, що хочете вийти?")) return;
    
    // Показуємо прелоадер
    showPreloader();
    
    try {
        await fetch('api.php?action=logout');
        location.reload(); 
    } catch (e) {
        location.reload();
    }
};

// Прив'язка до старої кнопки, якщо вона є в HTML по ID
document.getElementById('btnLogout')?.addEventListener('click', window.logout);

checkSession();
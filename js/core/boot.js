// js/core/boot.js

async function loadHTMLComponents() {
    const components = [
        { id: 'login-wrapper', url: 'components/login.html' },
        { id: 'sidebar', url: 'components/sidebar.html' },
        { id: 'modals-wrapper', url: 'components/modals.html' }, // ВСІ МОДАЛКИ ТУТ
        { id: 'dashboard', url: 'pages/dashboard.html' },
        { id: 'inventory', url: 'pages/inventory.html' },
        { id: 'rooms', url: 'pages/rooms.html' },
        { id: 'transfer', url: 'pages/transfer.html' },
        { id: 'refill', url: 'pages/refill.html' },
        { id: 'laptops', url: 'pages/laptops.html' },
        { id: 'employee', url: 'pages/employee.html' },
        { id: 'catalog', url: 'pages/catalog.html' },
        { id: 'audit', url: 'pages/audit.html' },
        { id: 'settings', url: 'pages/settings.html' },
        { id: 'notes', url: 'pages/notes.html' }
    ];
 
    try {
        await Promise.all(components.map(async (comp) => {
            const response = await fetch(comp.url);
            if (response.ok) {
                const html = await response.text();
                const targetElement = document.getElementById(comp.id);
                if (targetElement) {
                    targetElement.innerHTML = html;
                }
            } else {
                console.error(`Помилка завантаження: ${comp.url}`);
            }
        }));
 
        import('../main.js');
 
    } catch (error) {
        console.error("Критична помилка:", error);
    }
 }
 
 document.addEventListener('DOMContentLoaded', loadHTMLComponents);
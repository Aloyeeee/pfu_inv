// dashboard.js
let charts = {}; 
let currentDrilldownData = []; 

export function startDashboard() {
    console.log("startDashboard запущено");
    loadDashboardData();
    
    // Слухаємо події оновлення даних
    document.addEventListener('dataUpdated', loadDashboardData);
}

// На початку файлу dashboard.js додайте:
function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

async function loadDashboardData() {
    try {
        const response = await fetch('api.php?action=get_dashboard_stats');
        const data = await response.json();
        
        if (data.success) {
            updateDashboardUI(data);
        } else {
            console.error("Помилка в даних:", data);
        }
    } catch (err) {
        console.error("Помилка завантаження даних дашборда:", err);
        showToast("Помилка завантаження даних дашборда", "error");
    }
}

function updateDashboardUI(data) {
    // Оновлюємо фінансові показники
    document.getElementById('dashTotalStockPrice').innerText = 
        formatMoney(data.stats.stock_price) + ' ₴';
    document.getElementById('dashTotalRoomsPrice').innerText = 
        formatMoney(data.stats.rooms_price) + ' ₴';
    document.getElementById('dashTotalWrittenOffPrice').innerText = 
        formatMoney(data.stats.written_off_price) + ' ₴';
    
    // Оновлюємо графіки
    updateCharts(data.charts);
    
    // Оновлюємо попередження
    updateWarnings(data.warnings);
}

function formatMoney(amount) {
    return amount.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function updateCharts(chartsData) {
    console.log("Отримані дані для графіків:", chartsData);
    
    // Типи техніки
    if (chartsData.types && chartsData.types.length > 0) {
        const typeLabels = chartsData.types.map(t => t.type);
        const typeCounts = chartsData.types.map(t => parseInt(t.count));
        drawChart('typeChart', 'doughnut', typeLabels, typeCounts, 'Type');
    }
    
    // Локації
    if (chartsData.locations && chartsData.locations.length > 0) {
        const fullLocLabels = chartsData.locations.map(l => l.loc);
        const displayLabels = chartsData.locations.map(l => 
            l.loc.length > 20 ? l.loc.substring(0, 20) + '...' : l.loc
        );
        const locCounts = chartsData.locations.map(l => parseInt(l.count));
        
        drawLocationChart('locationChart', 'doughnut', displayLabels, fullLocLabels, locCounts);
    }
    
    // Вік техніки
    if (chartsData.age) {
        const ageLabels = Object.keys(chartsData.age);
        const ageCounts = Object.values(chartsData.age);
        drawAgeChart(ageLabels, ageCounts);
    }
    
    // RAM
    if (chartsData.ram && Object.keys(chartsData.ram).length > 0) {
        const ramLabels = Object.keys(chartsData.ram);
        const ramCounts = Object.values(chartsData.ram);
        drawInteractiveChart('ramChart', 'pie', ramLabels, ramCounts, 'RAM');
    }
    
    // OS
    if (chartsData.os && Object.keys(chartsData.os).length > 0) {
        const osLabels = Object.keys(chartsData.os);
        const osCounts = Object.values(chartsData.os);
        drawInteractiveChart('osChart', 'pie', osLabels, osCounts, 'OS');
    }
    
    // Antivirus
    if (chartsData.av && Object.keys(chartsData.av).length > 0) {
        const avLabels = Object.keys(chartsData.av);
        const avCounts = Object.values(chartsData.av);
        drawInteractiveChart('avChart', 'pie', avLabels, avCounts, 'AV');
    }
    
    // Disks
    if (chartsData.disk && Object.keys(chartsData.disk).length > 0) {
        const diskLabels = Object.keys(chartsData.disk);
        const diskCounts = Object.values(chartsData.disk);
        drawInteractiveChart('diskChart', 'pie', diskLabels, diskCounts, 'Disk');
    }
    
    // Office
    if (chartsData.office && Object.keys(chartsData.office).length > 0) {
        const officeLabels = Object.keys(chartsData.office);
        const officeCounts = Object.values(chartsData.office);
        drawInteractiveChart('officeChart', 'pie', officeLabels, officeCounts, 'Office');
    }
}

function drawLocationChart(canvasId, type, displayLabels, fullLabels, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    if (charts[canvasId]) charts[canvasId].destroy();
    
    charts[canvasId] = new Chart(ctx, { 
        type: type, 
        data: { 
            labels: displayLabels,
            datasets: [{ 
                data: data, 
                backgroundColor: colors.slice(0, data.length),
                borderWidth: 1,
                borderRadius: 4
            }] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            cutout: type === 'doughnut' ? '60%' : undefined,
            plugins: { 
                legend: { 
                    position: 'right', 
                    labels: { 
                        font: { size: 10 }, 
                        boxWidth: 10,
                        color: getComputedStyle(document.body).getPropertyValue('--text-main')
                    } 
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#e2e8f0',
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            return fullLabels[index];
                        }
                    }
                }
            },
            onClick: (event, activeElements) => {
                if (activeElements.length > 0) {
                    const idx = activeElements[0].index;
                    const label = fullLabels[idx];
                    openDrilldownModal('Location', label);
                }
            }
        } 
    });
}

const colors = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4', '#eab308', '#ef4444', '#84cc16', '#64748b', '#0ea5e9', '#f43f5e'];

function drawChart(canvasId, type, labels, data, filterType) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    if (charts[canvasId]) charts[canvasId].destroy();
    
    charts[canvasId] = new Chart(ctx, { 
        type: type, 
        data: { 
            labels: labels, 
            datasets: [{ 
                data: data, 
                backgroundColor: colors.slice(0, data.length),
                borderWidth: 1,
                borderRadius: 4
            }] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            cutout: type === 'doughnut' ? '60%' : undefined,
            plugins: { 
                legend: { 
                    position: 'right', 
                    labels: { 
                        font: { size: 10 }, 
                        boxWidth: 10,
                        color: getComputedStyle(document.body).getPropertyValue('--text-main')
                    } 
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#e2e8f0'
                }
            },
            onClick: (event, activeElements) => {
                if (activeElements.length > 0) {
                    const idx = activeElements[0].index;
                    const label = labels[idx];
                    openDrilldownModal(filterType, label);
                }
            }
        } 
    });
}

function drawAgeChart(labels, data) {
    const ctx = document.getElementById('ageChart');
    if (!ctx) return;
    
    if (charts['ageChart']) charts['ageChart'].destroy();
    
    charts['ageChart'] = new Chart(ctx, { 
        type: 'bar', 
        data: { 
            labels: labels, 
            datasets: [{ 
                data: data, 
                backgroundColor: ['#3b82f6', '#10b981', '#eab308', '#f97316', '#ef4444'],
                borderRadius: 4
            }] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#e2e8f0'
                }
            },
            onClick: (event, activeElements) => {
                if (activeElements.length > 0) {
                    const idx = activeElements[0].index;
                    const label = labels[idx];
                    openDrilldownModal('Age', label);
                }
            }
        } 
    });
}

function drawInteractiveChart(canvasId, type, labels, data, filterType) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    if (charts[canvasId]) charts[canvasId].destroy();
    
    charts[canvasId] = new Chart(ctx, { 
        type: type, 
        data: { 
            labels: labels, 
            datasets: [{ 
                data: data, 
                backgroundColor: colors.slice(0, data.length),
                borderWidth: 1,
                borderRadius: 4
            }] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    position: 'bottom', 
                    labels: { 
                        font: { size: 11 }, 
                        boxWidth: 12,
                        color: getComputedStyle(document.body).getPropertyValue('--text-main')
                    } 
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#e2e8f0'
                }
            },
            onClick: (event, activeElements) => {
                if (activeElements.length > 0) {
                    const idx = activeElements[0].index;
                    const label = labels[idx];
                    openDrilldownModal(filterType, label);
                }
            }
        } 
    });
}

function updateWarnings(warnings) {
    const warningsList = document.getElementById('licenseWarningsList');
    if (!warningsList) return;
    
    if (!warnings || warnings.length === 0) {
        warningsList.innerHTML = '<li style="color: #10b981;">✅ Порушень не знайдено.</li>';
        return;
    }
    
    let html = '';
    warnings.forEach(w => {
        let icon = '⚠️';
        let color = '#f97316';
        
        if (w.type === 'no_antivirus') {
            icon = '🛡️';
            color = '#dc2626';
        } else if (w.type === 'home_os') {
            icon = '🔴';
            color = '#dc2626';
        } else if (w.type === 'old_office') {
            icon = '📄';
            color = '#f97316';
        }
        
        html += `<li style="color: ${color}; margin-bottom: 8px;">
            ${icon} <b>Каб. ${w.room || '?'}</b> (${w.model || 'ПК'}): ${w.message}
        </li>`;
    });
    
    warningsList.innerHTML = html;
}

// ==========================================
// DRILL-DOWN МОДАЛКА (ВИПРАВЛЕНО)
// ==========================================
window.openDrilldownModal = (filterType, filterValue) => {
    console.log("openDrilldownModal", filterType, filterValue);
    
    let modal = document.getElementById('drilldownModal');
    
    if (!modal) {
        const modalHtml = `
        <div id="drilldownModal" class="modal-overlay" style="display:none;">
            <div class="modal-content" style="display: flex; flex-direction: column; height: 90vh; max-height: 90vh;">
                <div class="modal-header" style="flex-shrink: 0;">
                    <div>
                        <h2 id="drilldownTitle" style="margin:0; font-size:18px;">Деталі</h2>
                        <p id="drilldownSubtitle" style="margin:5px 0 0; font-size:13px; color:var(--text-muted);"></p>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button class="btn-excel" onclick="exportDrilldownToExcel()">📥 Excel</button>
                        <button class="btn-secondary" onclick="document.getElementById('drilldownModal').style.display='none'">✖ Закрити</button>
                    </div>
                </div>
                
                <!-- Контейнер для таблиці з фіксованою висотою -->
                <div style="flex: 1; min-height: 0; overflow: hidden; position: relative;">
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                            <thead style="position: sticky; top: 0; z-index: 10; background: var(--bg-body);">
                                <tr>
                                    <th style="width: 50px; padding: 12px 8px; text-align: center;">№</th>
                                    <th style="width: 100px; padding: 12px 8px; text-align: left;">Тип</th>
                                    <th style="min-width: 250px; padding: 12px 8px; text-align: left;">Локація</th>
                                    <th style="min-width: 200px; padding: 12px 8px; text-align: left;">Обладнання</th>
                                    <th style="width: 120px; padding: 12px 8px; text-align: left;">Інвентарний №</th>
                                    <th style="width: 100px; padding: 12px 8px; text-align: left;">Hostname</th>
                                    <th style="width: 100px; padding: 12px 8px; text-align: left;">Статус</th>
                                    <th style="width: 150px; padding: 12px 8px; text-align: left;">Відповідальний</th>
                                    <th id="drilldownDetailHeader" style="width: 150px; padding: 12px 8px; text-align: left;">Деталі</th>
                                </tr>
                            </thead>
                            <tbody id="drilldownBody">
                                <tr>
                                    <td colspan="9" style="text-align: center; padding: 60px;">
                                        <div style="font-size: 24px; margin-bottom: 10px;">⏳</div>
                                        <div>Завантаження даних...</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Футер з пагінацією - завжди знизу -->
                <div class="modal-footer" style="flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-top: 1px solid var(--border-light); background: var(--bg-body);">
                    <div style="display: flex; gap: 20px; align-items: center;">
                        <span style="font-weight: 600;">Всього: <span id="drilldownTotal">0</span></span>
                        <span style="color: var(--text-muted);">📦 Склад: <span id="drilldownInventoryCount">0</span></span>
                        <span style="color: var(--text-muted);">🏢 Кабінети: <span id="drilldownRoomsCount">0</span></span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button class="btn-secondary" id="drilldownPrevPage" onclick="changeDrilldownPage(-1)" disabled style="padding: 6px 12px; min-width: 40px;">⬅</button>
                        <span id="drilldownPageInfo" style="font-weight: 500;">Стор. 1 з 1</span>
                        <button class="btn-secondary" id="drilldownNextPage" onclick="changeDrilldownPage(1)" style="padding: 6px 12px; min-width: 40px;">➡</button>
                    </div>
                </div>
            </div>
        </div>`;
            
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = document.getElementById('drilldownModal');
    }
    
    const filterNames = {
        'Type': 'Тип обладнання',
        'Location': 'Локація',
        'Age': 'Вік техніки',
        'RAM': 'Оперативна пам\'ять',
        'OS': 'Операційна система',
        'AV': 'Антивірус',
        'Disk': 'Накопичувачі',
        'Office': 'Офісний пакет'
    };
    
    // БЕЗПЕЧНЕ оновлення елементів з перевіркою на null
    const titleEl = document.getElementById('drilldownTitle');
    if (titleEl) titleEl.innerText = `${filterNames[filterType] || filterType}`;
    
    const subtitleEl = document.getElementById('drilldownSubtitle');
    if (subtitleEl) subtitleEl.innerText = `Фільтр: ${filterValue}`;
    
    if (modal) modal.style.display = 'flex';
    
    // Показуємо або ховаємо колонку деталей
    const detailHeader = document.getElementById('drilldownDetailHeader');
    if (detailHeader) {
        if (filterType === 'RAM' || filterType === 'OS' || filterType === 'AV' || filterType === 'Disk' || filterType === 'Office') {
            detailHeader.style.display = 'table-cell';
        } else {
            detailHeader.style.display = 'none';
        }
    }
    
    // Показуємо індикатор завантаження
    const drilldownBody = document.getElementById('drilldownBody');
    if (drilldownBody) {
        drilldownBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:60px;">⏳ Завантаження даних...</td></tr>';
    }
    
    // Змінні для пагінації
    window.drilldownCurrentPage = 1;
    window.drilldownItemsPerPage = 20;
    window.drilldownAllData = [];
    window.drilldownFilteredData = [];
    
    // Завантажуємо дані
    fetch(`api.php?action=get_dashboard_drilldown&filter_type=${filterType}&filter_value=${encodeURIComponent(filterValue)}`)
        .then(res => res.json())
        .then(response => {
            console.log("Отримано відповідь:", response);
            
            let data = [];
            if (response.data) {
                data = response.data;
            } else if (Array.isArray(response)) {
                data = response;
            } else {
                data = [];
            }
            
            console.log("Оброблені дані:", data);
            
            if (data && data.length > 0) {
                window.drilldownAllData = data;
                window.drilldownFilteredData = [...data];
                window.currentDrilldownData = data;
                
                renderDrilldownTable();
                
                // БЕЗПЕЧНЕ оновлення
                const totalEl = document.getElementById('drilldownTotal');
                if (totalEl) totalEl.innerText = data.length;
                
                // Ці елементи відсутні в новій модалці, тому перевіряємо
                const inventoryCountEl = document.getElementById('drilldownInventoryCount');
                if (inventoryCountEl) {
                    const inventoryCount = data.filter(item => item.source === 'inventory').length;
                    inventoryCountEl.innerText = inventoryCount;
                }
                
                const roomsCountEl = document.getElementById('drilldownRoomsCount');
                if (roomsCountEl) {
                    const roomsCount = data.filter(item => item.source === 'room').length;
                    roomsCountEl.innerText = roomsCount;
                }
            } else {
                const colSpan = (filterType === 'RAM' || filterType === 'OS' || filterType === 'AV' || filterType === 'Disk' || filterType === 'Office') ? 9 : 8;
                if (drilldownBody) {
                    drilldownBody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center; padding:40px; color:#94a3b8;">
                        <div style="font-size:24px; margin-bottom:10px;">📭</div>
                        <div>Нічого не знайдено</div>
                        <div style="font-size:12px; margin-top:10px;">За вибраним фільтром немає даних</div>
                    </td></tr>`;
                }
                
                const totalEl = document.getElementById('drilldownTotal');
                if (totalEl) totalEl.innerText = '0';
                
                const inventoryCountEl = document.getElementById('drilldownInventoryCount');
                if (inventoryCountEl) inventoryCountEl.innerText = '0';
                
                const roomsCountEl = document.getElementById('drilldownRoomsCount');
                if (roomsCountEl) roomsCountEl.innerText = '0';
            }
        })
        .catch(err => {
            console.error("Помилка завантаження:", err);
            if (drilldownBody) {
                drilldownBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:40px; color:#ef4444;"><div style="font-size:24px; margin-bottom:10px;">❌</div><div>Помилка завантаження</div><div style="font-size:12px; margin-top:10px;">' + err.message + '</div></td></tr>';
            }
        });
};

// Повністю замініть функцію renderDrilldownTable
function renderDrilldownTable() {
    const tbody = document.getElementById('drilldownBody');
    if (!tbody || !window.drilldownFilteredData) return;
    
    const totalPages = Math.ceil(window.drilldownFilteredData.length / window.drilldownItemsPerPage) || 1;
    
    if (window.drilldownCurrentPage < 1) window.drilldownCurrentPage = 1;
    if (window.drilldownCurrentPage > totalPages) window.drilldownCurrentPage = totalPages;
    
    const startIdx = (window.drilldownCurrentPage - 1) * window.drilldownItemsPerPage;
    const pageData = window.drilldownFilteredData.slice(startIdx, startIdx + window.drilldownItemsPerPage);
    
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:40px;">📭 Немає даних</td></tr>';
        return;
    }
    
    let html = '';
    pageData.forEach((item, index) => {
        const globalIndex = startIdx + index + 1;
        
        // Форматуємо локацію
        let locationText = item.loc || '-';
        if (item.room && item.room !== '0' && item.room !== 'null') {
            locationText = item.room; // Показуємо тільки кабінет, якщо він є
        }
        
        // Додаємо іконку тільки для джерела
        const sourceIcon = item.source === 'inventory' ? '📦' : '🏢';
        
        // Колір статусу
        const status = item.status || 'В роботі';
        let statusColor = '#10b981';
        let statusBg = '#10b98120';
        
        if (status.includes('ремонт')) {
            statusColor = '#f97316';
            statusBg = '#f9731620';
        } else if (status.includes('спис') || status === 'Списано') {
            statusColor = '#ef4444';
            statusBg = '#ef444420';
        }
        
        // Деталі (дата або інше)
        let detailText = '-';
        if (item.purchase_date) {
            const date = new Date(item.purchase_date);
            detailText = `від ${date.toLocaleDateString('uk-UA')}`;
        } else if (item.detail) {
            detailText = item.detail;
        }
        
        html += `
            <tr>
                <td style="padding: 10px 8px; text-align: center; vertical-align: middle;">${globalIndex}</td>
                <td style="padding: 10px 8px; vertical-align: middle;">${item.type || '-'}</td>
                <td style="padding: 10px 8px; vertical-align: middle;">
                    ${sourceIcon} ${locationText}
                </td>
                <td style="padding: 10px 8px; vertical-align: middle;">
                    <strong>${item.model || item.name || '-'}</strong>
                </td>
                <td style="padding: 10px 8px; vertical-align: middle; font-family: monospace; color: var(--primary);">
                    ${item.inv || item.inventory_number || '-'}
                </td>
                <td style="padding: 10px 8px; vertical-align: middle; font-family: monospace;">
                    ${item.hostname || '-'}
                </td>
                <td style="padding: 10px 8px; vertical-align: middle;">
                    <span style="display: inline-block; padding: 4px 8px; border-radius: 12px; 
                          background: ${statusBg}; color: ${statusColor}; font-weight: 600; font-size: 11px;">
                        ● ${status}
                    </span>
                </td>
                <td style="padding: 10px 8px; vertical-align: middle;">
                    ${item.person || item.responsible || '-'}
                </td>
                <td style="padding: 10px 8px; vertical-align: middle; font-size: 12px; color: var(--text-muted);">
                    ${detailText}
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    // Оновлюємо лічильники
    const totalEl = document.getElementById('drilldownTotal');
    if (totalEl) totalEl.innerText = window.drilldownFilteredData.length;
    
    const inventoryCountEl = document.getElementById('drilldownInventoryCount');
    if (inventoryCountEl) {
        const inventoryCount = window.drilldownFilteredData.filter(item => item.source === 'inventory').length;
        inventoryCountEl.innerText = inventoryCount;
    }
    
    const roomsCountEl = document.getElementById('drilldownRoomsCount');
    if (roomsCountEl) {
        const roomsCount = window.drilldownFilteredData.filter(item => item.source === 'room').length;
        roomsCountEl.innerText = roomsCount;
    }
    
    // Оновлюємо пагінацію
    const pageInfo = document.getElementById('drilldownPageInfo');
    if (pageInfo) pageInfo.innerText = `Стор. ${window.drilldownCurrentPage} з ${totalPages}`;
    
    const prevBtn = document.getElementById('drilldownPrevPage');
    if (prevBtn) prevBtn.disabled = window.drilldownCurrentPage === 1;
    
    const nextBtn = document.getElementById('drilldownNextPage');
    if (nextBtn) nextBtn.disabled = window.drilldownCurrentPage === totalPages;
}

// Функція зміни сторінки
window.changeDrilldownPage = (step) => {
    window.drilldownCurrentPage += step;
    renderDrilldownTable();
};

// Функція експорту в Excel
window.exportDrilldownToExcel = () => {
    const dataToExport = window.drilldownFilteredData || window.currentDrilldownData;
    
    if (!dataToExport || dataToExport.length === 0) {
        if (typeof showToast === 'function') {
            showToast("Немає даних для експорту", "error");
        } else {
            alert("Немає даних для експорту");
        }
        return;
    }
    
    const titleEl = document.getElementById('drilldownTitle');
    const subtitleEl = document.getElementById('drilldownSubtitle');
    
    const filterType = titleEl ? titleEl.innerText : 'Дані';
    const filterValue = subtitleEl ? subtitleEl.innerText.replace('Фільтр: ', '') : '';
    
    const exportData = dataToExport.map((item, index) => ({
        '№': index + 1,
        'Тип': item.type || '-',
        'Локація': item.loc || '-',
        'Кабінет': item.room || '-',
        'Джерело': item.source === 'inventory' ? 'Склад' : 'Кабінет',
        'Модель': item.model || '-',
        'Інвентарний №': item.inv || 'Б/Н',
        'Hostname': item.hostname || '-',
        'Статус': item.status || '-',
        'Відповідальний': item.person || '-',
        'Дата введення': item.purchase_date_formatted || 
                         (item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('uk-UA') : '-'),
        'Деталі': item.detail || (item.age_years ? Math.round(item.age_years * 10) / 10 + ' років' : '-')
    }));
    
    // Перевіряємо чи доступний XLSX
    if (typeof XLSX !== 'undefined') {
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Деталі");
        
        const fileName = `Dashboard_${filterType}_${filterValue.replace(/[^a-zа-яіїєґ0-9]/gi, '_')}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        if (typeof showToast === 'function') {
            showToast(`Експортовано ${exportData.length} записів`, "success");
        }
    } else {
        console.error("XLSX бібліотека не завантажена");
        if (typeof showToast === 'function') {
            showToast("Помилка: бібліотека Excel не завантажена", "error");
        }
    }
};

// Функція для тестування
window.testDrilldown = (filterType, filterValue) => {
    console.log(`Тестування: ${filterType} = ${filterValue}`);
    
    fetch(`api.php?action=get_dashboard_drilldown&filter_type=${filterType}&filter_value=${encodeURIComponent(filterValue)}`)
        .then(res => res.json())
        .then(data => {
            console.log("Результат:", data);
            
            if (data.data && data.data.length > 0) {
                console.log(`Знайдено ${data.data.length} записів:`);
                console.table(data.data.slice(0, 5));
            } else if (Array.isArray(data) && data.length > 0) {
                console.log(`Знайдено ${data.length} записів:`);
                console.table(data.slice(0, 5));
            } else {
                console.log("Дані відсутні");
            }
        })
        .catch(err => {
            console.error("Помилка:", err);
        });
};

// Сортування таблиці
window.sortDrilldownTable = (column) => {
    if (!window.drilldownFilteredData) return;
    
    const sortDirections = window.drilldownSortDirection || {};
    const direction = sortDirections[column] === 'asc' ? 'desc' : 'asc';
    sortDirections[column] = direction;
    window.drilldownSortDirection = sortDirections;
    
    window.drilldownFilteredData.sort((a, b) => {
        let valA = a[column] || '';
        let valB = b[column] || '';
        
        if (column === 'price') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
        } else {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }
        
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    window.drilldownCurrentPage = 1;
    renderDrilldownTable();
};

// Оновлюємо дашборд при зміні теми
document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
    setTimeout(() => {
        Object.values(charts).forEach(chart => chart.update());
    }, 100);
});
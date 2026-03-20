# 🏛️ Inventory Management System of the Main Department of the Pension Fund of Ukraine in Sumy Region

Web-based system for automating property/inventory accounting, equipment management, consumables (printers/cartridges) tracking, and internal transfers.

## Main
### What this project is for
The system is designed for transparent inventory management (warehouse, rooms/offices, responsible employees/MVO, and movements/transfers), laptop loan tracking, and audit logging related to printers/cartridges.

### Key features
1. **Stock / Warehouse inventory** (`inventory`)
   - add/edit/delete equipment records;
   - pagination, filters, sorting;
   - import inventory from CSV (1C) with automatic type detection.
2. **Rooms & bindings** (`rooms`)
   - bind equipment to rooms/offices and employees;
   - process device specs (including JSON from AIDA64) for updating characteristics.
3. **Transfer journal** (`transfer`)
   - internal transfers between locations/departments;
   - operation history and document-oriented workflows.
4. **Cartridges & printers accounting** (`refill`)
   - manage cartridge models and cartridge states (in use / in stock / refill requests);
   - refill and movement history;
   - tables for cartridge/printer domain are created/updated in backend (see `api/refills.php` and SQL scripts in `database/`).
5. **Laptops** (`laptops`)
   - laptop loan/return history;
   - generating PDF acts (client-side PDF generation).
6. **Audit & security** (`audit`, `settings`)
   - audit logging of user actions;
   - notes (public and private);
   - role-based access (roles stored in `users` table).
7. **Dashboard / analytics** (`dashboard`)
   - charts and statistics (types, locations, equipment age, OS, etc.);
   - drill-down to detailed lists.
8. **Settings & dictionaries** (`settings`)
   - synchronize dictionaries (locations, MVO, equipment types);
   - export/import (including CSV/Excel exports).

## Architecture
The project follows an SPA-like approach on a “pure frontend”:

- `index.html` loads base styles and bootstraps the UI.
- `js/core/boot.js` dynamically loads HTML components and pages (including `components/login.html` and files in `pages/`).
- `js/main.js` imports UI logic and starts initializers for modules (inventory/rooms/transfer/refill/laptops/employee/catalog/settings/notes, etc.).
- Backend is plain **PHP** with action-based routing via `api.php`, with module handlers in the `api/` folder.

### API routing
In `.htaccess` URL rewriting is configured so that requests like:
`/api/<action>` map to `api.php?action=<action>`.

Main action dispatch is in `api.php`, which includes the corresponding `api/<module>.php` based on the `action` value.

## Tech stack
- **Backend:** PHP, PDO, MySQL/MariaDB
- **Frontend:** HTML5, CSS3, Vanilla JS (ES6 modules)
- **Charts / exports:** Chart.js, pdfMake, SheetJS (XLSX)
- **Sessions:** native PHP sessions (login via `api/auth.php`)

## Requirements for running
1. Web server: Apache (requires `mod_rewrite` for `.htaccess` rules).
2. PHP: extensions used by the code (PDO for MySQL, mbstring, json).
3. MySQL/MariaDB: versions are roughly expected to be 5.7+/MariaDB.
4. PHP execution must be enabled in the project directory (e.g. under `htdocs`).

## Setup
### 1) Place the project into `htdocs`
Copy `pfu_inventory` into your `htdocs` (or another document root). Relative paths for assets and modules are used (e.g. `css/base.css`, `js/core/boot.js`, `api.php`).

### 2) Configure database connection
Set DB credentials in `api/db.php`:
- `host`, `dbname`
- `user`, `pass`

> Note: this repository contains placeholders/demo values in `api/db.php`. Replace with your real credentials.

### 3) Database & tables
The system works with a set of tables for inventory, dictionaries, audit, users, notes, transfers, and cartridges/printers domain.

In this repository, SQL scripts are provided only for part of functionality:
- `database/notes.sql` — `system_notes` table.
- `database/print.sql` — printers/cartridges-related tables and their indexes/constraints.
- `database/upd.sql`, `database/upd_loc.sql` — example update scripts (e.g., locations).

Additionally, `api/refills.php` contains `CREATE TABLE IF NOT EXISTS` blocks for cartridge/printer domain tables (`cartridge_models`, `cartridges`, `printers`).

If your database does not yet include the main inventory/transfers/users tables (e.g. `inventory`, `catalog`, `equipment_types`, `employees`, `locations`, `room_assignments`, `transfer_history`, `transfer_items`, `audit_logs`, `users`, `system_settings`, etc.), you will need to create them from your base schema/dump (not fully present as standalone DDL in `database/` in this repo).

### 4) Environment checks
Use:
- `check_errors.php` (shows DB connection status and runs a sample API request)
- `php_errors.log` (PHP error log configured in `api.php`)

## How to run
1. Start Apache + MySQL/MariaDB.
2. Open `index.html` in browser (example: `http://localhost/pfu_inventory/`).
3. Log in using the UI login form (component `components/login.html`).

## Typical workflows
1. **Login**: user role controls access to admin actions.
2. **Warehouse inventory**: add/edit equipment, import CSV (1C) for bulk loading.
3. **Rooms**: assign equipment to organizational units and store device characteristics (hostname/IP/OS/etc.).
4. **Transfers**: create operations “from → to” and verify history in the journal.
5. **Printers/cartridges**: create cartridge models, register cartridges, manage statuses and movements/refills.
6. **Laptops**: record loan/return and generate PDF acts.
7. **Notes**: attach public or private notes to inventory/rooms/transfers/laptops records.

## API (quick reference)
Base format:
- `GET api.php?action=<action>`
- `POST api.php` with JSON body: `{ "action": "<action>", ...payload }`

Examples:
1. Authorization:
   - `POST api.php` with `action=login` and `{ username, password }`
   - `GET api.php?action=check_session`
   - `GET api.php?action=logout`
2. Catalog:
   - `GET api.php?action=get_catalog`
   - `POST api.php` with `action=add_catalog/update_catalog/...`
3. Inventory:
   - `GET api.php?action=get_inventory&limit=...&offset=...`
   - `POST api.php` with `action=add_inventory/update_inventory/delete_inventory/...`
4. Dictionaries & settings:
   - use `GET/POST` via actions in the `settings` module.

### Main action groups (from `api.php`)
- `auth`: `login`, `logout`, `check_session`, `wipe_database`
- `settings`: exports/imports, dictionaries, users, maintenance, logs
- `catalog`: CRUD for equipment models/types
- `inventory`: CRUD + CSV import + health checks/fixes
- `rooms`: locations/rooms, bindings, batch operations
- `transfers`: transfer history and adding transfers
- `laptops`: laptop data and return
- `audit`: audit logging
- `dashboard`: dashboard statistics for charts
- `notes`: CRUD for notes
- `employee`: employee search
- `refills`: cartridges/printers, requests and movements

## Project structure
- `index.html` — main HTML shell (placeholders for tabs/modals)
- `.htaccess` — rewrite for `/api/*` and CORS headers
- `api.php` — central action router
- `api/` — backend modules (auth, inventory, rooms, transfers, settings, notes, refills, etc.)
- `pages/` — tab pages (HTML) for the UI
- `components/` — shared UI components (sidebar, login, modals)
- `js/core/boot.js` — loads HTML components/pages
- `js/main.js` — JS entry point (imports module logic and starts initializers)
- `js/modules/` — logic for each tab/module
- `database/` — SQL scripts for partial tables (notes/print + updates)

## Logs & diagnostics
- `php_errors.log` — PHP error log (configured in `api.php`)
- `check_errors.php` — DB and basic API request check

## Security (important)
- Add network/IP rules and access control: current `CORS` in `.htaccess` allows `*`, so access must be restricted at network/auth level.
- Do not commit production secrets (especially `api/db.php` credentials).
- For production readiness it is recommended to:
  - add CSRF protection for POST endpoints (if required by your environment)
  - harden admin actions like `wipe_database` (currently password-gated)

## License
This project is distributed under a closed, internal-use-only proprietary license.
See `LICENSE.md` for the full text (Internal Software Use License).

---

# 🏛️ Система управління інвентарем ГУ ПФУ в Сумській області

Веб-орієнтована система для автоматизації обліку майна, техніки, витратних матеріалів та контролю переміщень у державній установі.

## 🇺🇦 Основне

### Для чого проєкт
Система призначена для прозорого ведення інвентарного обліку (склад, кабінети, МВО, переміщення), обліку ноутбуків, а також журналювання операцій, пов'язаних із картриджами/принтерами.

### Ключові можливості
1. **Складський облік** (`inventory`)
   - додавання/редагування/видалення техніки;
   - пагінація, фільтри, сортування;
   - імпорт інвентарю з CSV (1С) з автоматичним визначенням типів.
2. **Кабінети та прив’язки** (`rooms`)
   - прив’язка техніки до кабінетів та працівників;
   - обробка специфікацій (у т.ч. JSON від AIDA64) на стороні клієнта/бека.
3. **Журнал переміщень** (`transfer`)
   - внутрішні переміщення між локаціями/відділами;
   - історія операцій та можливість формування документів.
4. **Облік картриджів і принтерів** (`refill`)
   - керування моделями картриджів і станом (використання/запас/заявки на заправку);
   - історія заправок/рухів картриджів;
   - таблиці, що стосуються картриджів/принтерів, створюються/оновлюються в бекенді (див. `api/refills.php` і SQL-скрипти в `database/`).
5. **Ноутбуки** (`laptops`)
   - журнал видачі/повернення ноутбуків;
   - формування PDF-актів (через клієнтський PDF-процес).
6. **Аудит та безпека** (`audit`, `settings`)
   - логування дій користувачів;
   - примітки (публічні та приватні);
   - розмежування доступу (ролі в таблиці `users`).
7. **Дашборд** (`dashboard`)
   - аналітика (типи, локації, вік техніки, ОС тощо);
   - drill-down (перехід до списків за кліком).
8. **Налаштування та довідники** (`settings`)
   - синхронізація довідників (локації, МВО, типи);
   - експорт/імпорт (у тому числі експорт у CSV/Excel).

## Архітектура
Проєкт побудований як **SPA-підхід** на “чистому” фронтенді:

- `index.html` завантажує стилі та модулі.
- `js/core/boot.js` динамічно підвантажує HTML-компоненти та сторінки (включно з `components/login.html` і сторінками в `pages/`).
- `js/main.js` імпортує логіку UI та запускає ініціалізатори модулів (inventory/rooms/transfer/refill/laptops/employee/catalog/settings/notes тощо).
- Бекенд — **PHP** з роутингом через `api.php` (action-based), а модулі — окремі файли в папці `api/`.

### Маршрутизація API
У `.htaccess` налаштовано перезапис URL, щоб запити виду:
`/api/<action>` пересилались в `api.php?action=<action>`.

Основний роутинг знаходиться в `api.php`, де виконується підключення файлів `api/<module>.php` залежно від `action`.

Приклад URL:
- `GET api.php?action=get_catalog`
- `POST api.php` (JSON у body) з полем `action`

## Технологічний стек
- **Backend:** PHP, PDO, MySQL/MariaDB
- **Frontend:** HTML5, CSS3, Vanilla JS (ES6 modules)
- **Графіки/експорт:** Chart.js, pdfMake, SheetJS (XLSX)
- **Сесії:** нативні PHP-сесії (логін через `api/auth.php`)

## Вимоги для запуску
1. Веб-сервер: Apache (потрібен `mod_rewrite` для правил з `.htaccess`).
2. PHP: потрібні розширення, що використовує код (PDO для MySQL, mbstring, json).
3. MySQL/MariaDB: версії орієнтовно MySQL 5.7+/MariaDB.
4. Дозволити виконання PHP у директорії проєкту (звичайно в `htdocs`).

## Налаштування
### 1) Перенести проєкт у `htdocs`
Скопіюй папку `pfu_inventory` в `htdocs` (або іншу директорію докореня сервера).
У конфігурації проєкту очікується доступність відносних шляхів у стилях/JS/HTML, напр.: `css/base.css`, `js/core/boot.js`, `api.php`.

### 2) Налаштувати підключення до БД
Вкажи правильні параметри підключення в `api/db.php`:
- `host`, `dbname`
- `user`, `pass`

> Увага: у репозиторії в `api/db.php` збережені демо/заготовки. У реальному використанні обов’язково заміни пароль на свій.

### 3) База даних та таблиці
Проєкт працює поверх набору таблиць (облік інвентарю, довідники, аудити, користувачі тощо).

У цьому репозиторії є SQL-скрипти для частини функціоналу:
- `database/notes.sql` — створення/оновлення таблиці `system_notes` (примітки).
- `database/print.sql` — створення таблиць для принтерів/картриджів (і їх зв’язків).
- `database/upd.sql`, `database/upd_loc.sql` — приклади/скрипти оновлення довідника локацій.

Також в `api/refills.php` є логіка, яка створює таблиці для `cartridge_models`, `cartridges`, `printers` (через `CREATE TABLE IF NOT EXISTS`) під час роботи модулю заправок/картриджів.

Якщо у твоїй БД ще немає базових таблиць інвентарного обліку (inventory/catalog/equipment_types/employees/locations/room_assignments/transfer_history/transfer_items/audit_logs/users/system_settings тощо) — їх потрібно створити з “базової” схеми (зазвичай це або окремий dump, або набір DDL з інвентарної версії проєкту).

### 4) Перевірка середовища
Виконай перевірку:
- `check_errors.php` (відображає статус підключення до БД та приклад запиту до API)
- переглянь `php_errors.log` (файл логування помилок PHP в корені проєкту)

## Як запустити
1. Запусти Apache + MySQL/MariaDB.
2. Відкрий у браузері `index.html` (наприклад: `http://localhost/pfu_inventory/`).
3. Увійди в систему через форму логіну (компонент `components/login.html`).

## Використання (типові сценарії)
1. **Вхід**: логін/пароль користувача, роль визначає доступ до адмін-функцій.
2. **Склад**: додавай/редагуй техніку, імпортуй CSV (1С) для масового завантаження.
3. **Кабінети**: закріплюй техніку за підрозділами/кабінетами, зберігай характеристику пристроїв (hostname/IP/ОС/тощо).
4. **Переміщення**: створюй операції “з → в” і перевіряй журнал історії.
5. **Картриджі/принтери**: заводь моделі, реєструй картриджі, фіксуй статуси та рухи/заправки.
6. **Ноутбуки**: оформлюй видачу/повернення та генеруй PDF-акти.
7. **Примітки**: додавай примітки до записів (інвентар/кабінет/переміщення/ноутбук) — публічні або приватні.

## API (коротко)
Базовий формат:
- `GET api.php?action=<action>`
- `POST api.php` з JSON body: `{ "action": "<action>", ...payload }`

Приклади:
1. Авторизація:
   - `POST api.php` з `action=login` і `{ username, password }`
   - `GET api.php?action=check_session`
   - `GET api.php?action=logout`
2. Каталог моделей:
   - `GET api.php?action=get_catalog`
   - `POST api.php` з `action=add_catalog/update_catalog/...`
3. Інвентар:
   - `GET api.php?action=get_inventory&limit=...&offset=...`
   - `POST api.php` з `action=add_inventory/update_inventory/delete_inventory/...`
4. Довідники та налаштування:
   - `GET/POST` через `action` у `settings` модулі.

### Основні групи action-ів (з `api.php`)
- `auth`: `login`, `logout`, `check_session`, `wipe_database`
- `settings`: експорт/імпорт, довідники, користувачі, технічне обслуговування, журнали
- `catalog`: CRUD довідника моделей/типів
- `inventory`: CRUD інвентарю + імпорт CSV + нормалізації/перевірки здоров’я
- `rooms`: локації, кабінети, прив’язки та масові операції
- `transfers`: історія та додавання переміщень
- `laptops`: отримання/додавання ноутбуків та повернення
- `audit`: аудит-логування
- `dashboard`: статистика для графіків
- `notes`: CRUD приміток
- `employee`: пошук працівників
- `refills`: картриджі/принтери/заявки/рухи

## Структура проєкту
Ключові директорії/файли:
- `index.html` — головний HTML (з placeholder-ами під вкладки/модалки)
- `.htaccess` — rewrite для `/api/*` та CORS заголовки
- `api.php` — центральний роутер
- `api/` — модулі бекенду (auth, inventory, rooms, transfers, settings, notes, refills тощо)
- `pages/` — HTML сторінки вкладок UI
- `components/` — спільні компоненти UI (sidebar, login, modals)
- `js/core/boot.js` — завантаження сторінок/компонентів
- `js/main.js` — точка входу (імпорти модулів і запуск ініціалізаторів)
- `js/modules/` — логіка кожної вкладки
- `database/` — SQL скрипти для частини таблиць (notes/print + update)

## Логи та діагностика
- `php_errors.log` — лог помилок PHP (налаштований в `api.php`)
- `check_errors.php` — перевірка БД та базового API-запиту

## Безпека (важливо)
- Увімкни обмеження доступу до системи (IP/паролі/мережеві правила). `CORS` у `.htaccess` дозволяє `*`, тож доступ має бути на рівні мережі/аутентифікації.
- Не публікуй `api/db.php` з реальними паролями користувачів/БД.
- Для продакшн-експлуатації бажано:
  - додати CSRF захист для POST-ендпоінтів (за потреби),
  - обмежити доступ до `wipe_database` та адміністративних дій (у коді вони прив’язані до пароля, але для безпеки це варто посилити).

## Ліцензія
Проєкт поширюється за внутрішньою пропрієтарною ліцензією «Internal Software Use License».
Повний текст ліцензії див. у файлі `LICENSE.md`.

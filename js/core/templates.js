// ==========================================
// БАЗОВЕ ФОРМУВАННЯ НАЗВИ (Для звичайних актів)
// ==========================================
function formatTitleAct(name, title, dept, dir) {
   if (dir === "Керівництво Головного управління") {
       return `${title} ${name}`;
   }
   let full = title;
   if (dept && dept !== "Без відділу / Загальний склад") full += ` ${dept}`;
   if (dir) full += ` ${dir}`;
   full += ` ${name}`;
   return full;
}

// ==========================================
// СМАРТ-КОНВЕРТЕР (Хірургічний родовий відмінок без втрати закінчень)
// ==========================================
function toGenitive(text) {
   if (!text || text === "Без відділу / Загальний склад" || text === "Не вказано") return "";
   let s = text.toLowerCase().trim();
   
   // 1. Працюємо з управліннями (змінюємо лише прикметник перед словом "управління")
   s = s.replace(/\b([а-яіїєяю\'-]+)не\s+управління\b/gi, '$1ного управління');
   s = s.replace(/\b([а-яіїєяю\'-]+)ве\s+управління\b/gi, '$1вого управління');
   
   // 2. Точкова заміна головних іменників
   s = s.replace(/\bвідділ\b/gi, 'відділу');
   s = s.replace(/\bсектор\b/gi, 'сектору');
   s = s.replace(/\bцентр\b/gi, 'центру');
   
   // 3. Якщо перед відділом/сектором є прикметник (напр. "Головний відділ")
   s = s.replace(/\b([а-яіїєяю\'-]+)ий\s+відділу\b/gi, '$1ого відділу');
   s = s.replace(/\b([а-яіїєяю\'-]+)ий\s+сектору\b/gi, '$1ого сектору');
   
   return s;
}

function formatTitleActGenitive(name, title, dept, dir) {
   if (dir === "Керівництво Головного управління") {
       return `${(title || '').toLowerCase()} ${name}`;
   }
   
   let full = (title || '').toLowerCase().trim(); 
   let deptGen = toGenitive(dept);
   let dirGen = toGenitive(dir);

   // РОЗУМНЕ ВИДАЛЕННЯ ДУБЛІКАТІВ (Тільки якщо слово стоїть на початку!)
   if (full.includes('відділу') || full.includes('відділ')) {
       deptGen = deptGen.replace(/^відділу\s+/gi, '').replace(/^відділ\s+/gi, '').trim();
   }
   if (full.includes('сектору') || full.includes('сектор')) {
       deptGen = deptGen.replace(/^сектору\s+/gi, '').replace(/^сектор\s+/gi, '').trim();
   }
   if (full.includes('управління')) {
       dirGen = dirGen.replace(/^управління\s+/gi, '').trim();
   }

   if (deptGen) full += ` ${deptGen}`;
   if (dirGen) full += ` ${dirGen}`;
   
   // Фінальна зачистка, якщо десь утворилися подвійні слова
   full = full.replace(/\bвідділу\s+відділу\b/gi, 'відділу');
   full = full.replace(/\bсектору\s+сектору\b/gi, 'сектору');
   full = full.replace(/\bуправління\s+управління\b/gi, 'управління');
   
   full += ` ${name}`; 
   
   // Прибираємо подвійні пробіли
   return full.replace(/\s+/g, ' ').trim();
}

// ==========================================
// НАЛАШТУВАННЯ ДИЗАЙНУ ТАБЛИЦІ ТА АБЗАЦІВ
// ==========================================
const thinTableLayout = {
   hLineWidth: function (i, node) { return 0.5; }, 
   vLineWidth: function (i, node) { return 0.5; }  
};

// 8 звичайних пробілів для ідеального відступу 1.25 см
const INDENT = '        '; 

// ==========================================
// ШАБЛОН: АКТ ПРИЙМАННЯ-ПЕРЕДАЧІ ТЕХНІКИ
// ==========================================
export const getTransferDef = (data) => {
    
  return {
      content: [
          { text: 'ПЕНСІЙНИЙ ФОНД УКРАЇНИ', alignment: 'center', bold: true, fontSize: 14 },
          { text: 'ГОЛОВНЕ УПРАВЛІННЯ ПЕНСІЙНОГО ФОНДУ УКРАЇНИ В СУМСЬКІЙ ОБЛАСТІ', alignment: 'center', bold: true, fontSize: 14 },
          { text: 'АКТ ПРИЙМАННЯ-ПЕРЕДАЧІ ТЕХНІКИ', alignment: 'center', bold: true, fontSize: 14, margin: [0, 25, 0, 25] },
          { text: `Відправник: ${data.from}`, margin: [0, 0, 0, 5], fontSize: 12.5 },
          { text: `Отримувач: ${data.to}`, margin: [0, 0, 0, 15], fontSize: 12.5 },
          {
              table: {
                  headerRows: 1, widths: ['auto', '*', '*'],
                  body: [
                      [{text: '№', bold: true, alignment: 'center'}, {text: 'Найменування', bold: true, alignment: 'center'}, {text: 'S/N або Інв.№', bold: true, alignment: 'center'}],
                      ...data.items.map((i, idx) => [{text: (idx + 1).toString(), alignment: 'center'}, i.model, i.inv])
                  ]
              }
          },
          {
              table: {
                  widths: ['*', '*'],
                  body: [
                      [
                          { text: `\n\nПередав:\n\n__________________ ${data.sender}`, border: [false, false, false, false] },
                          { text: `\n\nПрийняв:\n\n__________________ ${data.receiver}`, alignment: 'right', border: [false, false, false, false] }
                      ]
                  ]
              },
              margin: [0, 30, 0, 0]
          }
      ],
      defaultStyle: { fontSize: 12.5, lineHeight: 1.2 }
  };
};

// ==========================================
// ШАБЛОН: ЗАЯВКА НА КАРТРИДЖІ
// ==========================================
export const getRefillDef = (data) => {
  return {
      content: [
          { text: 'ПЕНСІЙНИЙ ФОНД УКРАЇНИ', alignment: 'center', bold: true, fontSize: 14 },
          { text: 'ГОЛОВНЕ УПРАВЛІННЯ ПЕНСІЙНОГО ФОНДУ УКРАЇНИ', alignment: 'center', bold: true, fontSize: 14 },
          { text: 'В СУМСЬКІЙ ОБЛАСТІ', alignment: 'center', bold: true, fontSize: 14 },
          { text: 'вул. Степана Бандери, 43, м. Суми , 40009   тел. (0542) 67-92-61,   код згідно з ЄДРПОУ 21108013', alignment: 'center', fontSize: 10, margin: [0, 5, 0, 20] },
          { columns: [ { text: '№ ______/_____' }, { text: 'На № __________ від __________', alignment: 'right' } ], margin: [0, 0, 0, 15] },
          { text: `Просимо ${data.actionText} наступні картриджі:`, margin: [0, 0, 0, 10], fontSize: 12.5 },
          { table: { headerRows: 1, widths: ['auto', '*', '*', 'auto'], body: [ [{text: 'п/п', bold: true, alignment: 'center'}, {text: 'Назва картриджа', bold: true, alignment: 'center'}, {text: 'Номер', bold: true, alignment: 'center'}, {text: 'Вид послуги', bold: true, alignment: 'center'}], ...data.items.map((i, idx) => [{text: (idx + 1).toString(), alignment: 'center'}, i.model, i.num, '']) ] } },
          { text: '    Після виконання послуг, картриджі разом з одним заповненим примірником цієї заявки необхідно доставити за адресою: Сумська обл. м. Суми, вул. Степана Бандери, буд.43', alignment: 'justify', margin: [0, 20, 0, 30] },
          { table: { widths: ['*', '*'], body: [ [ { text: `Передав:\n\n__________________ ${data.person}\n\n«${data.day}» ${data.month} ${data.year} р.`, border: [false, false, false, false] }, { text: `Прийняв:\n\n__________________ _________________\n\n«___» ____________ ${data.year} р.`, border: [false, false, false, false] } ] ] } }
      ],
      defaultStyle: { fontSize: 12.5, lineHeight: 1.2 }
  };
};

// ==========================================
// ШАБЛОН: АКТ ВИДАЧІ НОУТБУКА (ДСТУ 4163:2020)
// ==========================================
export const getLaptopDef = (data) => {
  const senderFull = formatTitleActGenitive(data.sender, data.senderTitle, data.senderDept, data.senderDir);
  const receiverFull = formatTitleActGenitive(data.receiver, data.receiverTitle, data.receiverDept, data.receiverDir);

  const cleanTokenModel = (data.tokenModel || 'Захищений носій (Токен)').replace(/[\d\.\,]+\s*(грн|₴)/i, '').trim();

  return {
      pageMargins: [85, 42, 28, 56], 
      content: [
          { text: 'АКТ', alignment: 'center', bold: true, fontSize: 14 },
          { text: 'передачі обладнання для дистанційної роботи', alignment: 'center', bold: true, fontSize: 14 },
          { text: data.dateStr, alignment: 'center', bold: true, fontSize: 14, margin: [0, 0, 0, 15] },
          // Зверніть увагу: preserveLeadingSpaces: true забезпечує збереження відступу!
          { text: INDENT + `Даний акт складений про те, що представник головного управління Пенсійного фонду України в Сумській області (${senderFull}) передав, а працівник головного управління Пенсійного фонду України в Сумській області (${receiverFull}) прийняв наступне обладнання:`, alignment: 'justify', margin: [0, 0, 0, 10], preserveLeadingSpaces: true },
          {
              layout: thinTableLayout,
              table: {
                  headerRows: 1, widths: ['auto', '*', 'auto', 'auto'],
                  body: [
                      [{text: '№\nп/п', alignment: 'center'}, {text: 'Назва обладнання(відповідно\nінвентаризаційної відомості)', alignment: 'center'}, {text: 'Серійний та інвентарні номери', alignment: 'center'}, {text: 'Кількість', alignment: 'center'}],
                      [{text: '1', alignment: 'center'}, `${data.model || 'Ноутбук'}`, `S/N: ${data.sn || '-'}\nІнв.№: ${data.inv || 'Б/Н'}`, {text: '1', alignment: 'center'}],
                      [{text: '2', alignment: 'center'}, `${cleanTokenModel}`, `S/N: ${data.tokenSn || '-'}\nІнв.№: ${data.tokenInv || 'Б/Н'}`, {text: '1', alignment: 'center'}]
                  ]
              }, margin: [0, 0, 0, 10]
          },
          { text: INDENT + 'Зазначене обладнання призначене для службового користування та пов’язаних із ним завдань.', alignment: 'justify', margin: [0, 0, 0, 0], preserveLeadingSpaces: true },
          { text: INDENT + `Відповідальність за збереження та безпеку під час експлуатації обладнання на період для службового користування покладається на ${data.receiver}.`, alignment: 'justify', margin: [0, 0, 0, 0], preserveLeadingSpaces: true },
          { text: INDENT + 'Переміщення обладнання на інше місце повинно супроводжуватися повідомленням головному спеціалісту сектору захисту інформаційних систем Тімченко А.В. для оформлення акту передачі та оновлення даних.', alignment: 'justify', margin: [0, 0, 0, 30], preserveLeadingSpaces: true },
          {
              table: {
                  widths: ['*', '*'],
                  body: [
                      [
                          { text: `Працівник головного управління\nПенсійного фонду України в Сумській\nобласті\n\n\n${data.receiver} _________________`, border: [false, false, false, false] },
                          { text: `Представник головного управління\nПенсійного фонду України в Сумській\nобласті\n\n\n${data.sender} _________________`, border: [false, false, false, false] }
                      ]
                  ]
              }
          }
      ],
      defaultStyle: { font: 'Times', fontSize: 12.5, lineHeight: 1.15 }
  };
};

// ==========================================
// ШАБЛОН: АКТ ПОВЕРНЕННЯ НОУТБУКА (ДСТУ 4163:2020)
// ==========================================
export const getLaptopReturnDef = (data) => {
  const senderFull = formatTitleActGenitive(data.sender, data.senderTitle, data.senderDept, data.senderDir); 
  const receiverFull = formatTitleActGenitive(data.receiver, data.receiverTitle, data.receiverDept, data.receiverDir); 
  
  const cleanTokenModel = (data.tokenModel || 'Захищений носій (Токен)').replace(/[\d\.\,]+\s*(грн|₴)/i, '').trim();

  return {
      pageMargins: [85, 42, 28, 56], 
      content: [
          { text: 'АКТ', alignment: 'center', bold: true, fontSize: 14 },
          { text: 'повернення обладнання з дистанційної роботи', alignment: 'center', bold: true, fontSize: 14 },
          { text: data.dateStr, alignment: 'center', bold: true, fontSize: 14, margin: [0, 0, 0, 15] },
          { text: INDENT + `Даний акт складений про те, що працівник головного управління Пенсійного фонду України в Сумській області (${senderFull}) повернув, а представник головного управління Пенсійного фонду України в Сумській області (${receiverFull}) прийняв наступне обладнання:`, alignment: 'justify', margin: [0, 0, 0, 10], preserveLeadingSpaces: true },
          {
              layout: thinTableLayout,
              table: {
                  headerRows: 1, widths: ['auto', '*', 'auto', 'auto'],
                  body: [
                      [{text: '№\nп/п', alignment: 'center'}, {text: 'Назва обладнання(відповідно\nінвентаризаційної відомості)', alignment: 'center'}, {text: 'Серійний та інвентарні номери', alignment: 'center'}, {text: 'Кількість', alignment: 'center'}],
                      [{text: '1', alignment: 'center'}, `${data.model || 'Ноутбук'}`, `S/N: ${data.sn || '-'}\nІнв.№: ${data.inv || 'Б/Н'}`, {text: '1', alignment: 'center'}],
                      [{text: '2', alignment: 'center'}, `${cleanTokenModel}`, `S/N: ${data.tokenSn || '-'}\nІнв.№: ${data.tokenInv || 'Б/Н'}`, {text: '1', alignment: 'center'}]
                  ]
              }, margin: [0, 0, 0, 10]
          },
          { text: INDENT + 'Устаткування повернуто у працездатному стані, комплектація повна, претензій до зовнішнього вигляду немає.', alignment: 'justify', margin: [0, 0, 0, 30], preserveLeadingSpaces: true },
          {
              table: {
                  widths: ['*', '*'],
                  body: [
                      [
                          { text: `Представник головного управління\nПенсійного фонду України в Сумській\nобласті\n\n\n${data.receiver} _________________`, border: [false, false, false, false] },
                          { text: `Працівник головного управління\nПенсійного фонду України в Сумській\nобласті\n\n\n${data.sender} _________________`, border: [false, false, false, false] }
                      ]
                  ]
              }
          }
      ],
      defaultStyle: { font: 'Times', fontSize: 12.5, lineHeight: 1.15 }
  };
};
// ==========================================
// ШАБЛОН ОБХІДНОГО ЛИСТА (МВО)
// ==========================================
export function getClearanceSheetDef(data) {
    return {
        content: [
            { text: 'ОБХІДНИЙ ЛИСТ (ІТ-Відділ)', alignment: 'center', bold: true, fontSize: 16, margin: [0,0,0,20] },
            { text: `Працівник: ${data.name}`, fontSize: 12, margin: [0,0,0,10] },
            { text: `Дата формування: ${data.dateStr}`, fontSize: 12, margin: [0,0,0,20] },
            { text: 'За працівником рахується наступне майно:', margin: [0,0,0,10] },
            {
                table: {
                    headerRows: 1, 
                    widths: ['auto', 'auto', '*', '*'],
                    body: [
                        [{text: '№', bold:true}, {text: 'Категорія', bold:true}, {text: 'Обладнання', bold:true}, {text: 'Місцезнаходження', bold:true}],
                        ...data.items
                    ]
                }
            },
            { text: '\n\nВідмітка про повернення майна (претензій немає):\n\n_____________________ (Підпис ІТ-спеціаліста)', margin: [0,40,0,0] }
        ],
        defaultStyle: { fontSize: 11, font: 'Roboto' }
    };
}

export const getBuildingFormularDef = (data) => {
    return {
        pageMargins: [40, 40, 40, 40],
        content: [
            // Титульна сторінка (Спрощено для pdfMake)
            {
                columns: [
                    { text: '', width: '*' },
                    {
                        stack: [
                            { text: 'ЗАТВЕРДЖУЮ', bold: true, fontSize: 12 },
                            { text: data.bossTitle, fontSize: 11 },
                            { text: 'Пенсійного фонду України в Сумській області', fontSize: 11 },
                            { text: data.bossName, bold: true, margin: [0, 10, 0, 0] },
                            { text: '________________________', margin: [0, 5, 0, 0] },
                            { text: '«___»_____________20___ р.', margin: [0, 5, 0, 40] },
                        ],
                        width: 250
                    }
                ]
            },
            { text: 'КОМПЛЕКСНА СИСТЕМА ЗАХИСТУ ІНФОРМАЦІЇ', alignment: 'center', bold: true, fontSize: 14, margin: [0, 100, 0, 5] },
            { text: 'Інформаційно-комунікаційної системи', alignment: 'center', fontSize: 12 },
            { text: 'ПЕНСІЙНОГО ФОНДУ УКРАЇНИ', alignment: 'center', bold: true, fontSize: 16, margin: [0, 5, 0, 30] },
            { text: 'ФОРМУЛЯР', alignment: 'center', bold: true, fontSize: 24, margin: [0, 0, 0, 10] },
            { text: 'Вузла регіонального рівня ІКС ПФУ', alignment: 'center', fontSize: 14, bold: true },
            { text: data.location, alignment: 'center', fontSize: 12, italics: true, margin: [0, 5, 0, 100] },
            { text: '2025', alignment: 'center', fontSize: 12, pageBreak: 'after' },

            // Стор 2. Загальні відомості
            { text: '1. Загальні відомості', style: 'sectionHeader' },
            { 
                text: `Вузол регіонального рівня ІКС ПФУ призначений для автоматизації обробки та зберігання інформації. Місце розташування: ${data.location}.`,
                alignment: 'justify', margin: [0, 0, 0, 20] 
            },

            // Стор 2. Робочі станції
            { text: '2. Перелік робочих станцій', style: 'sectionHeader' },
            {
                table: {
                    headerRows: 1, widths: [50, '*', '*', 80],
                    body: [
                        [{text: 'Каб.', bold:true}, {text: 'Пристрій', bold:true}, {text: 'Модель (Тип)', bold:true}, {text: 'Інв. номер', bold:true}],
                        ...data.workstations
                    ]
                }, margin: [0, 0, 0, 20]
            },

            // Мережеве обладнання
            { text: '3. Перелік мережевого обладнання', style: 'sectionHeader' },
            {
                table: {
                    headerRows: 1, widths: ['*', '*', 100],
                    body: [
                        [{text: 'Пристрій', bold:true}, {text: 'Модель, тип', bold:true}, {text: 'Інв. номер', bold:true}],
                        ...data.networkEquip.length ? data.networkEquip : [['-', '-', '-']]
                    ]
                }, margin: [0, 0, 0, 20]
            },

            // ПЗ
            { text: '4. Перелік програмного забезпечення', style: 'sectionHeader' },
            {
                table: {
                    headerRows: 1, widths: ['*', '*', 60],
                    body: [
                        [{text: 'Найменування ПЗ', bold:true}, {text: 'Відомості про ліцензію', bold:true}, {text: 'К-сть', bold:true}],
                        ...data.software.map(s => [s.name, s.license, s.count.toString()])
                    ]
                }, margin: [0, 0, 0, 20]
            },

            // Відповідальні особи
            { text: '5. Посадові особи, відповідальні за експлуатацію', style: 'sectionHeader' },
            { text: 'Технічне обслуговування:', bold: true, margin: [0, 5, 0, 5] },
            {
                table: {
                    headerRows: 1, widths: ['*', '*', '*'],
                    body: [
                        [{text: 'ПІБ', bold:true}, {text: 'Посада', bold:true}, {text: 'Наказ про призначення', bold:true}],
                        ...data.techStaff.map(s => [s.name, s.title, `№ ${data.orderNum} від ${data.orderDate}`])
                    ]
                }, margin: [0, 0, 0, 10]
            },
            { text: 'Захист інформації:', bold: true, margin: [0, 10, 0, 5] },
            {
                table: {
                    headerRows: 1, widths: ['*', '*', '*'],
                    body: [
                        [{text: 'ПІБ', bold:true}, {text: 'Посада', bold:true}, {text: 'Наказ про призначення', bold:true}],
                        ...data.secStaff.map(s => [s.name, s.title, `№ ${data.orderNum} від ${data.orderDate}`])
                    ]
                }
            }
        ],
        styles: {
            sectionHeader: { fontSize: 14, bold: true, margin: [0, 15, 0, 10], color: '#333' }
        },
        defaultStyle: { font: 'Times', fontSize: 11 }
    };
};
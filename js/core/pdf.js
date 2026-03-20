// js/core/pdf.js

export async function downloadPDF(def, filename) {
    try {
        if (!window.pdfMake) {
            alert("Помилка: Бібліотека pdfMake не знайдена.");
            return;
        }

        // Підключаємо стандартні шрифти, якщо вони є
        if (!window.pdfMake.vfs && window.pdfMakeFonts && window.pdfMakeFonts.pdfMake.vfs) {
            window.pdfMake.vfs = window.pdfMakeFonts.pdfMake.vfs;
        }

        // Спроба завантажити локальні шрифти Times New Roman
        let timesLoaded = false;
        try {
            if (!window.pdfMake.vfs['times.ttf']) {
                const loadFontBase64 = async (url) => {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const buffer = await response.arrayBuffer();
                    const bytes = new Uint8Array(buffer);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                    return window.btoa(binary);
                };

                // Шляхи до твоїх файлів у папці assets
                window.pdfMake.vfs['times.ttf'] = await loadFontBase64('assets/fonts/times.ttf');
                window.pdfMake.vfs['timesbd.ttf'] = await loadFontBase64('assets/fonts/timesbd.ttf');
            }
            timesLoaded = true;
        } catch (fontError) {
            console.warn("Не вдалося завантажити локальні шрифти Times New Roman:", fontError);
            console.warn("Буде використано стандартний шрифт pdfMake (Roboto).");
        }

        // Реєструємо шрифти в конфігурації pdfMake
        window.pdfMake.fonts = {
            Times: timesLoaded ? {
                normal: 'times.ttf',
                bold: 'timesbd.ttf',
                italics: 'times.ttf',
                bolditalics: 'timesbd.ttf'
            } : undefined, // Якщо не завантажились, не реєструємо
            Roboto: {
                normal: 'Roboto-Regular.ttf',
                bold: 'Roboto-Medium.ttf',
                italics: 'Roboto-Italic.ttf',
                bolditalics: 'Roboto-MediumItalic.ttf'
            }
        };

        // Встановлюємо шрифт за замовчуванням: Times, якщо доступний, інакше Roboto
        if (!def.defaultStyle) {
            def.defaultStyle = {};
        }
        def.defaultStyle.font = timesLoaded ? 'Times' : 'Roboto';
        
        // Встановлюємо розмір шрифту 12pt як стандарт для держ. органів
        if (!def.defaultStyle.fontSize) {
            def.defaultStyle.fontSize = 12;
        }

        // Генеруємо та завантажуємо документ
        pdfMake.createPdf(def).download(filename);
        
    } catch (e) {
        console.error("Помилка генерації PDF:", e);
        alert("Помилка генерації PDF: " + e.message);
    }
}

// Робимо функцію глобально доступною для інших скриптів
window.downloadPDF = downloadPDF;
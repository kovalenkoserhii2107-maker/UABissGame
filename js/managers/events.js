// Модуль случайных событий (Events)
const EVENTS = {
    simulate() {
        if (!STATE.eventLog) STATE.eventLog = [];
        // Храним только последние 30 событий, чтобы не засорять память
        if (STATE.eventLog.length > 30) STATE.eventLog.pop();

        // Шанс события — 10% каждый день
        if (Math.random() > 0.10) return;

        let possibleEvents = [
            {
                type: 'good',
                execute: () => {
                    let amount = 1500 + Math.floor(Math.random() * 3000);
                    STATE.finances.balance += amount;
                    // Записываем ДОХОД в бухгалтерию
                    if (typeof LEDGER !== 'undefined') LEDGER.record('rev_other', amount);
                    return { msg: '🏆 Государственный грант на инновации!', details: `Получено: +$${formatMoney(amount)}` };
                }
            },
            {
                type: 'bad',
                execute: () => {
                    let amount = 500 + Math.floor(Math.random() * 1500);
                    STATE.finances.balance -= amount;
                    // Записываем РАСХОД в бухгалтерию (в ту самую строку)
                    if (typeof LEDGER !== 'undefined') LEDGER.record('exp_fines', amount);
                    return { msg: '🚨 Внеплановая проверка пожарной безопасности.', details: `Выписан штраф: -$${formatMoney(amount)}` };
                }
            },
            {
                type: 'info',
                execute: () => {
                    if (!STATE.retail) STATE.retail = { brand: 10 };
                    let brandBoost = 2 + Math.floor(Math.random() * 5);
                    STATE.retail.brand += brandBoost;
                    if (STATE.retail.brand > 100) STATE.retail.brand = 100;
                    return { msg: '📱 Ваш товар засветился у популярного блогера!', details: `Узнаваемость бренда выросла на +${brandBoost}%` };
                }
            }
        ];

        // Выбираем случайное событие
        let randomEvent = possibleEvents[Math.floor(Math.random() * possibleEvents.length)];
        let result = randomEvent.execute();

        // ЗАПИСЫВАЕМ В ЖУРНАЛ
        STATE.eventLog.unshift({
            day: STATE.time.day,
            msg: `<strong>${result.msg}</strong><br><span style="font-size:0.9em; color:#555;">${result.details}</span>`,
            type: randomEvent.type
        });

        // Если интерфейс открыт — обновляем верхнюю панель с деньгами
        if (typeof UI_DASHBOARD !== 'undefined') {
            UI_DASHBOARD.updateTopPanel();
        }
    }
};
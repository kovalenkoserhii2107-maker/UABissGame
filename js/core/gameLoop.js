// Главный игровой цикл
const GAME = {
    
    // Инициализация при старте игры
    init() {
        if (typeof LEDGER !== 'undefined') LEDGER.init();
        if (typeof WAREHOUSE !== 'undefined') WAREHOUSE.init();
        if (typeof QUESTS !== 'undefined') {
            QUESTS.init();
            QUESTS.checkProgress();
        }
        UI_DASHBOARD.update();
    },

    // Логика завершения хода
    nextDay() {
        STATE.time.day++;

        // 1. Финансы
        FINANCE.processDailyClearing();
        
        // 2. Списание ФОТ с записью в книгу
        let dailySalaries = HR.getDailySalaryFund();
        if (dailySalaries > 0) {
            STATE.finances.balance -= dailySalaries;
            LEDGER.record('exp_salary', dailySalaries);
        }

        // 3. Отработка механик
        WAREHOUSE.processDaily(); // Склады (аренда всех хабов и автопополнение магазинов)
        HR.processDaily();
        CONTRACTS.processDaily();
        RND.processDaily();
        PRODUCTION.processProduction();
        MARKET.simulate();
        LOGISTICS.processDaily(); // Логистика
        RETAIL.processDaily();
        EVENTS.simulate();
        
        // 4. Списание налогов и формирование налоговой базы
        if (typeof TAXES !== 'undefined') TAXES.processDaily();
        
        // 5. Закрытие бухгалтерского дня (Перенос данных)
        LEDGER.endOfDay();

        // 6. Проверка прогресса квестов и достижений
        if (typeof QUESTS !== 'undefined') QUESTS.checkProgress();

        UI_DASHBOARD.update();

        if (STATE.finances.balance < 0) {
            if (typeof NOTIFY !== 'undefined') {
                NOTIFY.error('Кассовый разрыв! ⚠️', `Счета компании ушли в минус ($${formatMoney(Math.abs(STATE.finances.balance))}). Сократите издержки или возьмите кредит.`);
            }
        }
    }
};

// Запуск игры после загрузки страницы
window.onload = () => {
    GAME.init();
};

// Главный игровой цикл
const GAME = {
    
    // Инициализация при старте игры
    init() {
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

        // 3. Списание аренды склада с записью в книгу
        let dailyRent = WAREHOUSE.getDailyRent();
        if (dailyRent > 0) {
            STATE.finances.balance -= dailyRent;
            LEDGER.record('exp_admin', dailyRent);
        }

        // 4. Отработка механик
        HR.processDaily();
        CONTRACTS.processDaily();
        RND.processDaily();
        PRODUCTION.processProduction();
        MARKET.simulate();
        LOGISTICS.processDaily(); // ЛОГИСТИКА
        RETAIL.processDaily();
        EVENTS.simulate();
        
        // --- НОВОЕ: Списание налогов и формирование налоговой базы ---
        if (typeof TAXES !== 'undefined') TAXES.processDaily();
        
        // 5. Закрытие бухгалтерского дня (Перенос данных)
        LEDGER.endOfDay();

        UI_DASHBOARD.update();

        if (STATE.finances.balance < 0) {
            alert("Внимание! Кассовый разрыв. Счета компании ушли в минус.");
        }
    }
};

// Запуск игры после загрузки страницы
window.onload = () => {
    GAME.init();
};

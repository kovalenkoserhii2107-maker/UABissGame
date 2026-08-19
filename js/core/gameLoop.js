// Главный игровой цикл
const GAME = {
    
    // Инициализация при старте игры
    init() {
        if (typeof LEDGER !== 'undefined') LEDGER.init();
        if (typeof MARKET !== 'undefined') MARKET.init();
        if (typeof WAREHOUSE !== 'undefined') WAREHOUSE.init();
        if (typeof QUESTS !== 'undefined') {
            QUESTS.init();
            QUESTS.checkProgress();
        }
        UI_DASHBOARD.update();
        if (typeof TUTORIAL !== 'undefined') {
            TUTORIAL.init();
        }
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
        
        // Запись истории RP для графика
        if (!STATE.history) STATE.history = { rp: [] };
        if (!STATE.history.rp) STATE.history.rp = [];
        if (typeof RND !== 'undefined') {
            STATE.history.rp.push(RND.getDailyRP());
            if (STATE.history.rp.length > 30) STATE.history.rp.shift();
        }

        PRODUCTION.processProduction();
        MARKET.simulate();
        LOGISTICS.processDaily(); // Логистика
        RETAIL.processDaily();
        EVENTS.simulate();
        
        if (typeof B2B_AI !== 'undefined' && STATE.time.day % 7 === 0) {
            B2B_AI.generateOffers();
        }
        
        // 4. Списание налогов и формирование налоговой базы
        if (typeof TAXES !== 'undefined') TAXES.processDaily();
        
        // 5. Закрытие бухгалтерского дня (Перенос данных)
        LEDGER.endOfDay();

        // 6. Проверка прогресса квестов и достижений
        if (typeof QUESTS !== 'undefined') QUESTS.checkProgress();

        UI_DASHBOARD.update();

        if (STATE.finances.balance < 0) {
            if (typeof NOTIFY !== 'undefined') {
                let overdraftPenalty = Math.abs(STATE.finances.balance) * 0.002;
                NOTIFY.error('Бизнес-Овердрафт ⚠️', `Счета ушли в минус ($${formatMoney(Math.abs(STATE.finances.balance))}). Ежедневный штраф банка: $${formatMoney(overdraftPenalty)} (0.2%). Сократите издержки или возьмите кредит!`);
            }
        }
    }
};

// Запуск игры после загрузки страницы
window.onload = () => {
    GAME.init();
};

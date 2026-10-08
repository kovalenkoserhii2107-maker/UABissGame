const GAME = {
    processing: false,
    prepare() {
        LEDGER.init(); WAREHOUSE.init(); HR.init(); RND.init(); PRODUCTION.init();
        MARKET.init(); STOCK_MARKET.init(); QUESTS.init(); TAXES.init();
    },
    init() {
        PERSISTENCE.load(); this.prepare(); QUESTS.checkProgress();
        UI_DASHBOARD.update(); TUTORIAL.init();
        ACCESSIBILITY.init();
    },
    nextDay() {
        if (this.processing) return;
        const previous = JSON.stringify(STATE);
        this.processing = true;
        try {
            const netWorthBefore = FINANCE.calculateNetWorth();
            STATE.time.day++;
            LOGISTICS.processDaily();
            FINANCE.processDailyClearing();
            const salaries = HR.getDailySalaryFund();
            LEDGER.cash(-salaries, 'operating', 'Зарплаты'); LEDGER.record('exp_salary', salaries);
            WAREHOUSE.processDaily(); HR.processDaily(); RND.processDaily();
            STATE.history.rp.push(STATE.rnd.lastRP ?? 0);
            if (STATE.history.rp.length > 30) STATE.history.rp.shift();
            PRODUCTION.processProduction(); RETAIL.processDaily();
            CONTRACTS.processDaily(); EVENTS.simulate();
            MARKET.simulate(); B2B_AI.simulateMarketActions();
            if (STATE.time.day % 7 === 0) B2B_AI.generateOffers();
            STOCK_MARKET.processDaily(); TAXES.processDaily();
            STATE.ledger.cashFlow.today.netWorthBefore = netWorthBefore;
            STATE.ledger.cashFlow.today.netWorthAfter = FINANCE.calculateNetWorth();
            LEDGER.endOfDay(); QUESTS.checkProgress();
            PERSISTENCE.validate(STATE);
        } catch (error) {
            PERSISTENCE.replace(JSON.parse(previous));
            NOTIFY.error('День не закрыт', error.message + ' Состояние восстановлено.');
            console.error(error);
        } finally {
            this.processing = false;
            UI_DASHBOARD.update();
        }
    }
};
window.addEventListener('load', () => GAME.init());
